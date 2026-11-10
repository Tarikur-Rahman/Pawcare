 'use client';
import {useState,type FormEvent} from 'react';
import {FormField} from '@/components/ui/FormField';
import {Button} from '@/components/ui/Button';
import {ApiError} from '@/lib/api/errors';
import {api} from '@/lib/api/client';
import {toUtc} from '@/lib/validation/forms';
export type FieldSpec={name:string;label:string;type?:'text'|'email'|'password'|'number'|'datetime-local'|'date'|'textarea'|'select';required?:boolean;min?:number;max?:number;hint?:string;options?:{value:string;label:string}[];initial?:string};
export function ActionForm({title,fields,path,method='POST',submitLabel='Save',onSuccess,transform, idempotent=false,description}:{title?:string;description?:string;fields:FieldSpec[];path:string;method?:'POST'|'PUT'|'PATCH';submitLabel?:string;onSuccess?:(value:unknown)=>void;transform?:(values:Record<string,string>)=>unknown;idempotent?:boolean}){
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(fields.map(f=>[f.name,f.initial||''])));
 const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[fieldErrors,setFieldErrors]=useState<Record<string,string[]>>({});
 const [key,setKey]=useState(()=>idempotent?crypto.randomUUID().replace(/-/g,''):'');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setFeedback('');setFieldErrors({});
   try{const body=transform?transform(values):Object.fromEntries(fields.map(f=>[f.name,f.type==='number'?Number(values[f.name]):f.type==='datetime-local'?toUtc(values[f.name]):values[f.name]]));
     const out=await api(path,{method,body,idempotencyKey:idempotent?key:undefined});setFeedback('Saved successfully.');onSuccess?.(out);
     if(!onSuccess)window.dispatchEvent(new Event('pawcare:refresh'));
     if(idempotent)setKey(crypto.randomUUID().replace(/-/g,''));
   }catch(error){if(error instanceof ApiError){setFieldErrors(error.fieldErrors||{});setFeedback(error.message);}else setFeedback(error instanceof Error?error.message:'Unable to save.');}
   finally{setBusy(false);}
 }
 return <form className="action-form" onSubmit={submit}>{title&&<h3>{title}</h3>}{description&&<p className="hint">{description}</p>}<div className="form-grid">{fields.map(f=><FormField key={f.name} name={f.name} label={f.label} as={f.type==='textarea'?'textarea':f.type==='select'?'select':'input'} type={f.type==='textarea'||f.type==='select'?undefined:f.type||'text'} required={f.required} min={f.min} max={f.max} hint={f.hint} value={values[f.name]||''} onChange={e=>setValues(v=>({...v,[f.name]:(e.target as HTMLInputElement).value}))} options={f.options} error={fieldErrors[f.name]?.join(' ')} />)}</div>{feedback&&<p className={feedback==='Saved successfully.'?'success-message':'form-alert'} role="status">{feedback}</p>}<Button type="submit" loading={busy}>{submitLabel}</Button></form>;
}