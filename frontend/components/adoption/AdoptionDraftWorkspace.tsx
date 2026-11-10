'use client';

import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {rows,str,type Row} from '@/lib/types/domain';
import {adoptionId,adoptionError,eligiblePet,validateAdoptionText} from '@/lib/adoption/records';
import {FormField} from '@/components/ui/FormField';
import {ErrorState} from '@/components/ui/ErrorState';

export function AdoptionDraftWorkspace(){
 const [pets,setPets]=useState<Row[]>([]),[loadingPets,setLoadingPets]=useState(true),[petError,setPetError]=useState('');
 const [refreshPets,setRefreshPets]=useState(0);
 const [petId,setPetId]=useState(''),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[area,setArea]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 const [draftId,setDraftId]=useState(''),[submitted,setSubmitted]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setLoadingPets(true);setPetError('');
  api('/pets',{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setPets(rows(value).filter(eligiblePet));})
   .catch(caught=>{if(!controller.signal.aborted)setPetError(adoptionError(caught,'Unable to load pets.'));})
   .finally(()=>{if(!controller.signal.aborted)setLoadingPets(false);});
  return ()=>controller.abort();
 },[refreshPets]);
 const selected=useMemo(()=>pets.some(p=>adoptionId(p.id)===petId),[pets,petId]);
 function reset(){setDraftId('');setSubmitted(false);setPetId('');setTitle('');setDescription('');setArea('');setError('');setNotice('');setFieldErrors({});}
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||draftId)return;
  setError('');setNotice('');
  const problems:Record<string,string>={};
  if(!selected)problems.petId='Choose an active pet that belongs to your account.';
  for(const [key,value,label,min,max] of [
   ['title',title,'Headline',1,180],['description',description,'Care story',20,4000],['generalArea',area,'General area',1,160],
  ] as const){const invalid=validateAdoptionText(value,label,min,max);if(invalid)problems[key]=invalid;}
  setFieldErrors(problems);if(Object.keys(problems).length)return;
  setBusy(true);
  try{
   const result=await api<Row>('/adoptions',{method:'POST',body:{petId:Number(petId),title:title.trim(),description:description.trim(),generalArea:area.trim()}});
   const id=adoptionId(result?.id);
   if(!id)throw new Error('The server saved the draft but did not return a valid listing ID. Check your account before creating another draft.');
   setDraftId(id);setNotice(`Draft #${id} saved. Submit it for staff review when ready; drafts are not public.`);
  }catch(caught){if(caught instanceof ApiError&&caught.fieldErrors){
    setFieldErrors(Object.fromEntries(Object.entries(caught.fieldErrors).map(([k,v])=>[k,v.join(' ')])));
   }setError(adoptionError(caught,'Unable to create the adoption draft.'));}
  finally{setBusy(false);}
 }
 async function submitDraft(){
  if(!draftId||submitted||busy)return;
  setBusy(true);setError('');setNotice('');
  try{await api(`/adoptions/${draftId}/submit`,{method:'POST'});
   setSubmitted(true);setNotice(`Listing #${draftId} submitted for staff review. It is not published until approved.`);
  }catch(caught){setError(adoptionError(caught,'Unable to submit the draft for review.'));}
  finally{setBusy(false);}
 }
 return <div className="panel adoption-draft-panel"><h2>Create an adoption listing</h2>
  <p className="hint">Only active pets you own can be listed. New listings begin as private drafts; staff approval is required before publication.</p>
  {petError&&<ErrorState message={petError} onRetry={()=>setRefreshPets(n=>n+1)}/>}
  {loadingPets&&<p role="status" className="hint">Loading your active pets…</p>}
  <form onSubmit={create} className="action-form"><div className="form-grid">
   <FormField name="adoptionPet" label="Your active pet" as="select" required disabled={busy||!!draftId||loadingPets||!!petError}
    value={petId} onChange={e=>{setPetId(e.target.value);setFieldErrors(x=>({...x,petId:''}));}}
    options={pets.map(p=>({value:adoptionId(p.id),label:`${str(p,'name')||'Unnamed pet'} (${str(p,'species')||'Species unspecified'})`}))}
    error={fieldErrors.petId}/>
   <FormField name="adoptionTitle" label="Listing headline" required value={title} disabled={busy||!!draftId} maxLength={180}
    onChange={e=>setTitle(e.target.value)} error={fieldErrors.title}/>
   <FormField name="adoptionDescription" label="Pet story and care needs" as="textarea" required minLength={20} maxLength={4000}
    value={description} disabled={busy||!!draftId} onChange={e=>setDescription(e.target.value)}
    error={fieldErrors.description} hint="At least 20 characters and at most 4,000 UTF-8 bytes."/>
   <FormField name="adoptionArea" label="General area (not a precise address)" required maxLength={160} value={area}
    disabled={busy||!!draftId} onChange={e=>setArea(e.target.value)} error={fieldErrors.generalArea}/>
  </div>{error&&<p role="alert" className="form-alert">{error}</p>}
   {notice&&<p role="status" className="success-message">{notice}</p>}
   {!draftId?<button type="submit" disabled={busy||loadingPets||!!petError||!pets.length} className="btn btn-primary">{busy?'Saving…':'Save adoption draft'}</button>
   :<div className="row-actions"><button type="button" className="btn btn-primary" onClick={()=>void submitDraft()} disabled={busy||submitted}>
      {submitted?'Submitted for review':busy?'Submitting…':'Submit draft for review'}</button>
     <button type="button" className="btn btn-secondary" disabled={busy} onClick={reset}>Create another draft</button></div>}
  </form>
  {!petError&&!loadingPets&&!pets.length&&<p className="hint">You have no active pet profiles available for an adoption listing.</p>}
 </div>;
}
