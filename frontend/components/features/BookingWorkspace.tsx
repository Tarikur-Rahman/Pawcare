'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {CalendarClock,RefreshCw,Search} from 'lucide-react';
import {api} from '@/lib/api/client';
import {rows,str,type Row} from '@/lib/types/domain';
import {
 allowedAppointmentActions,appointmentId,appointmentStatus,appointmentSummary,
 filterAppointments,formatAppointmentTime,type AppointmentAction,type AppointmentFilter,
} from '@/lib/appointments/booking';
import {AppointmentBookingForm} from '@/components/appointments/AppointmentBookingForm';
import {Button} from '@/components/ui/Button';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';
import {StatusBadge} from '@/components/ui/StatusBadge';

const FILTERS:{value:AppointmentFilter;label:string}[]=[
 {value:'UPCOMING',label:'Upcoming'},{value:'ALL',label:'All'},
 {value:'REQUESTED',label:'Requested'},{value:'CONFIRMED',label:'Confirmed'},
 {value:'COMPLETED',label:'Completed'},{value:'PAST',label:'Past / closed'},
];
const ACTION_LABEL:Record<AppointmentAction,string>={
 cancel:'Cancel appointment',confirm:'Confirm visit',reject:'Reject request',complete:'Complete visit','no-show':'Mark no-show',
};
const ACTION_NOTICE:Record<AppointmentAction,string>={
 cancel:'Appointment cancelled.',confirm:'Appointment confirmed.',reject:'Appointment rejected.',
 complete:'Appointment marked completed.','no-show':'Appointment marked no-show.',
};
const NEED_CONFIRMATION:AppointmentAction[]=['cancel','reject','no-show'];

