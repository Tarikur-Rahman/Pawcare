import {field,str,type Row} from '@/lib/types/domain';

export const CARE_TYPES = ['FEEDING','GROOMING','MEDICATION','EXERCISE','HYGIENE','OTHER'] as const;
export type CareType = (typeof CARE_TYPES)[number];
export type Recurrence = '' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type CareFilter = 'ALL' | 'PENDING' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED';
export type CareFormValues = {type:string;title:string;dueAt:string;recurrenceRule:string};
export type CareTaskPayload = {type:CareType;title:string;dueAt:string;recurrenceRule:Exclude<Recurrence,''>|null};
export type CareIndicator = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

export const INITIAL_CARE_FORM:CareFormValues = {type:'FEEDING',title:'',dueAt:'',recurrenceRule:''};
const MAX_TITLE_BYTES=160;
const ONE_DAY=24*60*60*1000;

export class CareFormError extends Error {
 constructor(public field:keyof CareFormValues,message:string){super(message);this.name='CareFormError';}
}

/** Validates a local wall-clock input strictly before converting it to the API's UTC instant. */
export function careDueInstant(value:string):Date {
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
 if(!match)throw new CareFormError('dueAt','Choose a valid due date and time.');
 const [,yy,mm,dd,hh,mi]=match;
 const [y,m,d,h,min]=[yy,mm,dd,hh,mi].map(Number);
 if(y<1||m<1||m>12||d<1||d>31||h>23||min>59)throw new CareFormError('dueAt','Choose a valid due date and time.');
 const instant=new Date(y,m-1,d,h,min,0,0);
 if(!Number.isFinite(instant.getTime())||instant.getFullYear()!==y||instant.getMonth()!==m-1||instant.getDate()!==d||instant.getHours()!==h||instant.getMinutes()!==min)
  throw new CareFormError('dueAt','Choose a valid due date and time.');
 return instant;
}

export function careTaskPayload(values:CareFormValues,now=new Date()):CareTaskPayload {
 const type=values.type.trim().toUpperCase();
 if(!CARE_TYPES.includes(type as CareType))throw new CareFormError('type','Choose a supported care task type.');
 const title=values.title.trim();
 if(!title)throw new CareFormError('title','A task name is required.');
 if(new TextEncoder().encode(title).length>MAX_TITLE_BYTES)
  throw new CareFormError('title',`Task name must fit within ${MAX_TITLE_BYTES} UTF-8 bytes.`);
 const due=careDueInstant(values.dueAt);
 if(due.getTime()<=now.getTime())throw new CareFormError('dueAt','Choose a future due date and time.');
 const recurrence=values.recurrenceRule.trim().toUpperCase();
 if(recurrence!==''&&!['DAILY','WEEKLY','MONTHLY'].includes(recurrence))
  throw new CareFormError('recurrenceRule','Choose no repeat, daily, weekly, or monthly.');
 return {type:type as CareType,title,dueAt:due.toISOString(),recurrenceRule:(recurrence||null) as CareTaskPayload['recurrenceRule']};
}

export function careIndicator(task:Row,now=new Date()):CareIndicator {
 const status=str(task,'status').toUpperCase();
 if(status==='COMPLETED')return 'COMPLETED';
 if(status==='CANCELLED')return 'CANCELLED';
 const due=Date.parse(str(task,'dueAt'));
 if(!Number.isFinite(due))return 'UPCOMING';
 if(due<now.getTime())return 'OVERDUE';
 if(due<=now.getTime()+ONE_DAY)return 'DUE_SOON';
 return 'UPCOMING';
}

export function careSummary(items:Row[],now=new Date()){
 const pending=items.filter(t=>str(t,'status').toUpperCase()==='PENDING');
 return {
  total:items.length, pending:pending.length,
  overdue:pending.filter(t=>careIndicator(t,now)==='OVERDUE').length,
  dueSoon:pending.filter(t=>careIndicator(t,now)==='DUE_SOON').length,
  completed:items.filter(t=>str(t,'status').toUpperCase()==='COMPLETED').length,
  cancelled:items.filter(t=>str(t,'status').toUpperCase()==='CANCELLED').length,
 };
}

export function filterCareTasks(items:Row[],filter:CareFilter,query='',now=new Date()):Row[] {
 const q=query.trim().toLocaleLowerCase();
 return items.filter(task=>{
  const status=str(task,'status').toUpperCase();
  const matches=filter==='ALL'||filter==='OVERDUE'&&careIndicator(task,now)==='OVERDUE'||filter===status;
  return matches&&(!q||[str(task,'title'),str(task,'type'),str(task,'recurrenceRule')].some(v=>v.toLocaleLowerCase().includes(q)));
 }).sort((a,b)=>{
  const activeA=str(a,'status').toUpperCase()==='PENDING';
  const activeB=str(b,'status').toUpperCase()==='PENDING';
  if(activeA!==activeB)return activeA?-1:1;
  const aDate=Date.parse(str(a,'dueAt'));
  const bDate=Date.parse(str(b,'dueAt'));
  const aTime=Number.isFinite(aDate)?aDate:0;
  const bTime=Number.isFinite(bDate)?bDate:0;
  return activeA?aTime-bTime:bTime-aTime;
 });
}

export function careTaskId(task:Row):string {
 const id=field(task,'id');
 const text=String(id??'');
 return /^[1-9]\d*$/.test(text)?text:'';
}

export function formatCareTime(value:unknown):string {
 const time=Date.parse(typeof value==='string'?value:'');
 return Number.isFinite(time)?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(time)):'Date unavailable';
}
