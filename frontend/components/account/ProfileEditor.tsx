'use client';

import {useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {profilePayload,profileToFields,AccountInputError,type ProfileFields} from '@/lib/account/records';
import {FormField} from '@/components/ui/FormField';
import {Button} from '@/components/ui/Button';
import type {Row} from '@/lib/types/domain';

export function ProfileEditor({profile,onSaved}:{profile:Row;onSaved:(value:Row)=>void}){
 const [values,setValues]=useState<ProfileFields>(()=>profileToFields(profile));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 function update(key:keyof ProfileFields,value:string){setValues(prev=>({...prev,[key]:value}));setFieldErrors(prev=>({...prev,[key]:''}));setSuccess('');}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setError('');setSuccess('');setFieldErrors({});
  let body;
  try{body=profilePayload(values);}catch(caught){
   if(caught instanceof AccountInputError)setFieldErrors({[caught.fieldName]:caught.message});
   else setError('Please check your profile details.');
   return;
  }
  setBusy(true);
  try{
   const updated=await api<Row>('/users/me',{method:'PATCH',body});
   if(!updated||typeof updated!=='object'||Array.isArray(updated))throw new Error('The server returned an invalid profile. Refresh to verify the update.');
   setValues(profileToFields(updated));onSaved(updated);setSuccess('Profile saved successfully.');
  }catch(caught){
   if(caught instanceof ApiError){
    setError(caught.message);
    setFieldErrors(Object.fromEntries(Object.entries(caught.fieldErrors??{}).map(([k,v])=>[k,v.join(' ')])));
   }else setError(caught instanceof Error?caught.message:'Unable to save profile.');
  }finally{setBusy(false);}
 }
 return <form className="account-form" onSubmit={submit} noValidate>
  <div className="form-grid">
   <FormField name="displayName" label="Display name" value={values.displayName} onChange={e=>update('displayName',e.target.value)} required maxLength={120} disabled={busy} autoComplete="name" error={fieldErrors.displayName}/>
   <FormField name="phone" label="Phone (optional)" value={values.phone} onChange={e=>update('phone',e.target.value)} maxLength={20} disabled={busy} type="tel" autoComplete="tel" placeholder="+8801712345678" hint="International E.164 format; leave blank to remove your phone number." error={fieldErrors.phone}/>
   <FormField name="timeZone" label="Time zone" value={values.timeZone} onChange={e=>update('timeZone',e.target.value)} required maxLength={64} disabled={busy} placeholder="Asia/Dhaka" hint="Use an IANA time zone for the dates shown on your account." error={fieldErrors.timeZone}/>
   <FormField name="locale" label="Language/region" value={values.locale} onChange={e=>update('locale',e.target.value)} required maxLength={16} disabled={busy} placeholder="en-BD" hint="Use a language tag such as en-BD or bn-BD." error={fieldErrors.locale}/>
  </div>
  {error&&<p className="form-alert" role="alert">{error}</p>}
  {success&&<p className="success-message" role="status">{success}</p>}
  <Button type="submit" loading={busy}>Save profile</Button>
 </form>;
}
