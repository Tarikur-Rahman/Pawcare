'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {field,str,type Row} from '@/lib/types/domain';
import {createPetPayload,dateInputValue,editPetPayload,emptyPet,PetFormError,type PetFormValues} from '@/lib/pets/payloads';
import {Button} from '@/components/ui/Button';
import {FormField} from '@/components/ui/FormField';

type Props = {
  mode: 'create' | 'edit';
  pet?: Row;
  onSaved?: (result: unknown) => void;
  onCancel?: () => void;
};

function fromPet(pet?: Row): PetFormValues {
  if (!pet) return {...emptyPet};
  return {
    name: str(pet,'name'), species: str(pet,'species'), breed: str(pet,'breed'),
    sex: str(pet,'sex') || 'UNKNOWN', dateOfBirth: dateInputValue(field(pet,'dateOfBirth')),
  };
}

export function PetProfileForm({mode,pet,onSaved,onCancel}:Props) {
  const petId = str(pet,'id');
  const [values,setValues] = useState<PetFormValues>(()=>fromPet(pet));
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [fieldErrors,setFieldErrors] = useState<Partial<Record<keyof PetFormValues,string>>>({});

  useEffect(()=>{if(mode==='edit')setValues(fromPet(pet));},[mode,pet]);
  function change(key:keyof PetFormValues,value:string){
    setValues(v=>({...v,[key]:value}));
    setFieldErrors(v=>({...v,[key]:undefined}));
    setError('');setNotice('');
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    setError('');setNotice('');setFieldErrors({});
    try {
      const payload=mode==='create'
        ? createPetPayload(values)
        : editPetPayload(values,field(pet,'attributesJson'));
      if(mode==='edit'&&!/^\d+$/.test(petId))throw new Error('Invalid pet identifier.');
      setBusy(true);
      const response=await api(mode==='create'?'/pets':`/pets/${petId}`,{
        method:mode==='create'?'POST':'PATCH',body:payload,
      });
      setNotice(mode==='create'?'Pet added successfully.':'Pet details updated.');
      onSaved?.(response);
      if(mode==='create')setValues({...emptyPet});
    } catch (caught) {
      if(caught instanceof PetFormError){setFieldErrors({[caught.field]:caught.message});}
      else if(caught instanceof ApiError){
        setError(caught.message);
        const mapped:Partial<Record<keyof PetFormValues,string>>={};
        for(const [key,messages] of Object.entries(caught.fieldErrors??{})){
          const matching=(Object.keys(emptyPet) as (keyof PetFormValues)[]).find(k=>k.toLowerCase()===key.toLowerCase());
          if(matching)mapped[matching]=messages.join(' ');
        }
        setFieldErrors(mapped);
      } else setError(caught instanceof Error?caught.message:'Unable to save pet.');
    } finally {setBusy(false);}
  }

  const today=new Date();
  const maxDate=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  return <form className="action-form pet-profile-form" onSubmit={submit} noValidate>
    <div className="form-grid">
      <FormField name="name" label="Pet name" required value={values.name} maxLength={120} disabled={busy} error={fieldErrors.name} onChange={e=>change('name',e.target.value)}/>
      {mode==='create'?<FormField name="species" label="Species" placeholder="e.g. Dog, Cat, Bird" required value={values.species} maxLength={80} disabled={busy} error={fieldErrors.species} onChange={e=>change('species',e.target.value)}/>
        :<div className="form-field"><label>Species</label><p className="pet-readonly-field">{values.species||'Not specified'}</p><small className="hint">Species cannot be changed after registration.</small></div>}
      <FormField name="breed" label="Breed (optional)" value={values.breed} maxLength={120} disabled={busy} error={fieldErrors.breed} onChange={e=>change('breed',e.target.value)}/>
      {mode==='create'?<FormField name="sex" label="Sex" as="select" required value={values.sex} disabled={busy} error={fieldErrors.sex} options={[{value:'UNKNOWN',label:'Unknown'},{value:'FEMALE',label:'Female'},{value:'MALE',label:'Male'}]} onChange={e=>change('sex',e.target.value)}/>
        :<div className="form-field"><label>Sex</label><p className="pet-readonly-field">{values.sex.toLowerCase()}</p><small className="hint">Sex cannot be changed with the current API.</small></div>}
      <FormField name="dateOfBirth" label="Birth date (optional)" type="date" max={maxDate} value={values.dateOfBirth} disabled={busy} error={fieldErrors.dateOfBirth} onChange={e=>change('dateOfBirth',e.target.value)}/>
    </div>
    {error&&<p className="form-alert" role="alert">{error}</p>}
    {notice&&<p className="success-message" role="status">{notice}</p>}
    <div className="pet-form-actions">
      <Button type="submit" loading={busy}>{mode==='create'?'Add pet':'Save changes'}</Button>
      {onCancel&&<Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>}
    </div>
  </form>;
}
