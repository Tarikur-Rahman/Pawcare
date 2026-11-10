import {field,str,type Row} from '@/lib/types/domain';

export type AppointmentRole='OWNER'|'VET';
export type AppointmentAction='cancel'|'confirm'|'reject'|'complete'|'no-show';
export type AppointmentFilter='ALL'|'UPCOMING'|'PAST'|'REQUESTED'|'CONFIRMED'|'COMPLETED'|'CANCELLED'|'REJECTED'|'NO_SHOW';
export type BookingValues={petId:string;vetId:string;startsAt:string;endsAt:string;reason:string};
export type BookingPayload={petId:number;vetId:number;startsAt:string;endsAt:string;reason:string|null};
export const EMPTY_BOOKING:BookingValues={petId:'',vetId:'',startsAt:'',endsAt:'',reason:''};
const MAX_VISIT_MS=8*60*60*1000;
const ACTIVE_STATUSES=['REQUESTED','CONFIRMED'];
const DONE_STATUSES=['COMPLETED','CANCELLED','REJECTED','NO_SHOW'];

export class BookingFormError extends Error{
 constructor(public field:keyof BookingValues,message:string){super(message);this.name='BookingFormError';}
}

/** Reject dates that Date would silently normalize, including non-existent local wall-clock times. */
export function bookingInstant(value:string,fieldName:'startsAt'|'endsAt'):Date{
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
 if(!match)throw new BookingFormError(fieldName,'Choose a valid local date and time.');
 const [y,m,d,h,minute]=match.slice(1).map(Number);
 if(y<100||m<1||m>12||d<1||d>31||h>23||minute>59)
  throw new BookingFormError(fieldName,'Choose a valid local date and time.');
 const instant=new Date(y,m-1,d,h,minute,0,0);
 if(!Number.isFinite(instant.getTime())||instant.getFullYear()!==y||instant.getMonth()!==m-1||instant.getDate()!==d||instant.getHours()!==h||instant.getMinutes()!==minute)
  throw new BookingFormError(fieldName,'Choose a valid local date and time.');
 return instant;
}

function positiveId(value:string,fieldName:'petId'|'vetId'):number{
 if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value)))throw new BookingFormError(fieldName,`Choose a valid ${fieldName==='petId'?'pet':'veterinarian'}.`);
 return Number(value);
}

/** Matches BookingRequest(PetId,VetId,StartsAt,EndsAt,Reason) and backend duration constraints. */
export function bookingPayload(values:BookingValues,now=new Date()):BookingPayload{
 const petId=positiveId(values.petId,'petId');
 const vetId=positiveId(values.vetId,'vetId');
 const start=bookingInstant(values.startsAt,'startsAt');
 const end=bookingInstant(values.endsAt,'endsAt');
 if(start.getTime()<=now.getTime())throw new BookingFormError('startsAt','Choose a future appointment start time.');
 if(end.getTime()<=start.getTime())throw new BookingFormError('endsAt','The appointment must end after it starts.');
 if(end.getTime()-start.getTime()>MAX_VISIT_MS)throw new BookingFormError('endsAt','Appointments cannot exceed 8 hours.');
 const reason=values.reason.trim();
 if(reason.length>1000||new TextEncoder().encode(reason).length>1000)throw new BookingFormError('reason','Reason must fit within 1,000 UTF-8 bytes.');
 return {petId,vetId,startsAt:start.toISOString(),endsAt:end.toISOString(),reason:reason||null};
}

export function appointmentStatus(appointment:Row):string{
 return str(appointment,'status').toUpperCase();
}
export function appointmentId(appointment:Row):string{
 const id=String(field(appointment,'id')??'');
 return /^[1-9]\d*$/.test(id)?id:'';
}
export function allowedAppointmentActions(appointment:Row,role:AppointmentRole):AppointmentAction[]{
 if(!appointmentId(appointment))return [];
 const status=appointmentStatus(appointment);
 if(role==='OWNER')return ACTIVE_STATUSES.includes(status)?['cancel']:[];
 if(status==='REQUESTED')return ['confirm','reject'];
 if(status==='CONFIRMED')return ['complete','no-show'];
 return [];
}
export function appointmentSummary(items:Row[],now=new Date()){
 return {requested:items.filter(item=>appointmentStatus(item)==='REQUESTED').length,
  confirmed:items.filter(item=>appointmentStatus(item)==='CONFIRMED').length,
  upcoming:items.filter(item=>ACTIVE_STATUSES.includes(appointmentStatus(item))&&Date.parse(str(item,'endsAt'))>=now.getTime()).length,
  completed:items.filter(item=>appointmentStatus(item)==='COMPLETED').length};
}
export function formatAppointmentTime(value:unknown):string{
 const epoch=Date.parse(typeof value==='string'?value:'');
 return Number.isFinite(epoch)?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(epoch)):'Date unavailable';
}
export function filterAppointments(items:Row[],filter:AppointmentFilter,search:string,petNames:Map<string,string>,vetNames:Map<string,string>,now=new Date()):Row[]{
 const query=search.trim().toLocaleLowerCase();
 return items.filter(item=>{
  const status=appointmentStatus(item);
  const start=Date.parse(str(item,'startsAt'));
  const end=Date.parse(str(item,'endsAt'));
  const upcoming=ACTIVE_STATUSES.includes(status)&&Number.isFinite(end)&&end>=now.getTime();
  const past=DONE_STATUSES.includes(status)||(ACTIVE_STATUSES.includes(status)&&Number.isFinite(end)&&end<now.getTime());
  const accepted=filter==='ALL'||filter==='UPCOMING'&&upcoming||filter==='PAST'&&past||status===filter;
  return accepted&&(!query||[
   appointmentId(item),status,str(item,'reason'),str(item,'petId'),str(item,'vetId'),
   petNames.get(str(item,'petId'))??'',vetNames.get(str(item,'vetId'))??'',
  ].some(text=>text.toLocaleLowerCase().includes(query)));
 }).sort((a,b)=>{
  const ap=ACTIVE_STATUSES.includes(appointmentStatus(a))&&Date.parse(str(a,'endsAt'))>=now.getTime();
  const bp=ACTIVE_STATUSES.includes(appointmentStatus(b))&&Date.parse(str(b,'endsAt'))>=now.getTime();
  if(ap!==bp)return ap?-1:1;
  const at=Date.parse(str(a,'startsAt'));
  const bt=Date.parse(str(b,'startsAt'));
  return ap?(Number.isFinite(at)?at:0)-(Number.isFinite(bt)?bt:0):(Number.isFinite(bt)?bt:0)-(Number.isFinite(at)?at:0);
 });
}
