import {field,str,type Row} from '@/lib/types/domain';
import {positiveId} from '@/lib/shop/catalog';

/** API: GET /orders and /orders/{id} expose an order summary, not order-item lines. */
export type OrderFilter='ALL'|'PLACED'|'IN_PROGRESS'|'DELIVERED'|'CLOSED';
export const ORDER_STATUSES=['PLACED','PAID','PACKED','SHIPPED','DELIVERED','CANCELLED','REFUNDED'] as const;
export type OrderStatus=typeof ORDER_STATUSES[number]|'UNKNOWN';
export function orderId(row:Row|null|undefined):string{return positiveId(field(row,'id','orderId'));}
export function orderStatus(row:Row|null|undefined):OrderStatus{
 const value=str(row,'status').trim().toUpperCase();
 return (ORDER_STATUSES as readonly string[]).includes(value)?value as OrderStatus:'UNKNOWN';
}
export function orderNumber(row:Row|null|undefined):string{
 const value=str(row,'orderNumber').trim();
 return value|| (orderId(row)?`Order #${orderId(row)}`:'Order number unavailable');
}
export function orderTotalMinor(row:Row|null|undefined):number|null{
 const raw=field(row,'totalMinor');
 if(raw===undefined||raw===null||raw===''||typeof raw==='boolean')return null;
 const value=Number(raw);
 return Number.isSafeInteger(value)&&value>=0?value:null;
}
export function orderCurrency(row:Row|null|undefined):string|null{
 const raw=str(row,'currency').trim().toUpperCase();
 return /^[A-Z]{3}$/.test(raw)?raw:null;
}
export function orderTimestamp(row:Row|null|undefined):number|null{
 const raw=field(row,'createdAt');
 if(typeof raw!=='string'||!raw.trim())return null;
 const time=Date.parse(raw);
 return Number.isFinite(time)?time:null;
}
export function orderDate(row:Row|null|undefined):string{
 const t=orderTimestamp(row);
 return t===null?'Date unavailable':new Intl.DateTimeFormat('en-BD',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Dhaka'}).format(new Date(t));
}
export function orderIsCancelable(row:Row|null|undefined):boolean{
 // The API does the final authorization and checks that payment is not in progress.
 return !!orderId(row)&&orderStatus(row)==='PLACED';
}
export function orderMatchesFilter(row:Row,filter:OrderFilter):boolean{
 const s=orderStatus(row);
 if(filter==='ALL')return true;
 if(filter==='PLACED')return s==='PLACED';
 if(filter==='IN_PROGRESS')return s==='PAID'||s==='PACKED'||s==='SHIPPED';
 if(filter==='DELIVERED')return s==='DELIVERED';
 return s==='CANCELLED'||s==='REFUNDED';
}
export function filterOrders(items:Row[],filter:OrderFilter,search:string):Row[]{
 const needle=search.trim().toLocaleLowerCase();
 return items.filter(row=>orderMatchesFilter(row,filter)&&(!needle||[
  orderNumber(row),orderId(row),orderStatus(row),str(row,'currency')
 ].some(v=>v.toLocaleLowerCase().includes(needle))));
}
export function newestOrders(items:Row[]):Row[]{
 return [...items].sort((a,b)=>(orderTimestamp(b)??-Infinity)-(orderTimestamp(a)??-Infinity));
}
export function orderSummary(items:Row[]){
 return {recent:items.length,placed:items.filter(i=>orderStatus(i)==='PLACED').length,
  inProgress:items.filter(i=>orderMatchesFilter(i,'IN_PROGRESS')).length,
  delivered:items.filter(i=>orderStatus(i)==='DELIVERED').length};
}
export function shipmentId(row:Row):string{return positiveId(field(row,'id','shipmentId'));}
export function shipmentTracking(row:Row):string{
 const raw=str(row,'trackingRef').trim();return raw||'Not provided';
}
