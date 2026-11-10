'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {field,rows,str,type Row} from '@/lib/types/domain';
import {Button} from '@/components/ui/Button';
import {ErrorState} from '@/components/ui/ErrorState';
import {adminId,adminMessage,CAPABILITIES,claimVerifyPayload,grantPayload,isActiveUser,revokePayload} from '@/lib/admin/operations';

type Operation='grant'|'revoke'|'reunion';
export function VerificationWorkspace(){
 const [users,setUsers]=useState<Row[]>([]),[usersError,setUsersError]=useState(''),[loading,setLoading]=useState(true);
 const [operation,setOperation]=useState<Operation>('grant'),[userId,setUserId]=useState(''),[capability,setCapability]=useState(''),[evidenceId,setEvidenceId]=useState('');
 const [capabilityId,setCapabilityId]=useState(''),[claimId,setClaimId]=useState(''),[reason,setReason]=useState('');
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const load=useCallback(async(signal?:AbortSignal)=>{setLoading(true);setUsersError('');
  try{setUsers(rows(await api('/admin/users',{signal})));}
  catch(e){if(!signal?.aborted){setUsers([]);setUsersError(adminMessage(e,'Unable to load accounts for verification.'));}}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
 const active=users.filter(isActiveUser);
 const target=active.find(u=>adminId(field(u,'id'))===userId);
 function changeOperation(next:Operation){setOperation(next);setConfirm(false);setError('');setSuccess('');}
 function payload(){
  if(operation==='grant'){
   if(!target)throw new Error('Select an active account from the recent user directory.');
   return {path:`/admin/users/${userId}/capabilities`,body:grantPayload(target,capability,evidenceId,reason)};
  }
  if(operation==='revoke'){const p=revokePayload(capabilityId,reason);return {path:`/admin/capabilities/${p.id}/revoke`,body:p.body};}
  const p=claimVerifyPayload(claimId,reason);return {path:`/admin/reunification-claims/${p.id}/verify`,body:p.body};
 }
 function stage(e:FormEvent<HTMLFormElement>){e.preventDefault();setError('');setSuccess('');try{payload();setConfirm(true);}catch(err){setError(adminMessage(err,'Please check the verification fields.'));}}
 async function save(){if(!confirm||busy)return;
  setBusy(true);setError('');setSuccess('');
  try{const request=payload();const result=await api<Row>(request.path,{method:'POST',body:request.body});
   setSuccess(`Backend confirmed ${str(result,'status')||'verification action recorded'}. Review the audit trail for the final record.`);
   setConfirm(false);setReason('');setEvidenceId('');setCapabilityId('');setClaimId('');
  }catch(err){setError(adminMessage(err,'Verification action was rejected.'));setConfirm(false);}
  finally{setBusy(false);}
 }
 return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">TRUSTED OPERATIONS</span><h1>Capabilities & reunion verification</h1><p>Administrative actions require independently verified evidence and documented reasons.</p></div></div>
  <div className="panel"><h2>Choose a verification task</h2><div className="filter-bar"><label className="form-field">Action<select className="form-input" value={operation} disabled={busy} onChange={e=>changeOperation(e.target.value as Operation)}>
   <option value="grant">Grant an approved capability</option><option value="revoke">Revoke an existing capability</option><option value="reunion">Verify a reunion claim</option></select></label></div>
   {operation==='grant'&&usersError&&<ErrorState message={usersError} onRetry={()=>void load()}/>}
   <form className="action-form" onSubmit={stage}><div className="form-grid">
    {operation==='grant'&&<>
     <label className="form-field">Active account *<select className="form-input" required disabled={loading||!!usersError} value={userId} onChange={e=>{setUserId(e.target.value);setConfirm(false);}}><option value="">{loading?'Loading accounts…':'Select verified active user'}</option>{active.map(u=><option key={adminId(field(u,'id'))} value={adminId(field(u,'id'))}>#{adminId(field(u,'id'))} · {str(u,'email')}</option>)}</select></label>
     <label className="form-field">Capability *<select className="form-input" value={capability} required onChange={e=>{setCapability(e.target.value);setConfirm(false);}}><option value="">Choose capability</option>{CAPABILITIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
     <label className="form-field">Reviewer-approved evidence file ID *<input className="form-input" required inputMode="numeric" value={evidenceId} onChange={e=>{setEvidenceId(e.target.value);setConfirm(false);}}/></label>
    </>}
    {operation==='revoke'&&<label className="form-field">Existing capability grant ID *<input className="form-input" inputMode="numeric" required value={capabilityId} onChange={e=>{setCapabilityId(e.target.value);setConfirm(false);}}/></label>}
    {operation==='reunion'&&<label className="form-field">Submitted reunion claim ID *<input className="form-input" inputMode="numeric" required value={claimId} onChange={e=>{setClaimId(e.target.value);setConfirm(false);}}/></label>}
    <label className="form-field">Audit reason *<input className="form-input" required maxLength={80} value={reason} onChange={e=>{setReason(e.target.value);setConfirm(false);}}/></label>
   </div><Button type="submit" variant="secondary" disabled={busy||operation==='grant'&&(loading||!!usersError)}>Review verification request</Button></form>
   {confirm&&<div className="admin-confirm" role="group" aria-label="Confirm verification action"><p>Confirm <strong>{operation}</strong>? The server will enforce account status, evidence safety and current eligibility.</p><div className="row-actions"><Button type="button" loading={busy} variant={operation==='revoke'?'danger':'primary'} onClick={()=>void save()}>Confirm verification action</Button><Button type="button" variant="secondary" disabled={busy} onClick={()=>setConfirm(false)}>Keep editing</Button></div></div>}
   {error&&<p role="alert" className="form-alert">{error}</p>}{success&&<p role="status" className="success-message">{success}</p>}
   <div className="disclaimer">The user directory lists at most 100 recent accounts. There is no capability-grant history or reunion-claim index endpoint: revoke and claim-verification requests require a verified ID obtained through an authorized review workflow. Uploaded evidence is not automatically approved. The server must confirm SAFE, reviewer-only evidence.</div>
  </div>
 </section>;
}
