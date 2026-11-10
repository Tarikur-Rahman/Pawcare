'use client';
import {useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {FormField} from '@/components/ui/FormField';
import {inquiryPayload,marketId,marketError,MarketFormError} from '@/lib/marketplace/listings';
export function InquiryPanel({id}:{id:string}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
 const [fieldError,setFieldError]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const listingId=marketId(id);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!listingId||busy||sent)return;
  setFieldError('');setError('');setNotice('');
  let body;
  try{body=inquiryPayload(listingId,message);}catch(caught){if(caught instanceof MarketFormError)setFieldError(caught.message);else setError('Unable to validate inquiry.');return;}
  setBusy(true);
  try{
   await api('/marketplace/inquiries',{method:'POST',body});
   setSent(true);setNotice('Private inquiry sent. This is not a purchase, payment or ownership transfer.');
  }catch(caught){
   if(caught instanceof ApiError&&caught.fieldErrors?.message)setFieldError(caught.fieldErrors.message.join(' '));
   setError(marketError(caught,'Unable to send your inquiry.'));
  }finally{setBusy(false);}
 }
 return <form className="action-form" onSubmit={submit}><h3>Send a private inquiry</h3>
  <FormField name="marketInquiryMessage" label="Your question" as="textarea" required minLength={5} maxLength={2000}
   hint="At least 5 characters and up to 2000 UTF-8 bytes. Do not include sensitive information."
   value={message} disabled={busy||sent||!listingId} onChange={e=>{setMessage(e.target.value);setFieldError('');}} error={fieldError}/>
  {error&&<p role="alert" className="form-alert">{error}</p>}{notice&&<p role="status" className="success-message">{notice}</p>}
  <button type="submit" disabled={!listingId||busy||sent} className="btn btn-primary">{busy?'Sending…':sent?'Inquiry sent':'Send inquiry'}</button>
 </form>;
}
