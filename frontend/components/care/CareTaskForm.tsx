'use client';
import {useState,type FormEvent} from 'react';
import {ApiError} from '@/lib/api/errors';
import {api} from '@/lib/api/client';
import {CARE_TYPES,INITIAL_CARE_FORM,careTaskPayload,CareFormError,type CareFormValues} from '@/lib/care/tasks';
import {FormField} from '@/components/ui/FormField';
import {Button} from '@/components/ui/Button';

const LABELS:Record<string,string>={FEEDING:'Feeding',GROOMING:'Grooming',MEDICATION:'Medication',EXERCISE:'Exercise',HYGIENE:'Hygiene',OTHER:'Other'};
const REPEAT_OPTIONS=[{value:'DAILY',label:'Daily'},{value:'WEEKLY',label:'Weekly'},{value:'MONTHLY',label:'Monthly'}];

type Props={petId:string;onCreated:()=>void};
export function CareTaskForm({petId,onCreated}:Props){
 const [values,setValues]=useState<CareFormValues>({...INITIAL_CARE_FORM});
 const [errors,setErrors]=useState<Partial<Record<keyof CareFormValues,string>>>({});
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 function change(field:keyof CareFormValues,value:string){setValues(v=>({...v,[field]:value}));setErrors(e=>({...e,[field]:undefined}));setError('');}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setError('');setErrors({});
  try{
   const body=careTaskPayload(values);
   setBusy(true);
   await api(`/pets/${petId}/tasks`,{method:'POST',body});
   setValues({...INITIAL_CARE_FORM});
   onCreated();
  }catch(caught){
   if(caught instanceof CareFormError)setErrors({[caught.field]:caught.message});
   else if(caught instanceof ApiError){
    setError(caught.message);
    const fieldErrors:Partial<Record<keyof CareFormValues,string>>={};
    for(const [name,messages] of Object.entries(caught.fieldErrors??{})){
     const key=(Object.keys(INITIAL_CARE_FORM) as (keyof CareFormValues)[]).find(k=>k.toLowerCase()===name.toLowerCase());
     if(key)fieldErrors[key]=messages.join(' ');
    }
    setErrors(fieldErrors);
   }else setError(caught instanceof Error?caught.message:'Unable to create the task.');
  }finally{setBusy(false);}
 }
 return <form className="action-form care-task-form" noValidate onSubmit={submit}>
  <h2>Schedule a care task</h2>
  <p className="hint">Use your local date and time. Repeat options create the next occurrence after a task is completed, when the reminder worker is enabled.</p>
  <div className="form-grid">
   <FormField name="type" label="Care type" as="select" required value={values.type} disabled={busy} options={CARE_TYPES.map(type=>({value:type,label:LABELS[type]}))} error={errors.type} onChange={e=>change('type',e.target.value)}/>
   <FormField name="title" label="Task name" placeholder="e.g. Evening walk" required maxLength={160} value={values.title} disabled={busy} error={errors.title} onChange={e=>change('title',e.target.value)}/>
   <FormField name="dueAt" label="Due date and time" type="datetime-local" required value={values.dueAt} disabled={busy} error={errors.dueAt} onChange={e=>change('dueAt',e.target.value)}/>
   <FormField name="recurrenceRule" label="Repeat" as="select" value={values.recurrenceRule} disabled={busy} options={REPEAT_OPTIONS} error={errors.recurrenceRule} hint="Optional. No repeat is the default." onChange={e=>change('recurrenceRule',e.target.value)}/>
  </div>
  {error&&<p className="form-alert" role="alert">{error}</p>}
  <Button type="submit" loading={busy}>Create care task</Button>
 </form>;
}
