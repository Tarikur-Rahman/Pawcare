'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {api} from '@/lib/api/client';
import {field,rows,str,type Row} from '@/lib/types/domain';
import {checkoutProblem,newCheckoutKey,positiveId,shippingAddresses} from '@/lib/shop/catalog';
import {CartSummary} from '@/components/shop/CartSummary';
import {ErrorState} from '@/components/ui/ErrorState';

export function CheckoutForm(){
 const router=useRouter();
 const [addresses,setAddresses]=useState<Row[]>([]),[items,setItems]=useState<Row[]>([]);
 const [addressId,setAddressId]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [loadError,setLoadError]=useState(''),[submitError,setSubmitError]=useState(''),[reload,setReload]=useState(0);
 const [key,setKey]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setLoadError('');
  Promise.all([api('/users/me/addresses',{signal:controller.signal}),api('/cart',{signal:controller.signal})])
   .then(([addressData,cartData])=>{
    if(controller.signal.aborted)return;
    const available=shippingAddresses(rows(addressData));setAddresses(available);setItems(rows(cartData));
    setAddressId(current=>available.some(a=>positiveId(field(a,'id','addressId'))===current)?current:positiveId(field(available[0],'id','addressId')));
   }).catch(e=>{if(!controller.signal.aborted)setLoadError(e instanceof Error?e.message:'Unable to load checkout details.');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const problem=checkoutProblem(items);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setSubmitError('');
  const selected=addresses.find(row=>positiveId(field(row,'id','addressId'))===addressId);
  if(!selected||problem||loading){setSubmitError(problem||'Select a valid shipping address.');return;}
  // A retry reuses the same key. Changing the address uses a new key to avoid replaying a different request.
  const currentKey=key||newCheckoutKey();if(!key)setKey(currentKey);
  setBusy(true);
  try{
   const order=await api<Row>('/checkout',{method:'POST',body:{shippingAddressId:Number(addressId)},idempotencyKey:currentKey});
   const id=positiveId(field(order,'id'));
   if(!id)throw new Error('The order was submitted but its identifier was not returned. Check your orders before trying again.');
   router.push(`/orders/${id}`);
  }catch(e){setSubmitError(e instanceof Error?e.message:'Unable to place the order.');}
  finally{setBusy(false);}
 }
 return <section className="panel shop-checkout-form"><h2>Shipping & order review</h2>
  {loadError&&<ErrorState message={loadError} onRetry={()=>setReload(value=>value+1)}/>}
  {loading?<p className="hint" role="status">Loading saved shipping addresses and cart…</p>:loadError?null:<>
   <CartSummary items={items}/>
   {problem&&<p role="alert" className="form-alert">{problem} <Link className="inline-link" href="/cart">Review cart</Link></p>}
   {!addresses.length&&<p role="alert" className="form-alert">You need a saved shipping address before checkout. <Link href="/profile" className="inline-link">Add a shipping address</Link>.</p>}
   <form onSubmit={e=>void submit(e)}><label className="form-field">Delivery address
    <select className="form-input" aria-label="Delivery address" value={addressId} disabled={busy||!addresses.length} onChange={e=>{setAddressId(e.target.value);setKey('');setSubmitError('');}} required>
     {!addresses.length&&<option value="">No shipping addresses</option>}
     {addresses.map(a=>{const id=positiveId(field(a,'id','addressId'));return <option key={id} value={id}>{[str(a,'recipientName'),str(a,'line1'),str(a,'city')].filter(Boolean).join(' · ')||`Address ${id}`}</option>;})}
    </select></label>
    <p className="hint">Only active shipping addresses can be used. Billing addresses are not eligible.</p>
    {submitError&&<p role="alert" className="form-alert">{submitError}</p>}
    <button className="btn btn-primary" type="submit" disabled={busy||!!problem||!addresses.length}>{busy?'Submitting order…':'Reserve stock & place unpaid order'}</button>
   </form>
   <p className="disclaimer">PawCare creates an unpaid order and reserves available stock. Online payment is currently unavailable. A failed connection may leave an order submitted; check your order history before making a new request.</p>
  </>}
 </section>;
}
