'use client';
import {useState,type ChangeEvent,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {Button} from '@/components/ui/Button';
import {FormField} from '@/components/ui/FormField';
import {
 EMPTY_MEDICATION,EMPTY_VACCINE,MedicalFormError,medicationPayload,vaccinePayload,
 type MedicalField,type MedicationValues,type VaccineValues,
} from '@/lib/medical/records';

type Kind='VACCINE'|'MEDICATION';
type Props={petId:string;kind:Kind;onSaved:()=>void};
const fields={
 VACCINE:['vaccineName','administeredAt','nextDueAt'],
 MEDICATION:['medicationName','dosageText','startAt','endAt'],
} as const;

/** The current API supports adding records, not modifying or deleting them. */
export function MedicalRecordForm({petId,kind,onSaved}:Props){
 const [vaccine,setVaccine]=useState<VaccineValues>({...EMPTY_VACCINE});
 const [medication,setMedication]=useState<MedicationValues>({...EMPTY_MEDICATION});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [errors,setErrors]=useState<Partial<Record<MedicalField,string>>>({});
 const [success,setSuccess]=useState('');
 const isVaccine=kind==='VACCINE';
 const current=isVaccine?vaccine:medication;
 function update(key:MedicalField,value:string){
  if(isVaccine)setVaccine(v=>({...v,[key]:value}));
  else setMedication(v=>({...v,[key]:value}));
  setErrors(e=>({...e,[key]:undefined}));setError('');setSuccess('');
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setError('');setSuccess('');setErrors({});
  try{
   const body=isVaccine?vaccinePayload(vaccine):medicationPayload(medication);
   setBusy(true);
   await api(`/pets/${petId}/medical/${isVaccine?'vaccinations':'medications'}`,{method:'POST',body});
   if(isVaccine)setVaccine({...EMPTY_VACCINE});else setMedication({...EMPTY_MEDICATION});
   setSuccess(`${isVaccine?'Vaccination':'Medication'} saved.`);
   onSaved();
  }catch(caught){
   if(caught instanceof MedicalFormError)setErrors({[caught.field]:caught.message});
   else if(caught instanceof ApiError){
    setError(caught.message);
    const matched:Partial<Record<MedicalField,string>>={};
    const allowed:readonly MedicalField[]=fields[kind];
    for(const [key,messages] of Object.entries(caught.fieldErrors??{})){
     const name=allowed.find(item=>item.toLowerCase()===key.toLowerCase());
     if(name)matched[name]=messages.join(' ');
    }
    setErrors(matched);
   } else setError(caught instanceof Error?caught.message:'Unable to save medical record.');
  }finally{setBusy(false);}
 }
 const asValue=(key:MedicalField)=>String((current as unknown as Record<string,string>)[key]??'');
 const fieldProps=(key:MedicalField)=>({name:key,value:asValue(key),disabled:busy,error:errors[key],
  onChange:(event:ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>update(key,event.target.value)});
 return <form className="action-form medical-record-form" onSubmit={submit} noValidate aria-label={isVaccine?'Add vaccination':'Add medication'}>
  {isVaccine?<div className="form-grid">
   <FormField {...fieldProps('vaccineName')} label="Vaccine name" required maxLength={160} placeholder="As written on the vaccination record"/>
   <FormField {...fieldProps('administeredAt')} label="Administered date and time" type="datetime-local" required/>
   <FormField {...fieldProps('nextDueAt')} label="Next dose due (optional)" type="datetime-local" hint="Must be later than the administered date."/>
  </div>:<div className="form-grid">
   <FormField {...fieldProps('medicationName')} label="Medication name" required maxLength={160} placeholder="As provided by your veterinarian"/>
   <FormField {...fieldProps('dosageText')} label="Prescribed dosage / instructions" required maxLength={300} placeholder="Copy the prescribed instructions exactly"/>
   <FormField {...fieldProps('startAt')} label="Start date and time" required type="datetime-local"/>
   <FormField {...fieldProps('endAt')} label="End date and time (optional)" type="datetime-local"/>
  </div>}
  {error&&<p className="form-alert" role="alert">{error}</p>}
  {success&&<p className="success-message" role="status">{success}</p>}
  <div className="pet-form-actions"><Button type="submit" loading={busy}>{isVaccine?'Save vaccination':'Save medication'}</Button></div>
  <p className="hint medical-safety-note">Enter only details from an actual treatment or vaccination. This record is not medical advice.</p>
 </form>;
}
