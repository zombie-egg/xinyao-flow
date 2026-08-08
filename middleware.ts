import { NextResponse,type NextRequest } from 'next/server'; import { SESSION_COOKIE } from './lib/auth';
export function middleware(req:NextRequest){const logged=Boolean(req.cookies.get(SESSION_COOKIE));if(!logged)return NextResponse.redirect(new URL('/login',req.url));return NextResponse.next()}
export const config={matcher:['/((?!api|login|register|_next/static|_next/image|favicon.ico).*)']};
