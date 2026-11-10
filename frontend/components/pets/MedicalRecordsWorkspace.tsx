'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {RefreshCw} from 'lucide-react';
import {api} from '@/lib/api/client';
import {rows,type Row} from '@/lib/types/domain';
import {filterMedical,medicalCounts,type MedicalFilter} from '@/lib/medical/records';
import {HealthTimeline} from '@/components/pets/HealthTimeline';
import {MedicalRecordForm} from '@/components/pets/MedicalRecordForm';
import {ErrorState} from '@/components/ui/ErrorState';
import {Button} from '@/components/ui/Button';
import {EmptyState} from '@/components/ui/EmptyState';

const FILTERS:[MedicalFilter,string][]=[
 ['ALL','All records'],['VACCINE','Vaccinations'],['MEDICATION','Medications'],['APPOINTMENT','Vet visits'],
];
export function MedicalRecordsWorkspace({petId,initialRecords,initialError='',editable=true}:{petId:string;initialRecords:Row[];initialError?:string;editable?:boolean}){
 const router=useRouter();
 const [records,setRecords]=useState(initialRecords);
 const [error,setError]=useState(initialError);
 const [loading,setLoading]=useState(false);
 const [filter,setFilter]=useState<MedicalFilter>('ALL');
 const [search,setSearch]=useState('');
 const [entry,setEntry]=useState<'VACCINE'|'MEDICATION'>('VACCINE');
 useEffect(()=>{setRecords(initialRecords);setError(initialError);},[initialRecords,initialError]);
 const counts=useMemo(()=>medicalCounts(records),[records]);
 const visible=useMemo(()=>filterMedical(records,filter,search),[records,filter,search]);
 const reload=useCallback(async()=>{
  setLoading(true);
  try{setRecords(rows(await api(`/pets/${petId}/medical`)));setError('');}
  catch(caught){setError(caught instanceof Error?caught.message:'Unable to refresh health history.');}
  finally{setLoading(false);}
 },[petId]);
 function saved(){void reload();router.refresh();}
 return <>
  <div className="panel medical-history-panel">
   <div className="medical-section-header">
    <div><span className="eyebrow">MEDICAL HISTORY</span><h2>Health & vaccination records</h2><p>Up to 100 of the latest recorded events for this pet.</p></div>
    <Button variant="secondary" onClick={()=>void reload()} disabled={loading}><RefreshCw size={16} aria-hidden="true"/>{loading?'Refreshing':'Refresh records'}</Button>
   </div>
   {error&&<ErrorState message={error} onRetry={()=>void reload()}/>}
   <div className="medical-summary" aria-label="Record counts">
    <span><strong>{counts.VACCINE}</strong> Vaccinations</span>
    <span><strong>{counts.MEDICATION}</strong> Medications</span>
    <span><strong>{counts.APPOINTMENT}</strong> Vet visits</span>
   </div>
   <div className="medical-toolbar">
    <div className="medical-filters" aria-label="Filter health records">
     {FILTERS.map(([kind,label])=><button key={kind} type="button" className={`medical-filter${filter===kind?' selected':''}`} aria-pressed={filter===kind} onClick={()=>setFilter(kind)}>{label} <small>{counts[kind]}</small></button>)}
    </div>
    <input className="form-input medical-search" aria-label="Search health records" type="search" placeholder="Search history" value={search} onChange={e=>setSearch(e.target.value)}/>
   </div>
   {loading&&<p className="hint" role="status">Updating health history…</p>}
   {!records.length&&!error?<EmptyState title="No health records yet" description="Add your first vaccination or medication to begin this pet's medical history."/>
    :error&&!records.length?null
    :!visible.length?<EmptyState title="No matching records" description="Try another filter or search term."/>
    :<HealthTimeline items={visible}/>}
  </div>
  {editable?<div className="panel medical-entry-panel">
   <span className="eyebrow">ADD A RECORD</span>
   <h2>Record treatment history</h2>
   <p>Keep vaccination and prescribed medication details in one place.</p>
   <div className="medical-entry-switch" aria-label="Choose medical record type">
    <button type="button" className={`medical-filter${entry==='VACCINE'?' selected':''}`} aria-pressed={entry==='VACCINE'} onClick={()=>setEntry('VACCINE')}>Vaccination</button>
    <button type="button" className={`medical-filter${entry==='MEDICATION'?' selected':''}`} aria-pressed={entry==='MEDICATION'} onClick={()=>setEntry('MEDICATION')}>Medication</button>
   </div>
   <MedicalRecordForm key={entry} petId={petId} kind={entry} onSaved={saved}/>
  </div>:<div className="panel medical-entry-panel"><p className="hint">This pet is archived. Historical medical records remain visible, but new records cannot be added.</p></div>}
 </>;
}
