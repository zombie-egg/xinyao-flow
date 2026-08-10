import { NextResponse } from 'next/server';
export const ok=(data:unknown,status=200)=>NextResponse.json({success:true,data},{status});
export const fail=(message:string,code='BAD_REQUEST',status=400)=>NextResponse.json({success:false,message,code},{status});
export function apiError(error:unknown){console.error(error); if(error instanceof Error&&error.message==='UNAUTHORIZED')return fail('请先登录','UNAUTHORIZED',401);if(error instanceof Error&&error.message==='FORBIDDEN')return fail('无权执行此操作','FORBIDDEN',403);const code=typeof error==='object'&&error&&'code' in error?String(error.code):'';if(code==='P2028')return fail('请求处理超时，请重新提交','REQUEST_TIMEOUT',503);if(code==='P2002')return fail('数据已存在，请勿重复提交','DUPLICATE_DATA',409);return fail('服务器暂时无法处理请求，请稍后重试','INTERNAL_ERROR',500);}
