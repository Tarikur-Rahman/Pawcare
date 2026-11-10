'use client';
import {useState} from 'react';
import {api} from '@/lib/api/client';
import {rows,str,type Row} from '@/lib/types/domain';
import {lostDate,lostId} from '@/lib/lost-found/reports';
import {FormField} from '@/components/ui/FormField';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';

/** View only owner-authorized private sightings and confirm only an already verified claim. */
export function LostFoundManagement(){
 const [postId,setPostId]=useState(''),[claimId,setClaimId]=useState('');
 const [sightings,setSightings]=useState<Row[]>([]),[loadedPost,setLoadedPost]=useState('');
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const post=lostId(postId),claim=lostId(claimId);
 function changePost(value:string){setPostId(value);setSightings([]);setLoadedPost('');setError('');setNotice('');setPending(false);}
 async function loadSightings(){
  if(!post||loading||busy)return;
  setLoading(true);setError('');setNotice('');setSightings([]);setLoadedPost('');
  try{setSightings(rows(await api(`/lost-found/${post}/sightings`)));setLoadedPost(post);}
  catch(caught){setError(caught instanceof Error?caught.message:'Unable to load private sightings.');}
  finally{setLoading(false);}
 }
 async function confirmReunion(){
  if(!post||!claim||!pending||busy||loading)return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await api<{status?:string}>(`/lost-found/${post}/claims/${claim}/confirm-reunion`,{method:'POST'});
   setPending(false);
   setNotice(result?.status==='REUNITED'?'The backend confirms reunion after moderator verification and both-party confirmation.'
    :result?.status==='AWAITING_OTHER_PARTY'?'Your confirmation is recorded. The other party must still confirm; this report is not reunited yet.'
    :'Confirmation recorded. Verify the status with the other participant; reunion is not established by this response.');
  }catch(caught){setError(caught instanceof Error?caught.message:'Unable to confirm reunification.');}
  finally{setBusy(false);}
 }
 return <div className="panel lostfound-management"><h2>Private sightings &amp; safe reunification</h2>
  <p className="hint">Report owners may view private sightings using their report ID. Both the poster and claimant may confirm a verified ownership claim; staff verification must occur first.</p>
  <FormField name="lostPostLookup" label="Lost/found report ID" value={postId} onChange={e=>changePost(e.target.value)}
   error={postId&&!post?'Enter a valid positive report ID.':undefined}/>
  <div className="row-actions"><button type="button" className="btn btn-secondary" disabled={!post||loading||busy} onClick={()=>void loadSightings()}>{loading?'Loading…':'View private sightings (owner)'}</button></div>
  {loading&&<p role="status" className="hint">Loading private sightings…</p>}
  {loadedPost===post&&!loading&&(sightings.length===0?<EmptyState title="No sightings reported" description="Private sightings will appear if other users submit them to your open report."/>
   :<div className="lostfound-sighting-list"><h3>Private sightings for report #{post}</h3>{sightings.map((item,i)=><div className="moderation-row" key={lostId(item.id)||`sighting-${i}`}>
    <div><strong>Sighting #{lostId(item.id)||'Unavailable'}</strong>
     <p>{str(item,'approximateArea')||'Area withheld'} · {lostDate(str(item,'observedAt'))}</p>
     <p>{str(item,'description')||'No description'}</p><p className="hint">{str(item,'status')||'Status unavailable'}</p></div></div>)}</div>)}
  <div className="lostfound-reunion"><h3>Confirm a verified reunion</h3>
   <p className="hint">Only use a claim that a moderator has verified. This action records your participation; it does not bypass verification or the other party’s consent.</p>
   <FormField name="lostClaimLookup" label="Verified claim ID" value={claimId} onChange={e=>{setClaimId(e.target.value);setPending(false);setNotice('');}}
    error={claimId&&!claim?'Enter a valid positive claim ID.':undefined}/>
   {!pending?<button type="button" className="btn btn-secondary" disabled={!post||!claim||busy||loading} onClick={()=>setPending(true)}>Review reunion confirmation</button>
    :<div className="safety-note" role="group" aria-label="Confirm verified reunion"><strong>Confirm your participation in claim #{claim} on report #{post}?</strong>
     <p>Only proceed after ownership has been verified and you agree to the reunion.</p><div className="row-actions">
      <button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void confirmReunion()}>{busy?'Confirming…':'Confirm my reunion'}</button>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setPending(false)}>Not yet</button></div></div>}
  </div>
  {error&&<ErrorState message={error} onRetry={()=>setError('')}/>}{notice&&<p role="status" className="success-message">{notice}</p>}
  <p className="disclaimer">This API does not expose a claim-review queue, self-verification, draft publishing, or report-owner contact information.</p>
 </div>;
}
