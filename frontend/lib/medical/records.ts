/** Browser-side validation for the existing MedicalService API contracts.
 * Medical dates are local user-entered instants sent as ISO UTC timestamps.
 * Dosage text is entered by the user; PawCare never generates dosage advice.
 */
import {field,str,type Row} from '@/lib/types/domain';

export type VaccineValues={vaccineName:string;administeredAt:string;nextDueAt:string};
export type MedicationValues={medicationName:string;dosageText:string;startAt:string;endAt:string};
export type MedicalKind='VACCINE'|'MEDICATION'|'APPOINTMENT';
export type MedicalFilter='ALL'|MedicalKind;
export type MedicalField=keyof VaccineValues|keyof MedicationValues;
export class MedicalFormError extends Error{
 constructor(public field:MedicalField,message:string){super(message);this.name='MedicalFormError';}
}

function text(value:string, field:MedicalField, label:string, maxBytes:number):string{
 const trimmed=value.trim();
 if(!trimmed)throw new MedicalFormError(field,`${label} is required.`);
 if(new TextEncoder().encode(trimmed).length>maxBytes)throw new MedicalFormError(field,`${label} exceeds the ${maxBytes}-byte database limit.`);
 return trimmed;
}

/** Rejects malformed and DST-skipped local times instead of silently normalizing them. */
function instant(value:string,field:MedicalField,label:string):Date{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new MedicalFormError(field,`Enter a valid ${label.toLowerCase()}.`);
 const date=new Date(value);
 const [year,month,day,hour,minute]=value.split(/[-T:]/).map(Number);
 if(!Number.isFinite(date.getTime())||date.getFullYear()!==year||date.getMonth()+1!==month||date.getDate()!==day||date.getHours()!==hour||date.getMinutes()!==minute){
  throw new MedicalFormError(field,`Enter a valid ${label.toLowerCase()}.`);
 }
 return date;
}
function optionalInstant(value:string,field:MedicalField,label:string):Date|null{
 return value?instant(value,field,label):null;
}
export function vaccinePayload(v:VaccineValues,now=new Date()){
 const vaccineName=text(v.vaccineName,'vaccineName','Vaccine name',160);
 const administered=instant(v.administeredAt,'administeredAt','administration date and time');
 if(administered.getTime()>now.getTime())throw new MedicalFormError('administeredAt','Administered date cannot be in the future.');
 const next=optionalInstant(v.nextDueAt,'nextDueAt','next dose date and time');
 if(next&&next.getTime()<=administered.getTime())throw new MedicalFormError('nextDueAt','Next dose must be after the administered date.');
 return {vaccineName,administeredAt:administered.toISOString(),nextDueAt:next?.toISOString()??null};
}
export function medicationPayload(v:MedicationValues){
 const medicationName=text(v.medicationName,'medicationName','Medication name',160);
 const dosageText=text(v.dosageText,'dosageText','Dosage / instructions',300);
 const start=instant(v.startAt,'startAt','start date and time');
 const end=optionalInstant(v.endAt,'endAt','end date and time');
 if(end&&end.getTime()<start.getTime())throw new MedicalFormError('endAt','End date cannot precede start date.');
 return {medicationName,dosageText,startAt:start.toISOString(),endAt:end?.toISOString()??null};
}
export const EMPTY_VACCINE:VaccineValues={vaccineName:'',administeredAt:'',nextDueAt:''};
export const EMPTY_MEDICATION:MedicationValues={medicationName:'',dosageText:'',startAt:'',endAt:''};

export function medicalKind(row:Row):MedicalKind|null{
 const type=str(row,'type','eventType').toUpperCase();
 return type==='VACCINE'||type==='MEDICATION'||type==='APPOINTMENT'?type:null;
}
export function filterMedical(items:Row[],kind:MedicalFilter,query=''):Row[]{
 const q=query.trim().toLocaleLowerCase();
 return items.filter(item=>(kind==='ALL'||medicalKind(item)===kind)&&(!q||[
  str(item,'title'),str(item,'type'),str(item,'dosageText'),str(item,'id'),
 ].some(value=>value.toLocaleLowerCase().includes(q))));
}
export function medicalCounts(items:Row[]){
 return {ALL:items.length,VACCINE:items.filter(i=>medicalKind(i)==='VACCINE').length,
  MEDICATION:items.filter(i=>medicalKind(i)==='MEDICATION').length,
  APPOINTMENT:items.filter(i=>medicalKind(i)==='APPOINTMENT').length};
}
export function medicalDate(item:Row,key:string):string{
 const value=field(item,key);
 return typeof value==='string'?value:'';
}
