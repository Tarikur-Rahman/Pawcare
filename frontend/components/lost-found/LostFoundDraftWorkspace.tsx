'use client';
import {useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {FormField} from '@/components/ui/FormField';
import {lostDraftPayload,lostId,LostFormError,type LostDraftFields} from '@/lib/lost-found/reports';
const blank:LostDraftFields={category:'',species:'',description:'',generalArea:'',observedAt:''};

export function LostFoundDraftWorkspace(){
 const [values,setValues]=useState<LostDraftFields>(blank),[fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[draftId,setDraftId]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 function update(key:keyof LostDraftFields,value:string){setValues(v=>({...v,[key]:value}));setFieldErrors(e=>({...e,[key]:''}));}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||draftId)return;
  setFieldErrors({});setError('');setNotice('');
  let body;
  try{body=lostDraftPayload(values);}catch(caught){if(caught instanceof LostFormError)setFieldErrors({[caught.field]:caught.message});else setError('Invalid report details.');return;}
  setBusy(true);
  try{
   const result=await api<{id?:number|string}>('/lost-found',{method:'POST',body});
   const id=lostId(result?.id);
   if(!id)throw new Error('The server may have saved this draft, but did not return a valid ID. Check before submitting again.');
   setDraftId(id);setNotice(`Private draft #${id} saved. The current API does not provide a submit endpoint for lost/found reports. This draft is not public.`);
  }catch(caught){
   if(caught instanceof ApiError&&caught.fieldErrors)setFieldErrors(Object.fromEntries(Object.entries(caught.fieldErrors).map(([k,v])=>[k,v.join(' ')])));
   setError(caught instanceof Error?caught.message:'Unable to save your report.');
  }finally{setBusy(false);}
 }
 return <div className="panel"><h2>Create a lost or found report</h2>
  <p className="hint">New reports are private drafts. Enter only a general area; precise locations and private contact information must not appear publicly.</p>
  <form className="action-form" onSubmit={submit}>
   <div className="form-grid">
    <FormField name="lostPostCategory" label="Report type" as="select" required disabled={busy||!!draftId}
     value={values.category} onChange={e=>update('category',e.target.value)} error={fieldErrors.category}
     options={[{value:'LOST',label:'Lost pet'},{value:'FOUND',label:'Found pet'}]}/>
    <FormField name="lostPostSpecies" label="Species" required maxLength={80} disabled={busy||!!draftId}
     value={values.species} onChange={e=>update('species',e.target.value)} error={fieldErrors.species}/>
    <FormField name="lostPostArea" label="General area (not a street address)" required maxLength={160} disabled={busy||!!draftId}
     value={values.generalArea} onChange={e=>update('generalArea',e.target.value)} error={fieldErrors.generalArea}/>
    <FormField name="lostPostObservedAt" label="Last observed at" type="datetime-local" required disabled={busy||!!draftId}
     value={values.observedAt} onChange={e=>update('observedAt',e.target.value)} error={fieldErrors.observedAt}/>
    <FormField name="lostPostDescription" label="Description" as="textarea" required minLength={10} maxLength={4000} disabled={busy||!!draftId}
     value={values.description} onChange={e=>update('description',e.target.value)} error={fieldErrors.description}
     hint="At least 10 characters and no more than 4000 UTF-8 bytes."/>
   </div>
   {error&&<p role="alert" className="form-alert">{error}</p>}{notice&&<p role="status" className="success-message">{notice}</p>}
   {!draftId?<button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Saving…':'Save private report draft'}</button>
    :<button className="btn btn-secondary" type="button" onClick={()=>{setValues({...blank});setDraftId('');setFieldErrors({});setError('');setNotice('');}}>Create another draft</button>}
  </form>
  <p className="disclaimer">Keep the draft ID for your records. No private draft-listing or self-publication endpoint is available; only open, moderated reports appear in public search.</p>
 </div>;
}
