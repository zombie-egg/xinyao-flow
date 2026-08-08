import { cn } from '@/lib/utils'; import type { HTMLAttributes } from 'react';
export function Card({className,...p}:HTMLAttributes<HTMLDivElement>){return <div className={cn('rounded-xl border border-zinc-200 bg-white p-5 shadow-sm',className)} {...p}/>}
