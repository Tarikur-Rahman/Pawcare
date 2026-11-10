'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {field,rows,str,type Row} from '@/lib/types/domain';
import {Button} from '@/components/ui/Button';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';
import {activationPayload,adminId,adminMessage,filterUsers,isPendingOwner} from '@/lib/admin/operations';

export function AdminUsersWorkspace(){
 const [users,setUsers]=useState<Row[]>([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const [search,setSearch]=useState(''),[status,setStatus]=useState('ALL');
 const [selected,setSelected]=useState(''),[reviewed,setReviewed]=useState(false),[reason,setReason]=useState(''),[confirm,setConfirm]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const load=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);setLoadError('');try{setUsers(rows(await api('/admin/users',{signal})));}
  catch(e){if(!signal?.aborted){setUsers([]);setLoadError(adminMessage(e,'Unable to retrieve user directory.'));}}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
 const visible=useMemo(()=>filterUsers(users,search,status),[users,search,status]);
 const chosen=users.find(u=>adminId(field(u,'id'))===selected);
 function choose(u:Row){setSelected(adminId(field(u,'id')));setReviewed(false);setReason('');setConfirm(false);setError('');setSuccess('');}
 function stage(e:FormEvent<HTMLFormElement>){e.preventDefault();setError('');setSuccess('');
  try{activationPayload(chosen||{},reviewed,reason);setConfirm(true);}
  catch(err){setError(adminMessage(err,'Complete verification first.'));}
 }
 async function activate(){if(!chosen||!confirm||busy)return;
  setBusy(true);setError('');setSuccess('');try{const body=activationPayload(chosen,reviewed,reason);
   const result=await api<Row>(`/admin/users/${selected}/activate`,{method:'POST',body});
   setSuccess(`User #${selected}: backend confirmed ${str(result,'status')||'activation'}.`);
   setSelected('');setConfirm(false);setReviewed(false);setReason('');await load();
  }catch(err){setConfirm(false);setError(adminMessage(err,'Account activation was rejected.'));}
  finally{setBusy(false);}
 }
 return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">ACCOUNT SAFETY</span><h1>User directory & verification</h1><p>Review up to 100 recent accounts. Activation requires documented manual identity review.</p></div></div>
  <div className="panel"><div className="flex-between"><h2>Recent accounts</h2><Button type="button" variant="secondary" onClick={()=>void load()} disabled={loading}>Refresh users</Button></div>
   <div className="filter-bar"><label className="form-field">Search accounts<input className="form-input" type="search" placeholder="Email, ID, role" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <label className="form-field">Status<select className="form-input" value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All states</option><option value="PENDING_VERIFICATION">Pending verification</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label></div>
   {loading?<div className="loading-card" role="status">Loading accounts…</div>:loadError?<ErrorState message={loadError} onRetry={()=>void load()}/>:users.length===0?<EmptyState title="No accounts returned"/>:visible.length===0?<EmptyState title="No matching users"/>:<div className="admin-review-list">{visible.map(u=><div className="moderation-row" key={adminId(field(u,'id'))}><div><strong>#{adminId(field(u,'id'))} · {str(u,'email')}</strong><p>{str(u,'role')} · {str(u,'status')}</p></div><div className="row-actions">{isPendingOwner(u)?<Button type="button" variant="secondary" onClick={()=>choose(u)}>Review activation</Button>:<span className="hint">No activation action</span>}</div></div>)}</div>}
  </div>
  {selected&&chosen&&<div className="panel"><h2>Activate owner #{selected}</h2><p className="hint">Only a verified, pending owner may be activated. Checking the box records your attestation; the server performs its own checks.</p>
   <form onSubmit={stage} className="action-form"><label className="form-field"><span><input type="checkbox" checked={reviewed} onChange={e=>{setReviewed(e.target.checked);setConfirm(false);}}/> I have independently reviewed this account’s identity *</span></label>
    <label className="form-field">Audit reason / reference *<input className="form-input" required maxLength={80} value={reason} onChange={e=>{setReason(e.target.value);setConfirm(false);}}/></label><div className="row-actions"><Button type="submit" variant="secondary" disabled={busy}>Review activation request</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setSelected('');setConfirm(false);}}>Cancel</Button></div></form>
   {confirm&&<div className="admin-confirm" role="group" aria-label="Confirm account activation"><p>Confirm activation of owner #{selected} after identity review?</p><div className="row-actions"><Button type="button" loading={busy} onClick={()=>void activate()}>Confirm activation</Button><Button type="button" variant="secondary" disabled={busy} onClick={()=>setConfirm(false)}>Keep editing</Button></div></div>}
  </div>}
  {error&&<p role="alert" className="form-alert">{error}</p>}{success&&<p role="status" className="success-message">{success}</p>}
 </section>;
}