type PendingAction={id:string;kind:AppointmentAction};
export function BookingWorkspace({vet=false}:{vet?:boolean}){
 const [appointments,setAppointments]=useState<Row[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 const [pets,setPets]=useState<Row[]>([]);
 const [vets,setVets]=useState<Row[]>([]);
 const [lookupLoading,setLookupLoading]=useState(!vet);
 const [lookupError,setLookupError]=useState('');
 const [lookupRefresh,setLookupRefresh]=useState(0);
 const [filter,setFilter]=useState<AppointmentFilter>('UPCOMING');
 const [search,setSearch]=useState('');
 const [pending,setPending]=useState<PendingAction|null>(null);
 const [busyId,setBusyId]=useState('');
 const [actionError,setActionError]=useState('');
 const [notice,setNotice]=useState('');

 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  api('/appointments',{signal:controller.signal}).then(result=>{
   if(!controller.signal.aborted)setAppointments(rows(result));
  }).catch(caught=>{
   if(!controller.signal.aborted)setError(caught instanceof Error?caught.message:'Unable to load appointments.');
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[refresh]);

 useEffect(()=>{
  if(vet){setLookupLoading(false);return;}
  const controller=new AbortController();setLookupLoading(true);setLookupError('');
  Promise.all([api('/pets',{signal:controller.signal}),api('/vets',{signal:controller.signal})])
   .then(([petData,vetData])=>{
    if(controller.signal.aborted)return;
    setPets(rows(petData).filter(p=>(str(p,'status')||'ACTIVE').toUpperCase()==='ACTIVE'));
    setVets(rows(vetData));
   }).catch(caught=>{
    if(!controller.signal.aborted){setPets([]);setVets([]);setLookupError(caught instanceof Error?caught.message:'Unable to load pets and veterinarians.');}
   }).finally(()=>{if(!controller.signal.aborted)setLookupLoading(false);});
  return ()=>controller.abort();
 },[vet,lookupRefresh]);

 const petNames=useMemo(()=>new Map(pets.map(p=>[str(p,'id'),str(p,'name')])),[pets]);
 const vetNames=useMemo(()=>new Map(vets.map(v=>[str(v,'id','userId'),str(v,'displayName','name')])),[vets]);
 const summary=appointmentSummary(appointments);
 const visible=filterAppointments(appointments,filter,search,petNames,vetNames);
 function reload(){setRefresh(n=>n+1);}

 async function act(id:string,kind:AppointmentAction){
  if(busyId||!id||!/^[1-9]\d*$/.test(id))return;
  // Recheck against the currently loaded item so no terminal visit can be acted upon.
  const appointment=appointments.find(item=>appointmentId(item)===id);
  if(!appointment||!allowedAppointmentActions(appointment,vet?'VET':'OWNER').includes(kind))return;
  setActionError('');setNotice('');setBusyId(id);
  try{
   await api(`/appointments/${id}/${kind}`,{method:'POST'});
   setPending(null);setNotice(ACTION_NOTICE[kind]);reload();
  }catch(caught){setActionError(caught instanceof Error?caught.message:'Unable to update appointment.');}
  finally{setBusyId('');}
 }

 return <section className="page-section">
  <div className="page-heading"><div><span className="eyebrow">VETERINARY APPOINTMENTS</span><h1>{vet?'Your visit queue':'Appointments'}</h1>
   <p>{vet?'Review assigned requests and record the outcome of confirmed visits.':'Request veterinary visits, track confirmations, and manage your bookings.'}</p></div>
   <Button variant="secondary" disabled={loading} onClick={reload}><RefreshCw size={16} aria-hidden="true"/>Refresh</Button>
  </div>
  {notice&&<p className="success-message appointment-notice" role="status">{notice}</p>}
  {actionError&&<ErrorState message={actionError} onRetry={()=>setActionError('')}/>}
  <div className="appointment-stats" aria-label="Appointment summary">
   <div><strong>{summary.upcoming}</strong><span>Upcoming</span></div>
   <div><strong>{summary.requested}</strong><span>Awaiting confirmation</span></div>
   <div><strong>{summary.confirmed}</strong><span>Confirmed</span></div>
   <div><strong>{summary.completed}</strong><span>Completed</span></div>
  </div>
  <div className={`dashboard-lower appointment-layout${vet?' appointment-vet-layout':''}`}>
   <div className="panel appointment-list-panel">
    <div className="medical-section-header"><div><h2>{vet?'Assigned visits':'Your visits'}</h2><p>Appointment requests and their current status.</p></div></div>
    <div className="appointment-toolbar">
     <div className="medical-filters" aria-label="Filter appointments">{FILTERS.map(item=><button key={item.value} type="button" className={`medical-filter${filter===item.value?' selected':''}`} aria-pressed={filter===item.value} onClick={()=>{setFilter(item.value);setPending(null);}}>{item.label}</button>)}</div>
     <label className="appointment-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Search appointments</span><input className="form-input" type="search" placeholder="Search visits" aria-label="Search appointments" value={search} onChange={event=>setSearch(event.target.value)}/></label>
    </div>
    {loading?<p role="status" className="hint">Loading appointments…</p>:error?<ErrorState message={error} onRetry={reload}/>:
     !visible.length?<EmptyState title={appointments.length?'No matching appointments':'No appointments yet'} description={appointments.length?'Try another filter or search term.':vet?'Assigned visits will appear when owners request appointments.':'Book a visit to start tracking your veterinary appointments.'}/>
     :<ul className="appointment-list">{visible.map(appointment=>{
      const id=appointmentId(appointment);
      const petId=str(appointment,'petId');
      const vetId=str(appointment,'vetId');
      const actions=allowedAppointmentActions(appointment,vet?'VET':'OWNER');
      const confirmation=pending?.id===id?pending:null;
      return <li className="appointment-row" key={id}>
       <div className="appointment-main">
        <div className="appointment-title"><strong>{vet?`Pet #${petId}`:petNames.get(petId)||`Pet #${petId}`}</strong><StatusBadge status={appointmentStatus(appointment)}/></div>
        <p><CalendarClock size={15} aria-hidden="true"/> {formatAppointmentTime(str(appointment,'startsAt'))} – {formatAppointmentTime(str(appointment,'endsAt'))}</p>
        {!vet&&<p>Veterinarian: {vetNames.get(vetId)||`#${vetId}`}</p>}
        {str(appointment,'reason')&&<p className="appointment-reason">Reason: {str(appointment,'reason')}</p>}
        <small className="hint">Booking #{id}</small>
       </div>
       <div className="appointment-actions">
        {confirmation?<div className="appointment-confirm"><span>Are you sure you want to {confirmation.kind==='no-show'?'mark this visit as no-show':confirmation.kind==='reject'?'reject this request':'cancel this appointment'}?</span>
         <Button type="button" variant="danger" disabled={!!busyId} loading={busyId===id} onClick={()=>void act(id,confirmation.kind)}>Confirm {confirmation.kind==='no-show'?'no-show':confirmation.kind}</Button>
         <Button type="button" variant="ghost" disabled={!!busyId} onClick={()=>setPending(null)}>Keep appointment</Button>
        </div>:actions.map(kind=><Button key={kind} type="button" variant={NEED_CONFIRMATION.includes(kind)?'danger':'secondary'} disabled={!!busyId} loading={busyId===id} onClick={()=>NEED_CONFIRMATION.includes(kind)?(setPending({id,kind}),setActionError(''),setNotice('')):void act(id,kind)}>{ACTION_LABEL[kind]}</Button>)}
        {!actions.length&&<span className="hint">No actions available</span>}
       </div>
      </li>;
     })}</ul>}
   </div>
   {!vet&&<aside className="panel appointment-booking-panel">
    {lookupLoading?<p role="status" className="hint">Loading pets and veterinarians…</p>:
     lookupError?<ErrorState message={lookupError} onRetry={()=>setLookupRefresh(n=>n+1)}/>:
     <><AppointmentBookingForm pets={pets} vets={vets} onBooked={reload}/>
      {!pets.length&&<Link href="/pets" className="inline-link">Manage pets</Link>}</>}
   </aside>}
  </div>
 </section>;
}
