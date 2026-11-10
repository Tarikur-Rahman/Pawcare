'use client';
import {useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {FormField} from '@/components/ui/FormField';
import {lostId,proofAssetId,LostFormError} from '@/lib/lost-found/reports';

export function ReunionClaimForm({id}:{id:string}){
 const [asset,setAsset]=useState(''),[busy,setBusy]=useState(false),[submitted,setSubmitted]=useState(false);
 const [error,setError]=useState(''),[assetError,setAssetError]=useState(''),[notice,setNotice]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||submitted)return;
  setError('');setAssetError('');setNotice('');
  const post=lostId(id);if(!post){setError('Invalid report ID.');return;}
  let fileId:number;
  try{fileId=proofAssetId(asset);}catch(caught){if(caught instanceof LostFormError)setAssetError(caught.message);return;}
  setBusy(true);
  try{
   const result=await api<{id?:number|string}>(`/lost-found/${post}/claims`,{method:'POST',body:{proofAssetId:fileId}});
   setSubmitted(true);
   const claim=lostId(result?.id);
   setNotice(`Ownership claim submitted${claim?` (claim #${claim})`:''}. Verification and both-party confirmation are still required; no reunion has been completed.`);
  }catch(caught){
   if(caught instanceof ApiError&&caught.fieldErrors?.proofAssetId)setAssetError(caught.fieldErrors.proofAssetId.join(' '));
   setError(caught instanceof Error?caught.message:'Unable to submit your claim.');
  }finally{setBusy(false);}
 }
 return <form className="action-form lostfound-claim-form" onSubmit={submit}><h3>Submit an ownership claim</h3>
  <p className="hint">Claim only with your own private evidence file. The backend accepts only an existing scanned-safe file with reviewer-only access. Submitting does not verify ownership.</p>
  <FormField name="claimProofAssetId" label="Private evidence file ID" type="number" required min={1} disabled={busy||submitted}
   value={asset} onChange={e=>{setAsset(e.target.value);setAssetError('');}} error={assetError}/>
  {error&&<p className="form-alert" role="alert">{error}</p>}{notice&&<p className="success-message" role="status">{notice}</p>}
  <button type="submit" className="btn btn-secondary" disabled={!lostId(id)||busy||submitted}>{busy?'Submitting…':submitted?'Claim submitted':'Submit private claim'}</button>
 </form>;
}
