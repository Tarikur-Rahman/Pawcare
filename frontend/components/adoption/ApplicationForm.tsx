'use client';

import {useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {adoptionId,adoptionError,validateAdoptionText} from '@/lib/adoption/records';
import {FormField} from '@/components/ui/FormField';

export function ApplicationForm({id}:{id:string}){
 const [answers,setAnswers]=useState(''),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[fieldError,setFieldError]=useState('');
 const [submitted,setSubmitted]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||submitted)return;
  setError('');setNotice('');setFieldError('');
  if(!adoptionId(id)){setError('This listing ID is invalid.');return;}
  const invalid=validateAdoptionText(answers,'Adoption plan',10,4000);
  if(invalid){setFieldError(invalid);return;}
  setBusy(true);
  try{
   await api(`/adoptions/${adoptionId(id)}/applications`,{method:'POST',body:{answers:answers.trim()}});
   setSubmitted(true);setNotice('Application submitted. The current caretaker will review it. This is not an approval or ownership transfer.');
  }catch(caught){
   if(caught instanceof ApiError&&caught.fieldErrors?.answers)setFieldError(caught.fieldErrors.answers.join(' '));
   setError(adoptionError(caught,'Unable to submit your application.'));
  }finally{setBusy(false);}
 }
 return <form className="action-form" onSubmit={submit}><h3>Apply to adopt</h3>
  <p className="hint">Describe your living situation, pet-care experience and adoption plan. Your answers are private to authorized reviewers.</p>
  <FormField name="adoptionAnswers" label="Your adoption plan" as="textarea" required minLength={10} maxLength={4000}
   value={answers} disabled={busy||submitted} onChange={e=>{setAnswers(e.target.value);setFieldError('');}}
   error={fieldError} hint="At least 10 characters; maximum 4,000 UTF-8 bytes."/>
  {error&&<p role="alert" className="form-alert">{error}</p>}
  {notice&&<p role="status" className="success-message">{notice}</p>}
  <button className="btn btn-primary" type="submit" disabled={busy||submitted||!adoptionId(id)}>{busy?'Submitting…':submitted?'Application submitted':'Submit application'}</button>
 </form>;
}
