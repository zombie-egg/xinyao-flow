import { SignJWT, jwtVerify } from 'jose'; import { cookies } from 'next/headers'; import { db } from './db'; import type { RoleCode } from '@prisma/client';
const secret=new TextEncoder().encode(process.env.AUTH_SECRET||'development-secret-change-me-32chars');
export const SESSION_COOKIE='enterprise_session';
export async function createSession(userId:string){return new SignJWT({userId}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('8h').sign(secret)}
export async function currentUser(){const token=(await cookies()).get(SESSION_COOKIE)?.value;if(!token)return null;try{const {payload}=await jwtVerify(token,secret);return db.user.findFirst({where:{id:String(payload.userId),status:'ACTIVE'},include:{role:{include:{permissions:{include:{permission:true}}}},department:true}})}catch{return null}}
export async function requireUser(){const user=await currentUser();if(!user)throw new Error('UNAUTHORIZED');return user}
export async function requirePermission(code:string){const user=await requireUser();if(user.role.code==='ADMIN')return user;if(!user.role.permissions.some(p=>p.permission.code===code))throw new Error('FORBIDDEN');return user}
export const isManager=(role:RoleCode)=>role.endsWith('_MANAGER');
