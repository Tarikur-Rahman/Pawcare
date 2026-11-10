'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {field,rows,str,type Row} from '@/lib/types/domain';
import {eligibleMarketPet,marketId,marketError,MarketFormError,saleDraftPayload,type SaleDraftFields} from '@/lib/marketplace/listings';
import {FormField} from '@/components/ui/FormField';
import {ErrorState} from '@/components/ui/ErrorState';
import {ImageUploader} from '@/components/ui/ImageUploader';
const blank:SaleDraftFields={petId:'',title:'',description:'',generalArea:'',askingMinor:'',currency:'BDT',welfareEvidenceFileId:''};

export function SaleDraftWorkspace(){
 const [pets,setPets]=useState<Row[]>([]),[petLoading,setPetLoading]=useState(true),[petError,setPetError]=useState(''),[refresh,setRefresh]=useState(0);
 const [values,setValues]=useState<SaleDraftFields>(blank),[fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[draftId,setDraftId]=useState(''),[submitted,setSubmitted]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[pendingUploadId,setPendingUploadId]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setPetLoading(true);setPetError('');setPets([]);
  api('/pets',{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setPets(rows(data).filter(eligibleMarketPet));})
   .catch(caught=>{if(!controller.signal.aborted)setPetError(marketError(caught,'Unable to load your pets.'));})
   .finally(()=>{if(!controller.signal.aborted)setPetLoading(false);});
  return ()=>controller.abort();
 },[refresh]);
 function update(fieldName:keyof SaleDraftFields,value:string){setValues(current=>({...current,[fieldName]:value}));setFieldErrors(x=>({...x,[fieldName]:''}));}
 function reset(){setValues({...blank});setFieldErrors({});setDraftId('');setSubmitted(false);setError('');setNotice('');setPendingUploadId('');}
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||draftId||petLoading||petError)return;
  setFieldErrors({});setError('');setNotice('');
  let body;
  try{body=saleDraftPayload(values,pets);}catch(caught){if(caught instanceof MarketFormError)setFieldErrors({[caught.field]:caught.message});else setError('Invalid listing details.');return;}
  setBusy(true);
  try{
   const result=await api<Row>('/marketplace/pets',{method:'POST',body});
   const id=marketId(field(result,'id'));
   if(!id)throw new Error('The draft may have been saved but the server did not provide a valid listing ID. Check before creating another.');
   setDraftId(id);setNotice(`Private sale draft #${id} saved. It is not public until moderator approval.`);
  }catch(caught){
   if(caught instanceof ApiError&&caught.fieldErrors)setFieldErrors(Object.fromEntries(Object.entries(caught.fieldErrors).map(([k,v])=>[k,v.join(' ')])));
   setError(marketError(caught,'Unable to save the draft. Approved seller status and valid private welfare evidence are required.'));
  }finally{setBusy(false);}
 }
 async function submitDraft(){
  if(!draftId||submitted||busy)return;
  setBusy(true);setError('');setNotice('');
  try{await api(`/marketplace/pets/${draftId}/submit`,{method:'POST'});setSubmitted(true);
   setNotice(`Listing #${draftId} submitted for moderator review. It is not published or sold.`);
  }catch(caught){setError(marketError(caught,'Unable to submit the draft for review.'));}
  finally{setBusy(false);}
 }
 return <div className="panel marketplace-draft-panel"><h2>Create a seller listing</h2>
  <p className="hint">Only accounts granted the APPROVED_PET_SELLER capability may save or submit these drafts. Choose your own active pet and supply a SAFE, REVIEWER_ONLY evidence file ID.</p>
  {petError&&<ErrorState message={petError} onRetry={()=>setRefresh(x=>x+1)}/>}{petLoading&&<p role="status" className="hint">Loading active pets…</p>}
  <form onSubmit={create} className="action-form"><div className="form-grid">
   <FormField name="marketPet" label="Your active pet" as="select" required disabled={busy||!!draftId||petLoading||!!petError}
    options={pets.map(p=>({value:marketId(field(p,'id','petId')),label:`${str(p,'name')||'Unnamed pet'} (${str(p,'species')||'Unknown species'})`}))}
    value={values.petId} onChange={e=>update('petId',e.target.value)} error={fieldErrors.petId}/>
   <FormField name="marketTitle" label="Listing headline" required maxLength={180} disabled={busy||!!draftId}
    value={values.title} onChange={e=>update('title',e.target.value)} error={fieldErrors.title}/>
   <FormField name="marketDescription" label="Pet description and welfare details" as="textarea" required minLength={20} maxLength={4000}
    disabled={busy||!!draftId} value={values.description} onChange={e=>update('description',e.target.value)} error={fieldErrors.description}
    hint="At least 20 characters and at most 4000 UTF-8 bytes."/>
   <FormField name="marketArea" label="General area (not an address)" required maxLength={160} disabled={busy||!!draftId}
    value={values.generalArea} onChange={e=>update('generalArea',e.target.value)} error={fieldErrors.generalArea}/>
   <FormField name="marketAmount" label="Asking price in minor units" required type="number" min="1" disabled={busy||!!draftId}
    value={values.askingMinor} onChange={e=>update('askingMinor',e.target.value)} error={fieldErrors.askingMinor}
    hint="For BDT: enter 125000 for ৳1,250.00. This is informational only; checkout is disabled."/>
   <FormField name="marketCurrency" label="Currency (ISO 3 letters)" required maxLength={3} disabled={busy||!!draftId}
    value={values.currency} onChange={e=>update('currency',e.target.value)} error={fieldErrors.currency}/>
   <FormField name="marketEvidence" label="Private welfare evidence file ID" required type="number" min="1" disabled={busy||!!draftId}
    value={values.welfareEvidenceFileId} onChange={e=>update('welfareEvidenceFileId',e.target.value)} error={fieldErrors.welfareEvidenceFileId}
    hint="Must be an owned, safely scanned file with reviewer-only access."/>
  </div>
  {error&&<p role="alert" className="form-alert">{error}</p>}{notice&&<p role="status" className="success-message">{notice}</p>}
  {!draftId?<button type="submit" className="btn btn-primary" disabled={busy||petLoading||!!petError||pets.length===0}>{busy?'Saving…':'Save seller draft'}</button>
   :<div className="row-actions"><button type="button" className="btn btn-primary" onClick={()=>void submitDraft()} disabled={busy||submitted}>{busy?'Submitting…':submitted?'Submitted for review':'Submit draft for review'}</button>
    <button type="button" className="btn btn-secondary" disabled={busy} onClick={reset}>Create another listing</button></div>}
  </form>
  {!petLoading&&!petError&&!pets.length&&<p className="hint">You have no active pet profiles available to list.</p>}
  {!draftId&&<div className="marketplace-evidence"><h3>Prepare welfare evidence for staff review</h3>
   <p className="hint">New uploads start PRIVATE and PENDING_SCAN. They cannot satisfy the listing evidence requirement until an authorized workflow marks the file SAFE and REVIEWER_ONLY. Uploading does not approve a seller or an evidence file.</p>
   <ImageUploader onUploaded={setPendingUploadId}/>
   {pendingUploadId&&<p role="status" className="hint">Uploaded asset #{pendingUploadId} is awaiting trusted scanning and reviewer-only approval. Do not use it as listing evidence until those checks are complete.</p>}</div>}
  <p className="disclaimer">Keep your draft ID. The backend has no private listing-history endpoint, and final sales, payments, animal shipping and transfers are disabled.</p>
 </div>;
}
