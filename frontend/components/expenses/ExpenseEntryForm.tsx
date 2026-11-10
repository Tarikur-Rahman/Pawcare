'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ApiError} from '@/lib/api/errors';
import {api} from '@/lib/api/client';
import {Button} from '@/components/ui/Button';
import {FormField} from '@/components/ui/FormField';
import {EXPENSE_CATEGORIES,EXPENSE_CURRENCIES,INITIAL_EXPENSE_FORM,expenseId,expensePayload,expenseToForm,ExpenseFormError,type ExpenseFormValues} from '@/lib/expenses/records';
import type {Row} from '@/lib/types/domain';

type Props={petId:string;editing?:Row|null;onSaved:(message:string)=>void;onCancel:()=>void};
export function ExpenseEntryForm({petId,editing,onSaved,onCancel}:Props){
 const [values,setValues]=useState<ExpenseFormValues>({...INITIAL_EXPENSE_FORM});
 const [errors,setErrors]=useState<Partial<Record<keyof ExpenseFormValues,string>>>({});
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const editId=editing?expenseId(editing):'';
 useEffect(()=>{setValues(editing?expenseToForm(editing):{...INITIAL_EXPENSE_FORM});setError('');setErrors({});},[editing,petId]);
 function change(field:keyof ExpenseFormValues,value:string){setValues(v=>({...v,[field]:value}));setErrors(e=>({...e,[field]:undefined}));setError('');}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setError('');setErrors({});
  try{
   const body=expensePayload(values);
   if(editing&&!editId)throw new Error('This expense cannot be edited because its identifier is invalid.');
   setBusy(true);
   if(editId)await api(`/expenses/${editId}`,{method:'PATCH',body});
   else await api(`/pets/${petId}/expenses`,{method:'POST',body});
   setValues({...INITIAL_EXPENSE_FORM});onSaved(editId?'Expense updated.':'Expense recorded.');
  }catch(caught){
   if(caught instanceof ExpenseFormError)setErrors({[caught.field]:caught.message});
   else if(caught instanceof ApiError){
    setError(caught.message);
    const serverErrors:Partial<Record<keyof ExpenseFormValues,string>>={};
    for(const [key,messages] of Object.entries(caught.fieldErrors??{})){
     const mapped=(Object.keys(INITIAL_EXPENSE_FORM) as (keyof ExpenseFormValues)[]).find(k=>k.toLowerCase()===(key.toLowerCase()==='amountminor'?'amount':key.toLowerCase()));
     if(mapped)serverErrors[mapped]=messages.join(' ');
    }
    setErrors(serverErrors);
   }else setError(caught instanceof Error?caught.message:'Could not save the expense.');
  }finally{setBusy(false);}
 }
 return <form className="action-form expense-entry-form" noValidate onSubmit={submit}>
  <h2>{editing?'Edit expense':'Record an expense'}</h2>
  <p className="hint">Enter the amount in major units (for example, 125.50 BDT). PawCare stores the exact minor-unit value.</p>
  <div className="form-grid">
   <FormField name="amount" label="Amount" type="text" placeholder="125.50" required value={values.amount} disabled={busy} error={errors.amount} onChange={e=>change('amount',e.target.value)} hint="Up to 2 decimal places"/>
   <FormField name="currency" label="Currency" as="select" required value={values.currency} options={[...EXPENSE_CURRENCIES]} disabled={busy} error={errors.currency} onChange={e=>change('currency',e.target.value)}/>
   <FormField name="category" label="Category" as="select" required value={values.category} options={[...EXPENSE_CATEGORIES]} disabled={busy} error={errors.category} onChange={e=>change('category',e.target.value)}/>
   <FormField name="occurredAt" label="Date and time" type="datetime-local" required value={values.occurredAt} disabled={busy} error={errors.occurredAt} onChange={e=>change('occurredAt',e.target.value)}/>
  </div>
  <FormField name="description" label="Notes (optional)" as="textarea" value={values.description} disabled={busy} error={errors.description} onChange={e=>change('description',e.target.value)}/>
  {error&&<p className="form-alert" role="alert">{error}</p>}
  <div className="expense-form-actions"><Button type="submit" loading={busy}>{editing?'Save changes':'Add expense'}</Button>{editing&&<Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>Cancel editing</Button>}</div>
 </form>;
}
