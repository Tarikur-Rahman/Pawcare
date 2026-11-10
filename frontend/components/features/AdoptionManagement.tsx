'use client';

import {useState} from 'react';
import {api} from '@/lib/api/client';
import {rows,str,type Row} from '@/lib/types/domain';
import {adoptionApplicationStatus,adoptionError,adoptionId,canDecideApplication,newHandoverKey} from '@/lib/adoption/records';
import {ErrorState} from '@/components/ui/ErrorState';
import {EmptyState} from '@/components/ui/EmptyState';
import {FormField} from '@/components/ui/FormField';

type PendingDecision={id:string;accept:boolean}|null;

export function AdoptionManagement(){
 const [listing,setListing]=useState(''),[applications,setApplications]=useState<Row[]>([]),[loadedId,setLoadedId]=useState('');
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [pendingDecision,setPendingDecision]=useState<PendingDecision>(null);
 const [confirmHandover,setConfirmHandover]=useState(false),[handoverKey,setHandoverKey]=useState('');
 const id=adoptionId(listing);
 function changeListing(value:string){setListing(value);setApplications([]);setLoadedId('');setError('');setNotice('');setPendingDecision(null);setConfirmHandover(false);setHandoverKey('');}
 async function load(){
  if(!id||loading||busy)return;
  setLoading(true);setError('');setNotice('');setPendingDecision(null);setLoadedId('');
  try{const result=rows(await api(`/adoptions/${id}/applications`));setApplications(result);setLoadedId(id);}
  catch(caught){setApplications([]);setError(adoptionError(caught,'Unable to load applications. Only the listing owner may view them.'));}
  finally{setLoading(false);}
 }
 async function decide(){
  if(!id||!pendingDecision||busy||loading||loadedId!==id)return;
  const {id:applicationId,accept}=pendingDecision;
  if(!applications.some(a=>adoptionId(a.id)===applicationId&&canDecideApplication(a)))return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await api<Row>(`/adoptions/${id}/applications/${applicationId}/decision`,{method:'POST',body:{accept}});
   setPendingDecision(null);
   setNotice(accept?`Application accepted${adoptionId(result?.handoverId)?` (handover #${adoptionId(result.handoverId)})`:''}. Ownership does not change until both parties confirm.`:'Application rejected.');
   try{setApplications(rows(await api(`/adoptions/${id}/applications`)));}
   catch(caught){setApplications([]);setLoadedId('');setError(adoptionError(caught,'Decision saved, but applications could not be refreshed.'));}
  }catch(caught){setError(adoptionError(caught,'Unable to record the decision.'));}
  finally{setBusy(false);}
 }
 async function handover(){
  if(!id||!confirmHandover||busy||loading)return;
  const key=handoverKey||newHandoverKey();
  setHandoverKey(key);setBusy(true);setError('');setNotice('');
  try{
   const result=await api<{status?:string}>(`/adoptions/${id}/handover`,{method:'POST',idempotencyKey:key});
   const status=String(result?.status||'');
   setConfirmHandover(false);
   setNotice(status==='COMPLETED'?'Both parties confirmed. The backend reports that pet ownership was transferred.'
    :status==='AWAITING_OTHER_PARTY'?'Your confirmation was recorded. Ownership remains unchanged until the other party confirms.'
    :'Confirmation recorded; check the handover status with the other participant.');
  }catch(caught){setError(adoptionError(caught,'Unable to confirm this handover.'));}
  finally{setBusy(false);}
 }
 return <div className="panel adoption-review-panel"><h2>Applications & responsible handover</h2>
  <p className="hint">Enter your listing ID to review applications. Applicants can also use a listing ID below to confirm an existing matched handover. PawCare does not expose a private adoption-history endpoint.</p>
  <FormField label="Adoption listing ID" name="adoptionListingId" value={listing} onChange={e=>changeListing(e.target.value)}
   placeholder="e.g. 123" error={listing&&!id?'Enter a valid positive listing ID.':undefined}/>
  <div className="row-actions"><button type="button" className="btn btn-secondary" disabled={!id||busy||loading} onClick={()=>void load()}>{loading?'Loading…':'View applications (owner)'}</button></div>
  {error&&<ErrorState message={error} onRetry={()=>setError('')}/>}
  {notice&&<p className="success-message" role="status">{notice}</p>}
  {loading&&<p className="hint" role="status">Loading applications…</p>}
  {loadedId===id&&!loading&&(applications.length===0?<EmptyState title="No applications submitted" description="Applications will appear when someone applies to your published listing."/>
   :<div className="adoption-application-list"><h3>Applications for listing #{id}</h3>
    {applications.map((app,i)=>{const appId=adoptionId(app.id);return <div className="moderation-row" key={appId||`app-${i}`}>
     <div><strong>Application #{appId||'Unavailable'}</strong><p>Applicant #{adoptionId(app.applicantId)||'Private'} · {adoptionApplicationStatus(app)||'Unknown'}</p></div>
     {canDecideApplication(app)&&<div className="row-actions">
      <button type="button" className="btn btn-secondary btn-small" disabled={busy||loading} onClick={()=>setPendingDecision({id:appId,accept:true})}>Accept</button>
      <button type="button" className="btn btn-danger btn-small" disabled={busy||loading} onClick={()=>setPendingDecision({id:appId,accept:false})}>Reject</button></div>}
    </div>;})}
    {pendingDecision&&<div className="safety-note" role="group" aria-label="Confirm application decision"><strong>{pendingDecision.accept?'Accept this application?':'Reject this application?'}</strong>
     <p>{pendingDecision.accept?'Acceptance matches the listing to this applicant; both parties must still confirm the handover.':'Rejected applications cannot be accepted through this screen later.'}</p>
     <div className="row-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void decide()}>{busy?'Saving…':pendingDecision.accept?'Confirm acceptance':'Confirm rejection'}</button>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setPendingDecision(null)}>Keep undecided</button></div></div>}
   </div>)}
  <div className="adoption-handover-section"><h3>Confirm a matched handover</h3>
   <p className="hint">Only the existing owner and the accepted adopter may confirm. Do not proceed until you have met and agreed to the transfer. The backend requires confirmations from both parties.</p>
   {!confirmHandover?<button type="button" disabled={!id||busy||loading} className="btn btn-secondary" onClick={()=>setConfirmHandover(true)}>Review handover confirmation</button>
    :<div className="safety-note" role="group" aria-label="Confirm adoption handover"><strong>Confirm your participation in the handover for listing #{id}?</strong>
      <p>This action records your consent. Pet ownership changes only when the backend confirms both parties.</p>
      <div className="row-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void handover()}>{busy?'Confirming…':'Confirm my handover'}</button>
       <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setConfirmHandover(false)}>Not yet</button></div></div>}
  </div>
  <p className="disclaimer">Application answers are private. The API does not provide a private listing history, application status for applicants, or unilateral ownership transfers.</p>
 </div>;
}
