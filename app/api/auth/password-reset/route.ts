import {db} from '@/lib/db';import {ok,fail,apiError} from '@/lib/api';import {hashEmailCode,normalizeEmail,verifyEmailCodeHash} from '@/lib/email';import bcrypt from 'bcryptjs';import {z} from 'zod';

const schema=z.object({email:z.string().email('邮箱格式不正确').max(120),code:z.string().regex(/^\d{6}$/,'请输入6位邮箱验证码'),password:z.string().min(8,'新密码至少需要8位').max(100)});

export async function POST(req:Request){try{
  const p=schema.safeParse(await req.json());if(!p.success)return fail(p.error.issues[0].message,'VALIDATION_ERROR');
  const email=normalizeEmail(p.data.email),verification=await db.emailVerification.findUnique({where:{email}}),user=await db.user.findUnique({where:{email}});
  if(!user)return fail('该邮箱尚未注册','EMAIL_NOT_FOUND',404);
  if(!verification||verification.purpose!=='RESET')return fail('请先获取找回密码验证码','CODE_NOT_FOUND',400);
  if(verification.expiresAt<new Date())return fail('验证码已过期，请重新获取','CODE_EXPIRED',400);
  if(verification.attempts>=5)return fail('验证码错误次数过多，请重新获取','TOO_MANY_ATTEMPTS',429);
  if(!verifyEmailCodeHash(verification.codeHash,hashEmailCode(email,p.data.code))){await db.emailVerification.update({where:{email},data:{attempts:{increment:1}}});return fail('邮箱验证码错误','INVALID_CODE',400)}
  await db.$transaction(async tx=>{await tx.user.update({where:{id:user.id},data:{passwordHash:await bcrypt.hash(p.data.password,12)}});await tx.emailVerification.delete({where:{email}});await tx.operationLog.create({data:{userId:user.id,action:'RESET_PASSWORD',module:'AUTH',targetId:user.id,description:'通过邮箱验证码重置密码'}})});
  return ok({message:'密码已重置，请使用新密码登录'});
}catch(e){return apiError(e)}}
