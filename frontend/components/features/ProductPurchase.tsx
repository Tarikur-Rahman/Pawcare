'use client';

import {useState} from 'react';
import {ShoppingCart} from 'lucide-react';
import Link from 'next/link';
import {api} from '@/lib/api/client';
import {positiveId} from '@/lib/shop/catalog';

export function ProductPurchase({id,availableQuantity=null,disabled=false}:{id:string;availableQuantity?:number|null;disabled?:boolean}){
 const [quantity,setQuantity]=useState('1'),[busy,setBusy]=useState(false),[success,setSuccess]=useState(''),[error,setError]=useState('');
 const max=availableQuantity===null?999:Math.min(999,availableQuantity);
 const soldOut=max===0;
 async function add(){
  setSuccess('');setError('');
  const productId=positiveId(id),qty=Number(quantity);
  if(!productId||!/^\d+$/.test(quantity)||!Number.isSafeInteger(qty)||qty<1||qty>max){setError(`Choose a quantity from 1 to ${max}.`);return;}
  setBusy(true);
  try{await api('/cart/items',{method:'PUT',body:{productId:Number(productId),quantity:qty}});setSuccess('Cart updated successfully.');}
  catch(e){setError(e instanceof Error?e.message:'Unable to update cart.');}
  finally{setBusy(false);}
 }
 return <div className="shop-purchase">
  {soldOut?<p className="shop-stockout">This product is currently out of stock.</p>:null}
  <label className="form-field">Quantity<input aria-label="Quantity" className="form-input" type="number" min="1" max={Math.max(max,1)} step="1" value={quantity} disabled={busy||soldOut||disabled} onChange={e=>setQuantity(e.target.value)}/></label>
  <button className="btn btn-primary" type="button" disabled={busy||soldOut||disabled} onClick={()=>void add()}><ShoppingCart size={16} aria-hidden="true"/>{busy?'Updating…':'Add to cart'}</button>
  {disabled&&<p className="hint">This product cannot currently be purchased.</p>}
  {error&&<p role="alert" className="form-alert">{error}</p>}
  {success&&<p role="status" className="success-message">{success} <Link href="/cart" className="inline-link">View cart</Link></p>}
 </div>;
}
