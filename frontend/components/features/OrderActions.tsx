'use client';

import {useState} from 'react';
import {api} from '@/lib/api/client';
import {positiveId} from '@/lib/shop/catalog';
import type {OrderStatus} from '@/lib/orders/records';

/** A cancellation is final only after the backend returns 204. Payment-in-progress checks remain server-side. */
export function OrderActions({id,status,onCancelled}:{id:string;status:OrderStatus;onCancelled?:()=>void}){
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const eligible=!!positiveId(id)&&status==='PLACED';
 async function cancel(){
  if(!eligible||busy||!confirm)return;
  setBusy(true);setError('');setNotice('');
  try{
   await api(`/orders/${id}/cancel`,{method:'POST'});
   setConfirm(false);setNotice('Order cancelled successfully.');onCancelled?.();
  }catch(caught){setError(caught instanceof Error?caught.message:'Unable to cancel this order.');}
  finally{setBusy(false);}
 }
 if(!eligible)return null;
 return <div className="order-cancel-panel">
  <p className="hint">Only orders still in the PLACED state may be cancelled, and the server may reject cancellation if payment processing has started.</p>
  {!confirm?<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>{setError('');setConfirm(true);}}>Cancel unpaid order</button>:<div className="order-confirm-cancel">
   <p>Cancel this order and release its reserved stock? This cannot be undone.</p>
   <div className="row-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>{setConfirm(false);setError('');}}>Keep order</button>
    <button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void cancel()}>{busy?'Cancelling…':'Confirm cancellation'}</button></div>
  </div>}
  {error&&<p role="alert" className="form-alert">{error}</p>}
  {notice&&<p role="status" className="success-message">{notice}</p>}
 </div>;
}
