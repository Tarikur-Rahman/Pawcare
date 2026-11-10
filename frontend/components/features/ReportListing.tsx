'use client';
import {useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {contentError,contentId,ContentFormError,REPORT_REASONS,reportPayload} from '@/lib/content/moderation';

export function ReportListing({entityType,entityId}:{entityType:string;entityId:string}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[details,setDetails]=useState('');
 const [sending,setSending]=useState(false),[error,setError]=useState(''),[sentId,setSentId]=useState('');
 const validId=contentId(entityId);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(sending)return;
  setError('');setSending(true);
  try {const body=reportPayload(entityType,entityId,reason,details);
   const result=await api<Record<string,unknown>>('/reports/listings',{method:'POST',body});
   setSentId(contentId(result?.id));setOpen(false);setReason('');setDetails('');
  }catch(e){setError(e instanceof ContentFormError?e.message:contentError(e,'Unable to submit the private report.'));}
  finally{setSending(false);}
 }
 return <div className="report-listing" style={{marginTop:25}}>
  {sentId?<div role="status" className="success-message">Your private concern was received (report #{sentId}). Review is pending; no moderation decision has been made.</div>
   :<><button type="button" className="btn btn-ghost" disabled={!validId||sending} onClick={()=>{setOpen(v=>!v);setError('');}}>⚑ {open?'Close report form':'Report this listing'}</button>
    {open&&<form className="action-form" onSubmit={e=>void submit(e)}><h3>Report a concern privately</h3>
     <p className="hint">Your explanation is for moderators. Submitting a report does not remove or approve a listing.</p>
     <div className="form-field"><label htmlFor="listingReportReason">Reason *</label>
      <select id="listingReportReason" className="form-input" required value={reason} onChange={e=>setReason(e.target.value)}>
       <option value="">Choose a reason</option>{REPORT_REASONS.map(item=><option key={item} value={item}>{item}</option>)}</select></div>
     <div className="form-field"><label htmlFor="listingReportDetails">Additional private details</label>
      <textarea id="listingReportDetails" className="form-input" value={details} onChange={e=>setDetails(e.target.value)} maxLength={3000}/>
      <small className="hint">Maximum 3000 UTF-8 bytes. Do not share contact details publicly.</small></div>
     {error&&<p role="alert" className="form-alert">{error}</p>}
     <button className="btn btn-primary" type="submit" disabled={sending}>{sending?'Submitting…':'Send private report'}</button>
    </form>}</>}
 </div>;
}
