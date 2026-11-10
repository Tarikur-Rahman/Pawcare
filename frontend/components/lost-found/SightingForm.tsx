'use client';
import {useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {FormField} from '@/components/ui/FormField';
import {lostId,sightingPayload,LostFormError,type SightingFields} from '@/lib/lost-found/reports';
const blank:SightingFields={approximateArea:'',observedAt:'',description:''};
export function SightingForm({id}:{id:string}){
 const [values,setValues]=useState<SightingFields>(blank),[errors,setErrors]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setErrors({});setError('');setNotice('');
  const safe=lostId(id);
  if(!safe){setError('Invalid report ID.');return;}
  let body;
  try{body=sightingPayload(values);}catch(caught){if(caught instanceof LostFormError)setErrors({[caught.field]:caught.message});else setError('Invalid sighting details.');return;}
  setBusy(true);
  try{
   await api(`/lost-found/${safe}/sightings`,{method:'POST',body});
   setValues({...blank});setNotice('Sighting submitted privately. The report owner can review it; no reunion has been confirmed.');
  }catch(caught){
   if(caught instanceof ApiError&&caught.fieldErrors)setErrors(Object.fromEntries(Object.entries(caught.fieldErrors).map(([k,v])=>[k,v.join(' ')])));
   setError(caught instanceof Error?caught.message:'Unable to submit this sighting.');
  }finally{setBusy(false);}
 }
 return <form className="action-form" onSubmit={submit}><h3>Report a private sighting</h3>
  <p className="hint">Use an approximate area, not an address. The report owner—not the public—can read your details.</p>
  <FormField name="sightingArea" label="Approximate area" required maxLength={160} disabled={busy}
   value={values.approximateArea} onChange={e=>setValues(v=>({...v,approximateArea:e.target.value}))} error={errors.approximateArea}/>
  <FormField name="sightingObservedAt" label="When did you see the pet?" type="datetime-local" required disabled={busy}
   value={values.observedAt} onChange={e=>setValues(v=>({...v,observedAt:e.target.value}))} error={errors.observedAt}/>
  <FormField name="sightingDescription" label="What did you see?" as="textarea" required maxLength={2000} disabled={busy}
   value={values.description} onChange={e=>setValues(v=>({...v,description:e.target.value}))} error={errors.description}/>
  {error&&<p role="alert" className="form-alert">{error}</p>}{notice&&<p role="status" className="success-message">{notice}</p>}
  <button className="btn btn-primary" type="submit" disabled={busy||!lostId(id)}>{busy?'Submitting…':'Submit sighting privately'}</button>
 </form>;
}
