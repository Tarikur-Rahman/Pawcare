'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {RefreshCw,Trash2} from 'lucide-react';
import {api} from '@/lib/api/client';
import {rows,str,num,type Row} from '@/lib/types/domain';
import {checkoutProblem,positiveId,productCurrency,productPrice} from '@/lib/shop/catalog';
import {formatMoney} from '@/lib/utils/currency';
import {CartSummary} from '@/components/shop/CartSummary';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';

export function CartWorkspace(){
 const [items,setItems]=useState<Row[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const load=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);
  try{const loaded=rows(await api('/cart',{signal}));if(signal?.aborted)return;setItems(loaded);setError('');}
  catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'Unable to load cart.');}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return ()=>controller.abort();},[load]);
 async function update(item:Row,quantity:number){
  const id=positiveId(item.productId);
  if(!id||!Number.isSafeInteger(quantity)||quantity<0||quantity>999){setError('Invalid product or quantity. Refresh your cart.');return;}
  setBusy(true);setError('');setNotice('');
  try{await api('/cart/items',{method:'PUT',body:{productId:Number(id),quantity}});await load();setNotice(quantity===0?'Product removed from cart.':'Quantity saved.');}
  catch(e){setError(e instanceof Error?e.message:'Unable to update cart.');}
  finally{setBusy(false);}
 }
 const problem=checkoutProblem(items);
 return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">PAWCARE FOOD STORE</span><h1>Your shopping cart</h1><p>Review products and quantities before placing an unpaid order.</p></div>
  <div className="row-actions"><Link href="/shop" className="btn btn-secondary">Continue shopping</Link><button className="btn btn-secondary" type="button" disabled={loading||busy} onClick={()=>{setNotice('');void load();}}><RefreshCw size={16} aria-hidden="true"/> Refresh</button></div></div>
  {error&&<ErrorState message={error} onRetry={()=>{setNotice('');void load();}}/>}
  {notice&&!error&&<p role="status" className="success-message">{notice}</p>}
  {loading?<p className="loading-card" role="status">Loading your cart…</p>:error?null:!items.length?
   <EmptyState title="Your cart is empty" description="Browse the store to find food and treats for your companion." href="/shop" action="Browse products"/>:
   <div className="dashboard-lower shop-cart-layout"><div className="panel"><h2>Cart items</h2>
    <ul className="shop-cart-items">{items.map((item,i)=>{
     const id=positiveId(item.productId),qty=num(item,'quantity'),price=productPrice(item);
     return <li className="shop-cart-item" key={id||`item-${i}`}><div className="shop-cart-item-main">
      <strong>{str(item,'title')||'Product'}</strong><p>{price===null?'Price unavailable':`${formatMoney(price,productCurrency(item))} each`}</p>
      {id&&<Link href={`/shop/${id}`} className="inline-link">Product details</Link>}
     </div><div className="shop-cart-actions"><div className="row-actions" aria-label={`Quantity controls for ${str(item,'title')||'product'}`}>
      <button className="btn btn-secondary btn-small" type="button" aria-label={`Decrease ${str(item,'title')} quantity`} disabled={busy||qty<1} onClick={()=>void update(item,qty-1)}>−</button>
      <span aria-label="Quantity">{qty}</span><button className="btn btn-secondary btn-small" type="button" aria-label={`Increase ${str(item,'title')} quantity`} disabled={busy||qty>=999} onClick={()=>void update(item,qty+1)}>+</button>
     </div><button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={()=>void update(item,0)}><Trash2 size={14} aria-hidden="true"/> Remove</button></div></li>;
    })}</ul>
   </div><aside><CartSummary items={items}/>{problem?<p className="form-alert shop-checkout-warning" role="alert">{problem}</p>:
    <Link href="/checkout" className="btn btn-primary shop-checkout-link">Proceed to checkout</Link>}
   </aside></div>}
 </section>;
}
