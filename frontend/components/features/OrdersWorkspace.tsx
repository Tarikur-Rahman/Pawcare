'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {RefreshCw,Search,Package} from 'lucide-react';
import {api} from '@/lib/api/client';
import {rows,type Row} from '@/lib/types/domain';
import {formatMoney} from '@/lib/utils/currency';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {
 filterOrders,newestOrders,orderCurrency,orderDate,orderId,orderNumber,orderStatus,orderSummary,orderTotalMinor,type OrderFilter,
} from '@/lib/orders/records';

const FILTERS:{label:string;value:OrderFilter}[]=[
 {label:'All',value:'ALL'},{label:'Awaiting payment',value:'PLACED'},
 {label:'In progress',value:'IN_PROGRESS'},{label:'Delivered',value:'DELIVERED'},{label:'Closed',value:'CLOSED'},
];

export function OrdersWorkspace(){
 const [items,setItems]=useState<Row[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const [refresh,setRefresh]=useState(0),[search,setSearch]=useState(''),[filter,setFilter]=useState<OrderFilter>('ALL');
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  api('/orders',{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setItems(rows(value));})
   .catch(caught=>{if(!controller.signal.aborted)setError(caught instanceof Error?caught.message:'Unable to load orders.');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[refresh]);
 const summary=useMemo(()=>orderSummary(items),[items]);
 const visible=useMemo(()=>filterOrders(newestOrders(items),filter,search),[items,filter,search]);
 return <section className="page-section order-history-page">
  <div className="page-heading"><div><span className="eyebrow">PAWCARE FOOD STORE</span><h1>My orders</h1>
   <p>Check your recent food orders, view shipping information, and request eligible cancellations.</p></div>
   <div className="row-actions"><Link href="/shop" className="btn btn-secondary">Browse food</Link>
    <button type="button" className="btn btn-secondary" disabled={loading} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/> Refresh</button></div></div>
  {!error&&!loading&&<div className="order-stats" aria-label="Recent order summary">
   <div><strong>{summary.recent}</strong><span>Recent orders (max 100)</span></div>
   <div><strong>{summary.placed}</strong><span>Awaiting payment</span></div>
   <div><strong>{summary.inProgress}</strong><span>In progress</span></div>
   <div><strong>{summary.delivered}</strong><span>Delivered</span></div>
  </div>}
  <div className="panel order-list-panel"><div className="order-toolbar"><div className="medical-filters" aria-label="Filter orders">
   {FILTERS.map(option=><button key={option.value} type="button" className={`medical-filter${filter===option.value?' selected':''}`}
    aria-pressed={filter===option.value} onClick={()=>setFilter(option.value)}>{option.label}</button>)}
   </div><label className="order-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Search orders</span>
    <input aria-label="Search orders" type="search" className="form-input" placeholder="Order number, ID, status" value={search} onChange={event=>setSearch(event.target.value)}/></label></div>
   {error&&<ErrorState message={error} onRetry={()=>setRefresh(n=>n+1)}/>}
   {loading?<p className="hint" role="status">Loading your orders…</p>
    :error?null
    :!items.length?<EmptyState title="No orders yet" description="Food orders you place will appear here." href="/shop" action="Browse food"/>
    :!visible.length?<EmptyState title="No matching orders" description="Try another search or order status."/>
    :<ul className="order-history-list">{visible.map((order,index)=>{
     const id=orderId(order),amount=orderTotalMinor(order),currency=orderCurrency(order);
     return <li className="order-history-row" key={id||`order-${index}`}>
      <div className="order-row-icon" aria-hidden="true"><Package size={19}/></div>
      <div className="order-row-main"><strong>{orderNumber(order)}</strong><p>{orderDate(order)}{id?` · #${id}`:''}</p></div>
      <StatusBadge status={orderStatus(order)}/>
      <span className="order-row-total">{amount===null||!currency?'Total unavailable':formatMoney(amount,currency)}</span>
      {id?<Link className="btn btn-secondary btn-small" href={`/orders/${id}`}>View order</Link>:<span className="hint">Details unavailable</span>}
     </li>;
    })}</ul>}
  </div><p className="hint order-footer">Only your latest 100 orders are returned by the current PawCare API. Order totals are per order and are never combined across currencies.</p>
 </section>;
}
