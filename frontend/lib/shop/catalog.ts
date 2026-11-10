import {field,num,str,type Row} from '@/lib/types/domain';

/** Public catalog and private cart mapping for the existing Oracle-backed API. */
export type SortMode='NEWEST'|'NAME'|'PRICE_ASC'|'PRICE_DESC';
export type CatalogFilter={query:string;species:string;category:string;stock:'ALL'|'AVAILABLE';sort:SortMode};

export function positiveId(value:unknown):string {
 if(typeof value!=='string'&&typeof value!=='number')return '';
 const raw=String(value);
 return /^\d+$/.test(raw)&&Number.isSafeInteger(Number(raw))&&Number(raw)>0?raw:'';
}
export function productId(row:Row):string{return positiveId(field(row,'id','productId'));}
export function stockAvailable(row:Row):number|null{
 const value=field(row,'availableQuantity');
 if(value===null||value===undefined||value==='')return null;
 const count=Number(value);
 return Number.isSafeInteger(count)&&count>=0?count:null;
}
export function productCurrency(row:Row):string {
 const currency=str(row,'currency').trim().toUpperCase();
 return /^[A-Z]{3}$/.test(currency)?currency:'BDT';
}
export function productPrice(row:Row):number|null{
 const value=field(row,'priceMinor');
 if(value===null||value===undefined||value==='')return null;
 const price=Number(value);
 return Number.isSafeInteger(price)&&price>=0?price:null;
}
export function filterCatalog(items:Row[],filter:CatalogFilter):Row[]{
 const needle=filter.query.trim().toLocaleLowerCase();
 const selected=items.filter(row=>{
  if(!productId(row))return false;
  if(filter.species!=='ALL'&&str(row,'species').trim().toUpperCase()!==filter.species)return false;
  if(filter.category!=='ALL'&&positiveId(field(row,'categoryId'))!==filter.category)return false;
  if(filter.stock==='AVAILABLE'&&stockAvailable(row)===0)return false;
  return !needle||['title','brand','species'].some(key=>str(row,key).toLocaleLowerCase().includes(needle));
 });
 if(filter.sort==='NEWEST')return selected;
 return [...selected].sort((a,b)=>{
  if(filter.sort==='NAME')return str(a,'title').localeCompare(str(b,'title'));
  const ap=productPrice(a),bp=productPrice(b);
  if(ap===null)return bp===null?0:1;
  if(bp===null)return -1;
  return filter.sort==='PRICE_ASC'?ap-bp:bp-ap;
 });
}
export function speciesOptions(products:Row[]):string[]{
 return [...new Set(products.map(p=>str(p,'species').trim().toUpperCase()).filter(Boolean))].sort();
}
export type CurrencyTotal={currency:string;totalMinor:number;quantity:number};
export function cartTotals(items:Row[]):CurrencyTotal[]{
 const totals=new Map<string,CurrencyTotal>();
 for(const row of items){
  const price=productPrice(row),quantity=num(row,'quantity');
  if(price===null||!Number.isSafeInteger(quantity)||quantity<1||quantity>999||price*quantity>Number.MAX_SAFE_INTEGER)continue;
  const code=productCurrency(row);const current=totals.get(code)||{currency:code,totalMinor:0,quantity:0};
  if(!Number.isSafeInteger(current.totalMinor+price*quantity))continue;
  current.totalMinor+=price*quantity;current.quantity+=quantity;totals.set(code,current);
 }
 return [...totals.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}
export function checkoutProblem(items:Row[]):string|null {
 if(items.length===0)return 'Your cart is empty.';
 if(items.some(row=>!positiveId(field(row,'productId'))||!Number.isInteger(num(row,'quantity'))||num(row,'quantity')<1||num(row,'quantity')>999||productPrice(row)===null))
  return 'The cart contains invalid item data. Refresh your cart.';
 if(new Set(items.map(productCurrency)).size>1)return 'Items in different currencies cannot be placed in the same order. Remove items until one currency remains.';
 return null;
}
export function shippingAddresses(addresses:Row[]):Row[]{
 return addresses.filter(row=>positiveId(field(row,'id','addressId'))&&str(row,'scope').trim().toUpperCase()==='SHIPPING'&&
  !['INACTIVE','DELETED','ARCHIVED'].includes(str(row,'status').toUpperCase()));
}
export function newCheckoutKey():string {
 // A cryptographically random, URL-safe key satisfying the backend's 12–160 char contract.
 const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
