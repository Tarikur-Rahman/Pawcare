export type Role = 'OWNER'|'VET'|'ADMIN';
export type Account = {id:number;email:string;role:Role;status:string;displayName:string;phone?:string;timeZone?:string;locale?:string};
export type Pet={id:number;name:string;species:string;breed?:string|null;sex?:string;dateOfBirth?:string;status?:string};
export type Adoption={id:number;title:string;description:string;species:string;generalArea:string;postedAt?:string};
export type SaleListing={id:number;title:string;description:string;species:string;generalArea:string;askingMinor:number;currency:string};
export type LostPost={id:number;category:string;species:string;generalArea:string;observedAt:string};
export type Product={id:number;title:string;brand?:string;description?:string;species?:string;priceMinor:number;currency:string;availableQuantity:number;ingredients?:string;allergens?:string};
export type CartLine={productId:number;title:string;quantity:number;priceMinor:number;currency:string};
export type Order={id:number;orderNumber?:string;status:string;totalMinor:number;currency:string;createdAt?:string};
export type Visit={id:number;petId:number;vetId:number;startsAt:string;endsAt:string;status:string;reason?:string};
export type ApiEnvelope<T>={data:T;requestId:string};
export const field=(obj:Record<string,unknown>|null|undefined,key:string):unknown=>{
 if(!obj)return undefined; const k=Object.keys(obj).find(v=>v.toLowerCase()===key.toLowerCase()); return k?obj[k]:undefined;
};
export function normalizeAccount(input:unknown):Account{
 const obj=(input||{}) as Record<string,unknown>;
 return {id:Number(field(obj,'id')||0), email:String(field(obj,'email')||''),role:String(field(obj,'role')||'OWNER').toUpperCase() as Role,
 status:String(field(obj,'status')||''),displayName:String(field(obj,'displayName')||field(obj,'DISPLAY_NAME')||'PawCare member'),
 phone:String(field(obj,'phone')||'')};
}
