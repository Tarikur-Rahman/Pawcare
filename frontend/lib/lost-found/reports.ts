import {field,str,type Row} from '@/lib/types/domain';

export type LostCategory='LOST'|'FOUND';
export type LostDraftFields={category:string;species:string;description:string;generalArea:string;observedAt:string};
export type SightingFields={approximateArea:string;observedAt:string;description:string};
export type LostDraftPayload={category:LostCategory;species:string;description:string;generalArea:string;observedAt:string};
export type SightingPayload={approximateArea:string;observedAt:string;description:string};

export class LostFormError extends Error {
 constructor(public field:string,message:string){super(message);this.name='LostFormError';}
}

/** Only positive, safely representable Oracle IDs may reach a URL or JSON payload. */
export function lostId(value:unknown):string {
 const raw=typeof value==='number'?String(value):typeof value==='string'?value.trim():'';
 if(!/^[1-9]\d*$/.test(raw))return '';
 const number=Number(raw);
 return Number.isSafeInteger(number)&&number>0?String(number):'';
}
export function lostCategory(row:Row):string{return str(row,'category').trim().toUpperCase();}
export function lostSpecies(row:Row):string{return str(row,'species').trim().toUpperCase();}
export function lostDate(value:unknown):string {
 const timestamp=Date.parse(typeof value==='string'?value:'');
 return Number.isFinite(timestamp)?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(timestamp)):'Date unavailable';
}
export function filterLostReports(items:Row[],search:string,category:string,species:string):Row[]{
 const term=search.trim().toLocaleLowerCase();
 return items.filter(item=>{
  if(!lostId(field(item,'id','postId')))return false;
  if(category!=='ALL'&&lostCategory(item)!==category)return false;
  if(species!=='ALL'&&lostSpecies(item)!==species)return false;
  return !term||[str(item,'species'),str(item,'category'),str(item,'generalArea'),lostId(field(item,'id','postId'))]
   .some(value=>value.toLocaleLowerCase().includes(term));
 });
}

/** The ASP.NET service checks trimmed character minimum and UTF-8 byte maximum. */
export function lostText(value:string,fieldName:string,label:string,min:number,max:number):string {
 const result=value.trim();
 if(result.length<min||new TextEncoder().encode(result).length>max)
  throw new LostFormError(fieldName,`${label} must contain at least ${min} characters and no more than ${max} UTF-8 bytes.`);
 return result;
}

/** Reject date normalization and times more than 10 minutes in the future, as the backend does. */
export function observedInstant(value:string,now=new Date()):string {
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
 if(!match)throw new LostFormError('observedAt','Enter a valid local observation date and time.');
 const [y,m,d,h,min]=match.slice(1).map(Number);
 if(y<100||m<1||m>12||d<1||d>31||h>23||min>59)
  throw new LostFormError('observedAt','Enter a valid local observation date and time.');
 const instant=new Date(y,m-1,d,h,min,0,0);
 if(!Number.isFinite(instant.getTime())||instant.getFullYear()!==y||instant.getMonth()!==m-1||instant.getDate()!==d||instant.getHours()!==h||instant.getMinutes()!==min)
  throw new LostFormError('observedAt','Enter a valid local observation date and time.');
 if(instant.getTime()>now.getTime()+10*60*1000)
  throw new LostFormError('observedAt','Observation cannot be more than 10 minutes in the future.');
 return instant.toISOString();
}
export function lostDraftPayload(fields:LostDraftFields,now=new Date()):LostDraftPayload {
 const category=fields.category.trim().toUpperCase();
 if(category!=='LOST'&&category!=='FOUND')throw new LostFormError('category','Choose Lost or Found.');
 return {category, species:lostText(fields.species,'species','Species',1,80),
  description:lostText(fields.description,'description','Description',10,4000),
  generalArea:lostText(fields.generalArea,'generalArea','General area',1,160),
  observedAt:observedInstant(fields.observedAt,now)};
}
export function sightingPayload(fields:SightingFields,now=new Date()):SightingPayload {
 return {approximateArea:lostText(fields.approximateArea,'approximateArea','Approximate area',1,160),
  observedAt:observedInstant(fields.observedAt,now),
  description:lostText(fields.description,'description','Sighting description',1,2000)};
}
export function proofAssetId(value:string):number {
 const id=lostId(value);
 if(!id)throw new LostFormError('proofAssetId','Enter a valid private evidence file ID.');
 return Number(id);
}
