import { clsx, type ClassValue } from 'clsx'; import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export const money=(value:number|string)=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(Number(value));
export const dateTime=(value:Date|string)=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export function haversineMeters(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){const r=6371000,toRad=(v:number)=>v*Math.PI/180;const dLat=toRad(b.latitude-a.latitude),dLon=toRad(b.longitude-a.longitude);const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLon/2)**2;return 2*r*Math.asin(Math.sqrt(x));}
export function startOfChinaDay(date=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);return new Date(`${parts}T00:00:00+08:00`);}
