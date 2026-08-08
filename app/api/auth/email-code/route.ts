import crypto from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/db';
import {ok,fail,apiError} from '@/lib/api';
import {codePurpose,hashEmailCode,normalizeEmail,sendLoginCode,sendRegistrationCode,sendResetCode} from '@/lib/email';

const schema=z.object({email:z.string().email('邮箱格式不正确').max(120),purpose:z.enum(['REGISTER','LOGIN','RESET']).optional()});

export async function POST(req:Request){
  try{
    const p=schema.safeParse(await req.json());
    if(!p.success)return fail(p.error.issues[0].message,'VALIDATION_ERROR');
    const email=normalizeEmail(p.data.email),purpose=codePurpose(p.data.purpose),user=await db.user.findUnique({where:{email}});
    if(purpose==='REGISTER'&&user)return fail('该邮箱已经注册','EMAIL_EXISTS',409);
    if(purpose!=='REGISTER'&&!user)return fail('该邮箱尚未注册','EMAIL_NOT_FOUND',404);
    const existing=await db.emailVerification.findUnique({where:{email}});
    if(existing&&Date.now()-existing.lastSentAt.getTime()<60000)return fail('验证码发送过于频繁，请稍后再试','TOO_MANY_REQUESTS',429);
    const code=String(crypto.randomInt(100000,1000000));
    await db.emailVerification.upsert({where:{email},update:{purpose,codeHash:hashEmailCode(email,code),expiresAt:new Date(Date.now()+10*60*1000),attempts:0,lastSentAt:new Date()},create:{email,purpose,codeHash:hashEmailCode(email,code),expiresAt:new Date(Date.now()+10*60*1000),lastSentAt:new Date()}});
    try{
      if(purpose==='LOGIN')await sendLoginCode(email,code);else if(purpose==='RESET')await sendResetCode(email,code);else await sendRegistrationCode(email,code);
    }catch(error){
      await db.emailVerification.deleteMany({where:{email,purpose}});
      console.error('发送邮箱验证码失败',error instanceof Error?error.message:'未知错误');
      return fail('验证码发送失败，请检查邮箱地址或稍后重试','EMAIL_SEND_FAILED',502);
    }
    return ok({message:'验证码已发送，请检查邮箱'});
  }catch(e){return apiError(e)}
}
