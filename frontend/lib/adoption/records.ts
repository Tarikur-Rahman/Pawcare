import {field,str,type Row} from '@/lib/types/domain';

/** All adoption IDs are generated Oracle positive integer keys. Never accept a URL fragment. */
export function adoptionId(value:unknown):string {
 const raw=typeof value==='number' ? String(value) : typeof value==='string'?value.trim():'';
 if(!/^[1-9]\d*$/.test(raw))return '';
 const id=Number(raw);
 return Number.isSafeInteger(id)&&id>0?String(id):'';
}
export function publicAdoptionId(row:Row):string {return adoptionId(field(row,'id','adoptionId'));}
export function adoptionText(value:unknown):string {return typeof value==='string'?value.trim():'';}
export function utf8Bytes(value:string):number {return new TextEncoder().encode(value).length;}
export function validateAdoptionText(value:string,label:string,min:number,max:number):string {
 const v=value.trim();
 return v.length>=min&&utf8Bytes(v)<=max?'':`${label} must contain at least ${min} characters and no more than ${max} UTF-8 bytes.`;
}
export function eligiblePet(row:Row):boolean {
 const status=str(row,'status').trim().toUpperCase();
 return !!adoptionId(field(row,'id','petId'))&&(!status||status==='ACTIVE');
}
export function adoptionSpecies(row:Row):string {return str(row,'species').trim().toUpperCase();}
export function filterAdoptions(items:Row[],search:string,species:string):Row[] {
 const needle=search.trim().toLocaleLowerCase();
 return items.filter(item=>{
  if(!publicAdoptionId(item))return false;
  if(species!=='ALL'&&adoptionSpecies(item)!==species)return false;
  return [str(item,'title'),str(item,'description'),str(item,'generalArea'),str(item,'species')]
   .some(value=>value.toLocaleLowerCase().includes(needle));
 });
}
export function adoptionApplicationStatus(row:Row):string {return str(row,'status').trim().toUpperCase();}
export function canDecideApplication(row:Row):boolean {
 return !!adoptionId(field(row,'id','applicationId'))&&adoptionApplicationStatus(row)==='SUBMITTED';
}
export function adoptionError(error:unknown,fallback:string):string {return error instanceof Error?error.message:fallback;}

export function newHandoverKey():string {
 const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
