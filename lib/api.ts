import { NextResponse } from 'next/server';
export const ok=(data:unknown,status=200)=>NextResponse.json({success:true,data},{status});
export const fail=(message:string,code='BAD_REQUEST',status=400)=>NextResponse.json({success:false,message,code},{status});
export function apiError(error:unknown){console.error(error); if(error instanceof Error&&error.message==='UNAUTHORIZED')return fail('请先登录','UNAUTHORIZED',401);if(error instanceof Error&&error.message==='FORBIDDEN')return fail('无权执行此操作','FORBIDDEN',403);return fail('服务器暂时无法处理请求','INTERNAL_ERROR',500);}
