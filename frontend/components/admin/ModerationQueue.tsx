'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {field,rows,str,type Row} from '@/lib/types/domain';
import {Button} from '@/components/ui/Button';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';
import {adminId,adminMessage,AdminValidationError,decisionPayload,filterReports,REVIEW_TYPES} from '@/lib/admin/operations';

export function ModerationQueue(){
 const [reports,setReports]=useState<Row[]>([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const [search,setSearch]=useState(''),[typeFilter,setTypeFilter]=useState('ALL');
 const [entityType,setEntityType]=useState(''),[entityId,setEntityId]=useState(''),[reason,setReason]=useState('');
 const [decision,setDecision]=useState<'approve'|'reject'|''>(''),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false);
 const [actionError,setActionError]=useState(''),[success,setSuccess]=useState('');
 const load=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);setLoadError('');
  try{setReports(rows(await api('/admin/moderation',{signal})));}
  catch(error){if(!signal?.aborted){setReports([]);setLoadError(adminMessage(error,'Unable to load the report queue.'));}}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return ()=>controller.abort();},[load]);
 const visible=useMemo(()=>filterReports(reports,search,typeFilter),[reports,search,typeFilter]);
 const safeReports=useMemo(()=>filterReports(reports,'','ALL'),[reports]);
 function stage(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setActionError('');setSuccess('');
  try{decisionPayload(entityType,entityId,decision==='approve'?true:decision==='reject'?false:null as unknown as boolean,reason);setConfirm(true);}
  catch(error){setActionError(adminMessage(error,'Invalid listing review.'));}
 }
 async function submit(){
  if(busy||!confirm)return;
  setBusy(true);setActionError('');setSuccess('');
  try{const body=decisionPayload(entityType,entityId,decision==='approve',reason);
   const result=await api<Row>('/admin/moderation/decision',{method:'POST',body});
   setSuccess(`Listing #${body.entityId}: backend confirmed ${str(result,'status')||'decision recorded'}. Content report statuses are separate.`);
   setConfirm(false);setEntityId('');setReason('');setDecision('');
   await load();
  }catch(error){setActionError(adminMessage(error,'The backend did not accept the listing decision.'));setConfirm(false);}
  finally{setBusy(false);}
 }
 return <div className="admin-moderation-layout">
  <section className="panel"><div className="flex-between"><h2>Open content reports</h2><Button variant="secondary" type="button" onClick={()=>void load()} disabled={loading}>Refresh queue</Button></div>
   <p className="hint">These are user-submitted reports, not pending listing approvals. The current API exposes no report-case decision endpoint. Review reports separately; these rows cannot be marked resolved here.</p>
   <div className="filter-bar"><label className="form-field">Search reports<input className="form-input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Report ID, listing ID or reason"/></label>
    <label className="form-field">Filter by listing type<select className="form-input" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="ALL">All types</option>{REVIEW_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></label></div>
   {loading?<div className="loading-card" role="status">Loading moderation reports…</div>:loadError?<ErrorState message={loadError} onRetry={()=>void load()}/>:safeReports.length===0?<EmptyState title="No open content reports" description="The private report queue has no entries right now."/>:visible.length===0?<EmptyState title="No matching reports" description="Try a different filter or search."/>:<div className="admin-review-list">{visible.map(r=><div className="moderation-row" key={adminId(field(r,'id'))}><div><strong>Report #{adminId(field(r,'id'))} · {str(r,'entityType')} listing #{adminId(field(r,'entityId'))}</strong><p>Concern: {str(r,'reasonCode')||'Not specified'} · Report state: {str(r,'status')}</p><small className="hint">Review privately. A content report is not a listing-review request.</small></div></div>)}</div>}
  </section>
  <section className="panel"><h2>Review a pending listing</h2>
   <p className="hint">Use a verified listing ID and its current backend review state. This endpoint approves or rejects <strong>listings</strong> only; it does not close content reports. Backend rules still verify state and required evidence.</p>
   <form className="action-form" onSubmit={stage}><div className="form-grid">
    <label className="form-field">Listing type *<select className="form-input" required value={entityType} onChange={e=>{setEntityType(e.target.value);setConfirm(false);}}><option value="">Select type</option>{REVIEW_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
    <label className="form-field">Listing ID *<input className="form-input" required inputMode="numeric" value={entityId} onChange={e=>{setEntityId(e.target.value);setConfirm(false);}}/></label>
    <label className="form-field">Decision *<select className="form-input" required value={decision} onChange={e=>{setDecision(e.target.value as 'approve'|'reject'|'');setConfirm(false);}}><option value="">Choose</option><option value="approve">Approve listing</option><option value="reject">Reject listing</option></select></label>
    <label className="form-field">Audit reason *<input className="form-input" required value={reason} onChange={e=>{setReason(e.target.value);setConfirm(false);}} maxLength={80}/></label>
   </div><Button type="submit" variant="secondary" disabled={busy}>Review decision</Button></form>
   {confirm&&<div className="admin-confirm" role="group" aria-label="Confirm listing decision"><p>Confirm <strong>{decision.toUpperCase()}</strong> for {entityType} listing #{adminId(entityId)}? This changes the listing state if the server accepts it.</p><div className="row-actions"><Button type="button" variant={decision==='reject'?'danger':'primary'} loading={busy} onClick={()=>void submit()}>Confirm listing decision</Button><Button type="button" variant="secondary" disabled={busy} onClick={()=>setConfirm(false)}>Keep editing</Button></div></div>}
   {actionError&&<p role="alert" className="form-alert">{actionError}</p>}{success&&<p role="status" className="success-message">{success}</p>}
  </section>
 </div>;
}
