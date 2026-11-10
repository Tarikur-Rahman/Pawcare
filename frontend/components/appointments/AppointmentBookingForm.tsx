'use client';
import {useState,type ChangeEvent,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {str,type Row} from '@/lib/types/domain';
import {BookingFormError,EMPTY_BOOKING,bookingPayload,type BookingValues} from '@/lib/appointments/booking';
import {Button} from '@/components/ui/Button';
import {FormField} from '@/components/ui/FormField';

type Props={pets:Row[];vets:Row[];onBooked:()=>void};
const keys=Object.keys(EMPTY_BOOKING) as (keyof BookingValues)[];

export function AppointmentBookingForm({pets,vets,onBooked}:Props){
 const [values,setValues]=useState<BookingValues>({...EMPTY_BOOKING});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Partial<Record<keyof BookingValues,string>>>({});
 const [notice,setNotice]=useState('');
 function update(key:keyof BookingValues,value:string){
  setValues(old=>({...old,[key]:value}));setError('');setNotice('');setFieldErrors(old=>({...old,[key]:undefined}));
 }
 const change=(key:keyof BookingValues)=>(event:ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>update(key,event.target.value);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setError('');setNotice('');setFieldErrors({});
  try{
   if(!pets.some(p=>str(p,'id')===values.petId))throw new BookingFormError('petId','Choose one of your active pets.');
   if(!vets.some(v=>str(v,'id','userId')===values.vetId))throw new BookingFormError('vetId','Choose an available veterinarian.');
   const body=bookingPayload(values);
   setBusy(true);
   await api('/appointments',{method:'POST',body});
   setValues({...EMPTY_BOOKING});setNotice('Appointment requested. Your veterinarian must confirm it.');onBooked();
  }catch(caught){
   if(caught instanceof BookingFormError)setFieldErrors({[caught.field]:caught.message});
   else if(caught instanceof ApiError){
    setError(caught.message);
    const mapped:Partial<Record<keyof BookingValues,string>>={};
    for(const [key,messages] of Object.entries(caught.fieldErrors??{})){
     const name=keys.find(item=>item.toLowerCase()===key.toLowerCase());
     if(name)mapped[name]=messages.join(' ');
    }
    setFieldErrors(mapped);
   }else setError(caught instanceof Error?caught.message:'Unable to request an appointment.');
  }finally{setBusy(false);}
 }
 const disabled=busy||pets.length===0||vets.length===0;
 return <form className="action-form appointment-form" aria-label="Book a veterinary appointment" noValidate onSubmit={submit}>
  <h2>Request a visit</h2>
  <p className="hint">Your request is not confirmed until the veterinarian accepts it. The backend checks for overlapping bookings.</p>
  <div className="form-grid">
   <FormField name="petId" label="Pet" as="select" required value={values.petId} onChange={change('petId')} disabled={disabled} error={fieldErrors.petId} options={pets.map(p=>({value:str(p,'id'),label:str(p,'name')}))}/>
   <FormField name="vetId" label="Veterinarian" as="select" required value={values.vetId} onChange={change('vetId')} disabled={disabled} error={fieldErrors.vetId} options={vets.map(v=>({value:str(v,'id','userId'),label:str(v,'displayName','name')||`Veterinarian #${str(v,'id','userId')}`}))}/>
   <FormField name="startsAt" label="Start date and time" type="datetime-local" required value={values.startsAt} onChange={change('startsAt')} disabled={disabled} error={fieldErrors.startsAt}/>
   <FormField name="endsAt" label="End date and time" type="datetime-local" required value={values.endsAt} onChange={change('endsAt')} disabled={disabled} error={fieldErrors.endsAt} hint="Duration must be greater than zero and no more than eight hours."/>
   <FormField name="reason" label="Reason for visit (optional)" as="textarea" value={values.reason} onChange={change('reason')} disabled={disabled} error={fieldErrors.reason} maxLength={1000} placeholder="Briefly describe why your pet needs this visit."/>
  </div>
  {error&&<p className="form-alert" role="alert">{error}</p>}
  {notice&&<p className="success-message" role="status">{notice}</p>}
  {!pets.length&&<p className="hint">Add an active pet profile before booking a visit.</p>}
  {!vets.length&&<p className="hint">There are currently no veterinarians available to select.</p>}
  <Button type="submit" loading={busy} disabled={disabled}>Request appointment</Button>
 </form>;
}
