import Link from 'next/link';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {PageHeader,Empty} from '@/components/page';
import {Card} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {SearchForm} from '@/components/search-form';
import {AttendanceProcessingActions} from '@/components/attendance-processing-actions';
import {DailyAttendancePublisher} from '@/components/daily-attendance-publisher';
import {dateTime,startOfChinaDay} from '@/lib/utils';

const typeText:Record<string,string>={LATE:'迟到',EARLY_LEAVE:'早退',ABSENT:'旷工'},dispositionText:Record<string,string>={PENDING:'处理中',ARCHIVED:'已归档并计入',EXEMPT:'已免除'};
export default async function AttendanceProcessing({searchParams}:{searchParams:Promise<{view?:string;q?:string}>}){
  const u=await requireUser(),admin=u.role.code==='ADMIN',manager=u.role.code==='SALES_MANAGER'||u.role.code==='TECH_MANAGER';
  if(!admin&&!manager)throw new Error('FORBIDDEN');
  const params=await searchParams,view=params.view==='processed'?'processed':'pending',q=params.q?.trim()||'',scope=admin?{}:{attendance:{user:{departmentId:u.departmentId}}},search=q?{OR:[{attendance:{user:{name:{contains:q,mode:'insensitive' as const}}}},{attendance:{user:{department:{name:{contains:q,mode:'insensitive' as const}}}}},{reason:{contains:q,mode:'insensitive' as const}}]}:{};
  const where=view==='pending'?{...scope,...search,status:admin?'PENDING_ADMIN' as const:'PENDING_MANAGER' as const,disposition:'PENDING' as const}:admin?{...scope,...search,disposition:{in:['ARCHIVED' as const,'EXEMPT' as const]}}:{...scope,...search,approvals:{some:{approverId:u.id}}};
  const [items,todayRequirement]=await Promise.all([db.attendanceException.findMany({where,include:{attendance:{include:{user:{include:{department:true}}}},approvals:{include:{approver:{select:{name:true}}},orderBy:{createdAt:'asc'}}},orderBy:{updatedAt:'desc'},take:500}),admin?db.dailyAttendanceRequirement.findUnique({where:{date:startOfChinaDay()}}):Promise.resolve(null)]),suffix=q?`&q=${encodeURIComponent(q)}`:'';
  return <><PageHeader title="考勤处理" description={admin?'发布今日签到签退，并处理所有人的考勤异常':'只处理本部门员工的考勤异常'}/>{admin&&<DailyAttendancePublisher requireCheckIn={Boolean(todayRequirement?.requireCheckIn)} requireCheckOut={Boolean(todayRequirement?.requireCheckOut)}/>}<div className="mb-5 flex gap-2"><Link href={`/attendance-processing?view=pending${suffix}`} className={`rounded-lg px-4 py-2 text-sm ${view==='pending'?'bg-zinc-950 text-white':'border bg-white'}`}>待处理</Link><Link href={`/attendance-processing?view=processed${suffix}`} className={`rounded-lg px-4 py-2 text-sm ${view==='processed'?'bg-zinc-950 text-white':'border bg-white'}`}>已处理</Link></div><SearchForm defaultValue={q} placeholder="搜索员工、部门或异常原因" hidden={{view}} clearHref={`/attendance-processing?view=${view}`}/>{items.length?<div className="space-y-3">{items.map(item=><Card key={item.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-medium">{item.attendance.user.name} · {typeText[item.type]}</p><p className="mt-1 text-sm text-zinc-500">{item.attendance.user.department?.name||'—'} · {item.attendance.date.toLocaleDateString('zh-CN')} · 原因：{item.reason||'员工尚未填写'}</p><p className="mt-2 text-xs text-zinc-400">{item.approvals.length?item.approvals.map(a=>`${a.approver.name} ${a.result}${a.comment?`（${a.comment}）`:''}`).join(' → '):'暂无处理记录'} · 更新于 {dateTime(item.updatedAt)}</p></div>{view==='pending'?<AttendanceProcessingActions id={item.id}/>:<Badge className={item.disposition==='EXEMPT'?'bg-emerald-50 text-emerald-700':''}>{dispositionText[item.disposition]}</Badge>}</div></Card>)}</div>:<Empty text={q?'没有匹配的考勤事项':view==='pending'?'暂无待处理考勤':'暂无已处理考勤'}/>}</>;
}
