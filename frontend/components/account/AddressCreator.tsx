'use client';

import {useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {addressPayload,AccountInputError,type AddressFields} from '@/lib/account/records';
import {Button} from '@/components/ui/Button';
import {FormField} from '@/components/ui/FormField';

const blank=():AddressFields=>({recipientName:'',line1:'',city:'',countryCode:'BD',scope:'SHIPPING'});

export function AddressCreator({onAdded}:{onAdded:()=>void}){
 const [values,setValues]=useState<AddressFields>(blank);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 function update(key:keyof AddressFields,value:string){setValues(prev=>({...prev,[key]:value}));setFieldErrors(prev=>({...prev,[key]:''}));setSuccess('');}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setError('');setSuccess('');setFieldErrors({});
  let body;
  try{body=addressPayload(values);}catch(caught){
   if(caught instanceof AccountInputError)setFieldErrors({[caught.fieldName]:caught.message});
   else setError('Please check the address details.');
   return;
  }
  setBusy(true);
  try{
   await api('/users/me/addresses',{method:'POST',body});
   setValues(blank());setSuccess('Address added successfully.');onAdded();
  }catch(caught){
   if(caught instanceof ApiError){
    setError(caught.message);
    setFieldErrors(Object.fromEntries(Object.entries(caught.fieldErrors??{}).map(([k,v])=>[k,v.join(' ')])));
   }else setError(caught instanceof Error?caught.message:'Unable to add address.');
  }finally{setBusy(false);}
 }
 return <form className="account-form" onSubmit={submit} noValidate>
  <div className="form-grid">
   <FormField name="recipientName" label="Recipient name" value={values.recipientName} onChange={e=>update('recipientName',e.target.value)} required maxLength={160} disabled={busy} autoComplete="name" error={fieldErrors.recipientName}/>
   <FormField name="line1" label="Street / area" value={values.line1} onChange={e=>update('line1',e.target.value)} required maxLength={200} disabled={busy} autoComplete="address-line1" error={fieldErrors.line1}/>
   <FormField name="city" label="City" value={values.city} onChange={e=>update('city',e.target.value)} required maxLength={100} disabled={busy} autoComplete="address-level2" error={fieldErrors.city}/>
   <FormField name="countryCode" label="Country code" value={values.countryCode} onChange={e=>update('countryCode',e.target.value)} required maxLength={2} disabled={busy} autoComplete="country" placeholder="BD" hint="Two-letter ISO country code (e.g. BD)." error={fieldErrors.countryCode}/>
   <FormField name="scope" label="Address type" as="select" options={[{value:'SHIPPING',label:'Shipping'},{value:'BILLING',label:'Billing'}]}
    value={values.scope} onChange={e=>update('scope',e.target.value)} required disabled={busy} error={fieldErrors.scope}/>
  </div>
  {error&&<p className="form-alert" role="alert">{error}</p>}
  {success&&<p className="success-message" role="status">{success}</p>}
  <Button type="submit" loading={busy}>Add address</Button>
 </form>;
}
