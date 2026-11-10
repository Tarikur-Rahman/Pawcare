import {field,str,type Row} from '@/lib/types/domain';

/** Whitelist Oracle-generated positive IDs before using them in routes or payloads. */
export function marketId(value:unknown):string {
 const raw=typeof value==='number'?String(value):typeof value==='string'?value.trim():'';
 if(!/^[1-9]\d*$/.test(raw))return '';
 const numeric=Number(raw);
 return Number.isSafeInteger(numeric)&&numeric>0?String(numeric):'';
}
export function marketSpecies(item:Row):string{return str(item,'species').trim().toUpperCase();}
export function marketCurrency(item:Row):string{
 const value=str(item,'currency').trim().toUpperCase();
 return /^[A-Z]{3}$/.test(value)?value:'';
}
export function marketPrice(item:Row):number|null {
 const value=field(item,'askingMinor');
 if(value===null||value===undefined||value==='')return null;
 const number=Number(value);
 return Number.isSafeInteger(number)&&number>0?number:null;
}
export function filterMarket(items:Row[],query:string,species:string,sort:'NEWEST'|'PRICE_ASC'|'PRICE_DESC'):Row[] {
 const needle=query.trim().toLocaleLowerCase();
 const filtered=items.filter(row=>{
  if(!marketId(field(row,'id','listingId')))return false;
  if(species!=='ALL'&&marketSpecies(row)!==species)return false;
  return !needle||[str(row,'title'),str(row,'description'),str(row,'species'),str(row,'generalArea'),marketId(field(row,'id'))]
   .some(text=>text.toLocaleLowerCase().includes(needle));
 });
 if(sort==='NEWEST')return filtered;
 return [...filtered].sort((a,b)=>{
  const pa=marketPrice(a),pb=marketPrice(b);
  if(pa===null)return pb===null?0:1;
  if(pb===null)return -1;
  const ca=marketCurrency(a),cb=marketCurrency(b);
  if(ca!==cb)return ca.localeCompare(cb);
  return sort==='PRICE_ASC'?pa-pb:pb-pa;
 });
}
export class MarketFormError extends Error{
 constructor(public field:string,message:string){super(message);this.name='MarketFormError';}
}
export function marketText(value:string,field:string,label:string,min:number,max:number):string {
 const cleaned=value.trim();
 if(cleaned.length<min||new TextEncoder().encode(cleaned).length>max)
  throw new MarketFormError(field,`${label} must contain at least ${min} characters and no more than ${max} UTF-8 bytes.`);
 return cleaned;
}
export type SaleDraftFields={petId:string;title:string;description:string;generalArea:string;askingMinor:string;currency:string;welfareEvidenceFileId:string};
export function saleDraftPayload(values:SaleDraftFields,activePets:Row[]){
 const petId=marketId(values.petId);
 if(!petId||!activePets.some(p=>marketId(field(p,'id','petId'))===petId&&eligibleMarketPet(p)))
  throw new MarketFormError('petId','Choose an active pet from your account.');
 const title=marketText(values.title,'title','Headline',1,180);
 const description=marketText(values.description,'description','Pet description',20,4000);
 const generalArea=marketText(values.generalArea,'generalArea','General area',1,160);
 const amount=values.askingMinor.trim();
 if(!/^[1-9]\d*$/.test(amount)||!Number.isSafeInteger(Number(amount)))
  throw new MarketFormError('askingMinor','Enter a positive whole-number price in minor currency units.');
 const currency=values.currency.trim().toUpperCase();
 if(!/^[A-Z]{3}$/.test(currency))throw new MarketFormError('currency','Use a three-letter currency code, such as BDT.');
 const evidenceId=marketId(values.welfareEvidenceFileId);
 if(!evidenceId)throw new MarketFormError('welfareEvidenceFileId','Enter a valid positive reviewer-only welfare evidence file ID.');
 return {petId:Number(petId),title,description,generalArea,askingMinor:Number(amount),currency,welfareEvidenceFileId:Number(evidenceId)};
}
export function eligibleMarketPet(row:Row):boolean{
 const status=str(row,'status').trim().toUpperCase();
 return !!marketId(field(row,'id','petId'))&&(!status||status==='ACTIVE');
}
export function inquiryPayload(listingId:string,message:string){
 const id=marketId(listingId);
 if(!id)throw new MarketFormError('listingId','This listing ID is invalid.');
 return {listingId:Number(id),message:marketText(message,'message','Inquiry',5,2000)};
}
export function filterInquiries(list:Row[],query:string,status:string):Row[]{
 const term=query.trim().toLocaleLowerCase();
 return list.filter(row=>{
  if(!marketId(field(row,'id','inquiryId'))||!marketId(field(row,'listingId')))return false;
  if(status!=='ALL'&&str(row,'status').trim().toUpperCase()!==status)return false;
  return !term||[str(row,'message'),str(row,'status'),marketId(field(row,'id')),marketId(field(row,'listingId'))]
   .some(text=>text.toLocaleLowerCase().includes(term));
 });
}
export function marketDate(value:unknown):string{
 const time=Date.parse(typeof value==='string'?value:'');
 return Number.isFinite(time)?new Intl.DateTimeFormat('en-BD',{dateStyle:'medium'}).format(new Date(time)):'Date unavailable';
}
export function marketError(caught:unknown,fallback:string):string{return caught instanceof Error?caught.message:fallback;}
