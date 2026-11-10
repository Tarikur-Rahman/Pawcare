'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {RefreshCw,Truck} from 'lucide-react';
import {api} from '@/lib/api/client';
import {rows,str,type Row} from '@/lib/types/domain';
import {formatMoney} from '@/lib/utils/currency';
import {OrderActions} from '@/components/features/OrderActions';
import {StatusBadge} from '@/components/ui/StatusBadge';
import {ErrorState} from '@/components/ui/ErrorState';
import {orderCurrency,orderDate,orderId,orderNumber,orderStatus,orderTotalMinor,shipmentId,shipmentTracking} from '@/lib/orders/records';

export function OrderDetailWorkspace({initialOrder}:{initialOrder:Row}){
 const [order,setOrder]=useState<Row>(initialOrder);
 const [shipments,setShipments]=useState<Row[]>([]),[shipmentsLoading,setShipmentsLoading]=useState(false),[shipmentsError,setShipmentsError]=useState(''),[refresh,setRefresh]=useState(0);
 const id=orderId(order),status=orderStatus(order),amount=orderTotalMinor(order),currency=orderCurrency(order);
 const canHaveShipment=['SHIPPED','DELIVERED'].includes(status);
 useEffect(()=>{
  if(!canHaveShipment||!id)return;
  const controller=new AbortController();setShipmentsLoading(true);setShipmentsError('');
  api(`/orders/${id}/shipments/`,{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setShipments(rows(value));})
   .catch(caught=>{if(!controller.signal.aborted)setShipmentsError(caught instanceof Error?caught.message:'Shipment details unavailable.');})
   .finally(()=>{if(!controller.signal.aborted)setShipmentsLoading(false);});
  return ()=>controller.abort();
 },[id,canHaveShipment,refresh]);
 return <section className="page-section order-detail-page">
  <div className="page-heading"><div><Link href="/orders" className="inline-link">← My orders</Link><span className="eyebrow">FOOD ORDER DETAILS</span>
   <h1>{orderNumber(order)}</h1><p>Order status is retrieved from PawCare. Shipment information is displayed only when available.</p></div><StatusBadge status={status}/></div>
  <div className="dashboard-lower order-detail-layout"><div className="panel"><h2>Order summary</h2>
   <dl className="order-detail-fields">
    <div><dt>Order number</dt><dd>{orderNumber(order)}</dd></div>
    <div><dt>Order ID</dt><dd>{id||'Unavailable'}</dd></div>
    <div><dt>Placed</dt><dd>{orderDate(order)}</dd></div>
    <div><dt>Status</dt><dd><StatusBadge status={status}/></dd></div>
    <div><dt>Total</dt><dd>{amount===null||!currency?'Unavailable':formatMoney(amount,currency)}</dd></div>
    <div><dt>Currency</dt><dd>{currency||'Unavailable'}</dd></div>
   </dl>
   <OrderActions id={id} status={status} onCancelled={()=>setOrder(current=>({...current,status:'CANCELLED'}))}/>
  </div><aside className="panel"><h2>Payment & next steps</h2>
   {status==='PLACED'?<p>Order placed. PawCare has not confirmed payment. Cancellation may be available while payment has not started.</p>
    :status==='CANCELLED'?<p>This order has been cancelled.</p>
    :status==='PAID'?<p>The order status is PAID. Payment transaction details are not provided by this endpoint.</p>
    :status==='PACKED'?<p>This order has been marked as packed.</p>
    :status==='SHIPPED'?<p>This order is marked as shipped. Check shipment information below.</p>
    :status==='DELIVERED'?<p>This order is marked as delivered.</p>
    :status==='REFUNDED'?<p>This order is marked as refunded. Refund details are not provided by this endpoint.</p>
    :<p>Additional payment information is not available from this order summary.</p>}
   <p className="hint">The current order-detail API does not return product-line details, payment transaction IDs, or a shipping address snapshot. Those details are not inferred.</p>
   <Link href="/shop" className="btn btn-secondary">Continue shopping</Link>
  </aside></div>
  {canHaveShipment&&<div className="panel order-shipment-panel"><div className="medical-section-header"><div><h2>Shipment tracking</h2><p>Carrier and tracking references reported by the fulfillment service.</p></div>
   <button type="button" disabled={shipmentsLoading} className="btn btn-secondary" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/>Refresh shipments</button></div>
   {shipmentsError&&<ErrorState message={shipmentsError} onRetry={()=>setRefresh(n=>n+1)}/>}
   {shipmentsLoading?<p role="status" className="hint">Loading shipment information…</p>:shipmentsError?null:
    !shipments.length?<p className="hint">No shipment records returned for this order.</p>:
    <ul className="order-shipments">{shipments.map((shipment,index)=><li key={shipmentId(shipment)||`shipment-${index}`}><Truck size={20} aria-hidden="true"/>
     <div><strong>{str(shipment,'carrier')||'Carrier unavailable'}</strong><p>Tracking: {shipmentTracking(shipment)}</p>
      <p>Shipment status: <StatusBadge status={str(shipment,'status')}/></p>
      {str(shipment,'shippedAt')&&<p>Shipped: {str(shipment,'shippedAt')}</p>}
      {str(shipment,'deliveredAt')&&<p>Delivered: {str(shipment,'deliveredAt')}</p>}
     </div></li>)}</ul>}
  </div>}
 </section>;
}
