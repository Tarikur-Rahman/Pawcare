import {field,str,type Row} from '@/lib/types/domain';

export const FAVORITE_TYPES=['ADOPTION','PET_SALE','LOST_FOUND','FOOD_PRODUCT'] as const;
export type FavoriteType=typeof FAVORITE_TYPES[number];
export const REPORT_TYPES=[...FAVORITE_TYPES,'DONATION'] as const;
export const REPORT_REASONS=['FRAUD','ABUSE','ILLEGAL','PRIVACY','SPAM','MISLEADING','OTHER'] as const;
export type ReportReason=typeof REPORT_REASONS[number];
const favoriteLabels:Record<FavoriteType,string>={ADOPTION:'Adoption',PET_SALE:'Pet marketplace',LOST_FOUND:'Lost & found',FOOD_PRODUCT:'Food product'};
const favoriteRoutes:Record<FavoriteType,string>={ADOPTION:'/adopt/',PET_SALE:'/marketplace/',LOST_FOUND:'/lost-found/',FOOD_PRODUCT:'/shop/'};

/** API IDs must be positive, safe integers before entering an API route or JSON body. */
export function contentId(value:unknown):string {
 const valueText=typeof value==='string'?value.trim():typeof value==='number'?String(value):'';
 if(!/^\d+$/.test(valueText))return '';
 const id=Number(valueText);
 return Number.isSafeInteger(id)&&id>0?String(id):'';
}
export function favoriteType(value:unknown):FavoriteType|'' {
 const type=typeof value==='string'?value.trim().toUpperCase():'';
 return (FAVORITE_TYPES as readonly string[]).includes(type)?type as FavoriteType:'';
}
export function favoriteLink(row:Row):string {
 const type=favoriteType(field(row,'entityType'));
 const id=contentId(field(row,'entityId'));
 return type&&id?favoriteRoutes[type]+id:'';
}
export function favoriteLabel(row:Row):string {
 const type=favoriteType(field(row,'entityType'));
 return type?favoriteLabels[type]:'Unsupported listing';
}
export function validFavorite(row:Row):boolean {
 return !!(contentId(field(row,'id','favoriteId'))&&favoriteLink(row));
}
export function filterFavorites(items:Row[],search:string,type:string):Row[] {
 const keyword=search.trim().toLocaleLowerCase();
 return items.filter(row=>validFavorite(row)&&(!type||type==='ALL'||favoriteType(field(row,'entityType'))===type)
  &&(!keyword||[favoriteLabel(row),str(row,'entityId'),str(row,'id')].some(v=>v.toLocaleLowerCase().includes(keyword))));
}
export class ContentFormError extends Error {
 constructor(public field:string,message:string){super(message);this.name='ContentFormError';}
}
export function favoritePayload(type:unknown,id:unknown){
 const entityType=favoriteType(type),entityId=contentId(id);
 if(!entityType)throw new ContentFormError('entityType','Unsupported favorite type.');
 if(!entityId)throw new ContentFormError('entityId','Invalid listing identifier.');
 return {entityType,entityId:Number(entityId)};
}
export function reportPayload(type:unknown,id:unknown,reason:unknown,details:unknown){
 const rawType=typeof type==='string'?type.trim().toUpperCase():'';
 const rawReason=typeof reason==='string'?reason.trim().toUpperCase():'';
 const entityId=contentId(id);
 if(!(REPORT_TYPES as readonly string[]).includes(rawType))throw new ContentFormError('entityType','Unsupported report type.');
 if(!entityId)throw new ContentFormError('entityId','Invalid listing identifier.');
 if(!(REPORT_REASONS as readonly string[]).includes(rawReason))throw new ContentFormError('reasonCode','Select a valid report reason.');
 const text=typeof details==='string'?details.trim():'';
 if(new TextEncoder().encode(text).length>3000)throw new ContentFormError('details','Additional details must not exceed 3000 UTF-8 bytes.');
 return {entityType:rawType,entityId:Number(entityId),reasonCode:rawReason,details:text||null};
}
export function contentError(caught:unknown,fallback:string):string{return caught instanceof Error?caught.message:fallback;}
