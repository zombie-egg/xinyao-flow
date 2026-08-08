import Link from 'next/link';
import {requireUser,isManager} from '@/lib/auth';
import {db} from '@/lib/db';
import {PageHeader,Empty} from '@/components/page';
import {Card} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {ApprovalActions} from '@/components/approval-actions';
import {SearchForm} from '@/components/search-form';
import {approvalText,leaveTypeText} from '@/lib/chinese-labels';
import {dateTime} from '@/lib/utils';

export default async function Approvals({searchParams}:{searchParams:Promise<{view?:string;q?:string}>}){
  const u=await requireUser();
  if(u.role.code!=='ADMIN'&&!isManager(u.role.code))throw new Error('FORBIDDEN');
  const params=await searchParams,view=params.view==='processed'?'processed':'pending',q=params.q?.trim()||'',suffix=q?`&q=${encodeURIComponent(q)}`:'';

  if(view==='processed'){
    const searchFilter=q?{OR:[
      {leaveRequest:{is:{user:{name:{contains:q,mode:'insensitive' as const}}}}},
      {leaveRequest:{is:{user:{department:{name:{contains:q,mode:'insensitive' as const}}}}}},
      {leaveRequest:{is:{reason:{contains:q,mode:'insensitive' as const}}}},
      {leaveRequest:{is:{destination:{contains:q,mode:'insensitive' as const}}}},
      {attendanceException:{is:{attendance:{user:{name:{contains:q,mode:'insensitive' as const}}}}}},
      {attendanceException:{is:{attendance:{user:{department:{name:{contains:q,mode:'insensitive' as const}}}}}}},
    ]}:{};
    const records=await db.leaveApproval.findMany({
      where:{approverId:u.id,AND:[{OR:[{leaveRequestId:{not:null}},{attendanceExceptionId:{not:null}}]},searchFilter]},
      include:{
        leaveRequest:{include:{user:{include:{department:true}}}},
        attendanceException:{
          include:{attendance:{include:{user:{include:{department:true}}}}},
        },
      },
      orderBy:{createdAt:'desc'},take:500,
    });
    return <><PageHeader title="审批中心" description="保留本人处理过的请假和考勤异常审批记录"/><div className="mb-5 flex gap-2"><Link href={`/approvals?view=pending${suffix}`} className="rounded-lg border bg-white px-4 py-2 text-sm">待处理</Link><Link href={`/approvals?view=processed${suffix}`} className="rounded-lg bg-zinc-950 px-4 py-2 text-sm text-white">已处理</Link></div><SearchForm defaultValue={q} placeholder="搜索申请人、部门、原因或出差地点" hidden={{view}} clearHref="/approvals?view=processed"/>{records.length?<div className="space-y-3">{records.map(record=>{const leave=record.leaveRequest,exception=record.attendanceException,employee=leave?.user||exception?.attendance.user;return <Card key={record.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{employee?.name} · {leave?`${leaveTypeText[leave.type]} · ${Number(leave.days)} 天`:exception?.type==='LATE'?'迟到异常':'旷工异常'}</p><p className="mt-1 text-sm text-zinc-500">{employee?.department?.name||'—'} · {leave?`${leave.startDate.toLocaleDateString('zh-CN')} 至 ${leave.endDate.toLocaleDateString('zh-CN')}`:exception?.attendance.date.toLocaleDateString('zh-CN')}</p><p className="mt-2 text-xs text-zinc-500">审批意见：{record.comment||'无'} · 处理时间：{dateTime(record.createdAt)}</p></div><div className="flex gap-2"><Badge className={record.result==='APPROVE'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700'}>{record.result==='APPROVE'?'已通过':'已驳回'}</Badge>{leave&&<Badge>{approvalText[leave.status]}</Badge>}{exception&&<Badge>{approvalText[exception.status]}</Badge>}</div></div></Card>})}</div>:<Empty text={q?'没有匹配的已处理记录':'暂无已处理审批'}/>}</>;
  }

  const leaveWhere={
    ...(u.role.code==='ADMIN'?{status:'PENDING_ADMIN' as const}:{status:'PENDING_MANAGER' as const,user:{departmentId:u.departmentId}}),
    ...(q?{OR:[{user:{name:{contains:q,mode:'insensitive' as const}}},{user:{department:{name:{contains:q,mode:'insensitive' as const}}}},{reason:{contains:q,mode:'insensitive' as const}},{destination:{contains:q,mode:'insensitive' as const}},{remark:{contains:q,mode:'insensitive' as const}}]}:{}),
  };
  const exceptionWhere={
    ...(u.role.code==='ADMIN'?{status:'PENDING_ADMIN' as const}:{status:'PENDING_MANAGER' as const,attendance:{user:{departmentId:u.departmentId}}}),
    ...(q?{OR:[{attendance:{user:{name:{contains:q,mode:'insensitive' as const}}}},{attendance:{user:{department:{name:{contains:q,mode:'insensitive' as const}}}}}]}:{}),
  };
  const [leaves,exceptions]=await Promise.all([
    db.leaveRequest.findMany({where:leaveWhere,include:{user:{include:{department:true}}},orderBy:{createdAt:'asc'},take:300}),
    db.attendanceException.findMany({
      where:exceptionWhere,
      include:{attendance:{include:{user:{include:{department:true}}}}},
      orderBy:{createdAt:'asc'},take:300,
    }),
  ]);
  return <><PageHeader title="审批中心" description={u.role.code==='ADMIN'?'管理员最终审批':'仅显示本部门员工待审批事项'}/><div className="mb-5 flex gap-2"><Link href={`/approvals?view=pending${suffix}`} className="rounded-lg bg-zinc-950 px-4 py-2 text-sm text-white">待处理</Link><Link href={`/approvals?view=processed${suffix}`} className="rounded-lg border bg-white px-4 py-2 text-sm">已处理</Link></div><SearchForm defaultValue={q} placeholder="搜索申请人、部门、原因或出差地点" hidden={{view}} clearHref="/approvals?view=pending"/>{!leaves.length&&!exceptions.length?<Empty text={q?'没有匹配的待审批事项':'没有待审批事项'}/>:<div className="space-y-3">{leaves.map(x=><Card key={x.id} className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-medium">{x.user.name} · {leaveTypeText[x.type]} · {Number(x.days)} 天</p><p className="mt-1 text-sm text-zinc-500">{x.user.department?.name} · {x.reason||x.destination||x.remark||'无补充说明'}</p></div><ApprovalActions id={x.id}/></Card>)}{exceptions.map(x=><Card key={x.id} className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-medium">{x.attendance.user.name} · {x.type==='LATE'?'迟到异常':'旷工异常'}</p><p className="mt-1 text-sm text-zinc-500">{x.attendance.user.department?.name} · {x.attendance.date.toLocaleDateString('zh-CN')}</p></div><ApprovalActions id={x.id} kind="exception"/></Card>)}</div>}</>;
}
