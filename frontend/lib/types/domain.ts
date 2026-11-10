export type Role = 'OWNER' | 'VET' | 'ADMIN';
export type RecordValue = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];
export type Row = Record<string, unknown>;
export type ApiEnvelope<T> = { data: T; requestId?: string };
export type ApiPage<T> = { items: T[]; total: number; page: number; pageSize: number; requestId?: string };
export type ApiErrorBody = { code?:string; message?:string; requestId?:string; fieldErrors?:Record<string,string[]> };
export type User = { id:string; displayName:string; email:string; role:Role; status?:string };
export type Pet = { id:string; name:string; species:string; breed?:string; sex?:string; status?:string };
export type Adoption = { id:string; title:string; species?:string; description?:string; generalArea?:string; status?:string; postedAt?:string };
export type Listing = Adoption & { askingMinor?:number; currency?:string };
export type Product = { id:string; title:string; brand?:string; description?:string; species?:string; priceMinor:number; currency:string; availableQuantity?:number; ingredients?:string; allergens?:string; weightGrams?:number };
export type CartItem = { productId:string; title:string; quantity:number; priceMinor:number; currency:string };
// Oracle dictionary result casing varies by provider; normalize at the UI boundary.
export function field(row:Row | null | undefined, ...keys:string[]):unknown {
 if(!row) return undefined;
 for(const key of keys){
   if(Object.prototype.hasOwnProperty.call(row,key))return row[key];
   const found=Object.keys(row).find(k=>k.toLowerCase()===key.toLowerCase());
   if(found)return row[found];
 }
 return undefined;
}
export const str = (row:Row | null | undefined,...keys:string[]):string => String(field(row,...keys)??'');
export const num = (row:Row | null | undefined,...keys:string[]):number => Number(field(row,...keys)??0);
export function rows(value:unknown):Row[] {
 if(Array.isArray(value))return value.filter((x):x is Row=>x!==null&&typeof x==='object'&&!Array.isArray(x));
 if(value&&typeof value==='object'&&'items'in value)return rows((value as {items:unknown}).items);
 return [];
}
export function normalizeUser(data:unknown):User {
 const r=(data??{}) as Row;
 const raw=str(r,'role','ROLE').toUpperCase();
 return { id:str(r,'id','userId','USER_ID'), email:str(r,'email','EMAIL'),
 displayName:str(r,'displayName','DISPLAY_NAME','name')||'PawCare member',
 role:raw==='ADMIN'?'ADMIN':raw==='VET'?'VET':'OWNER',status:str(r,'status','STATUS') };
}
