'use client';
import type {ChangeEvent,HTMLInputTypeAttribute} from 'react';

type FieldChange = ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>;
type Props = {
  name:string; label:string; hint?:string; error?:string;
  as?:'input'|'textarea'|'select';
  options?:{value:string;label:string}[];
  className?:string; type?:HTMLInputTypeAttribute;
  value?:string|number; onChange?:(event:FieldChange)=>void;
  required?:boolean;disabled?:boolean; placeholder?:string;
  min?:number|string;max?:number|string;minLength?:number;maxLength?:number;
  autoComplete?:string;
};
export function FormField({label,name,hint,error,as='input',options,className='',type='text',value='',onChange,required,disabled,placeholder,min,max,minLength,maxLength,autoComplete}:Props){
  const id=`field-${name}`;
  const common={id,name,value,required,disabled,placeholder,
    'aria-invalid':!!error,'aria-describedby':error?`${id}-error`:hint?`${id}-hint`:undefined,
    className:`form-input ${className}`};
  return <div className="form-field">
    <label htmlFor={id}>{label}{required&&<span className="required"> *</span>}</label>
    {as==='textarea'?<textarea {...common} minLength={minLength} maxLength={maxLength} onChange={onChange}/>
      :as==='select'?<select {...common} onChange={onChange}><option value="">Choose {label.toLowerCase()}</option>{options?.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>
      :<input {...common} type={type} min={min} max={max} minLength={minLength} maxLength={maxLength} autoComplete={autoComplete} onChange={onChange}/>}
    {hint&&!error&&<small id={`${id}-hint`} className="hint">{hint}</small>}
    {error&&<small id={`${id}-error`} role="alert" className="field-error">{error}</small>}
  </div>;
}
