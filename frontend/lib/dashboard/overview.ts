import {field,str,type Row} from '@/lib/types/domain';

const ACTIVE_VISIT_STATUSES=new Set(['REQUESTED','CONFIRMED']);

/** Summary values come from /reports/dashboard; never invent a zero when that API failed. */
export function dashboardCount(report:Row|null,key:string):string{
 if(!report)return '—';
 const raw=field(report,key);
 if((typeof raw!=='number'&&typeof raw!=='string')||String(raw).trim()==='')return '—';
 const text=String(raw).trim();
 if(!/^\d+$/.test(text))return '—';
 const value=Number(text);
 return Number.isSafeInteger(value)?String(value):'—';
}

export function activePets(items:Row[]):Row[]{
 return items.filter(p=>(str(p,'status')||'ACTIVE').toUpperCase()==='ACTIVE');
}

/** Read-only preview: keep only upcoming, active appointments with valid timestamps. */
export function nextVisits(items:Row[],now=new Date(),limit=3):Row[]{
 return items.filter(item=>{
  const status=str(item,'status').toUpperCase();
  const start=Date.parse(str(item,'startsAt'));
  const end=Date.parse(str(item,'endsAt'));
  return ACTIVE_VISIT_STATUSES.has(status)&&Number.isFinite(start)&&Number.isFinite(end)&&end>=now.getTime();
 }).sort((a,b)=>Date.parse(str(a,'startsAt'))-Date.parse(str(b,'startsAt'))).slice(0,Math.max(0,limit));
}

/** Never pretend a read notification is unread; a null/empty readAt means unread. */
export function unreadPreview(items:Row[],limit=3):Row[]{
 return items.filter(item=>{
  const value=field(item,'readAt');
  return value===null||value===undefined||value==='';
 }).sort((a,b)=>{
  const left=Date.parse(str(a,'createdAt'));
  const right=Date.parse(str(b,'createdAt'));
  return (Number.isFinite(right)?right:0)-(Number.isFinite(left)?left:0);
 }).slice(0,Math.max(0,limit));
}
