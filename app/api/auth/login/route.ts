import {z} from 'zod';import {db} from '@/lib/db';import bcrypt from 'bcryptjs';import {createSession,SESSION_COOKIE} from '@/lib/auth';import {ok,fail,apiError} from '@/lib/api';import {cookies} from 'next/headers';import {hashEmailCode,normalizeEmail,verifyEmailCodeHash} from '@/lib/email';

const schema=z.object({mode:z.enum(['PASSWORD','CODE']).default('PASSWORD'),identifier:z.string().trim().min(2),password:z.string().min(8).optional(),code:z.string().regex(/^\d{6}$/).optional()});

export async function POST(req:Request){try{
  const body=schema.safeParse(await req.json());
  if(!body.success)return fail('邮箱、账号或验证码格式不正确','VALIDATION_ERROR');
  const {mode,identifier}=body.data,email=normalizeEmail(identifier);
  if(mode==='CODE'&&!z.string().email().safeParse(identifier).success)return fail('验证码登录必须使用已绑定邮箱','EMAIL_REQUIRED');
  if(mode==='PASSWORD'&&!body.data.password)return fail('请输入密码','PASSWORD_REQUIRED');
  if(mode==='CODE'&&!body.data.code)return fail('请输入6位邮箱验证码','CODE_REQUIRED');
  const user=await db.user.findFirst({where:{OR:[{username:identifier},{email}]},include:{role:true}});
  if(!user||user.status!=='ACTIVE')return fail('邮箱、账号或验证码错误','INVALID_CREDENTIALS',401);
  if(mode==='PASSWORD'){
    if(!await bcrypt.compare(body.data.password!,user.passwordHash))return fail('邮箱、账号或密码错误','INVALID_CREDENTIALS',401);
  }else{
    const verification=await db.emailVerification.findUnique({where:{email}});
    if(!verification||verification.purpose!=='LOGIN')return fail('请先获取邮箱验证码','CODE_NOT_FOUND',400);
    if(verification.expiresAt<new Date())return fail('验证码已过期，请重新获取','CODE_EXPIRED',400);
    if(verification.attempts>=5)return fail('验证码错误次数过多，请重新获取','TOO_MANY_ATTEMPTS',429);
    if(!verifyEmailCodeHash(verification.codeHash,hashEmailCode(email,body.data.code!))){await db.emailVerification.update({where:{email},data:{attempts:{increment:1}}});return fail('邮箱验证码错误','INVALID_CODE',400)}
    await db.emailVerification.delete({where:{email}});
  }
  const token=await createSession(user.id);(await cookies()).set(SESSION_COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'&&process.env.APP_URL?.startsWith('https://'),path:'/',maxAge:28800});await db.operationLog.create({data:{userId:user.id,action:mode==='CODE'?'LOGIN_CODE':'LOGIN',module:'AUTH',description:mode==='CODE'?'邮箱验证码登录':'用户登录',userAgent:req.headers.get('user-agent')}});return ok({id:user.id,name:user.name,role:user.role.code})
}catch(e){return apiError(e)}}
