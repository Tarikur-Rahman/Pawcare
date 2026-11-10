'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Plus,Search,RefreshCw} from 'lucide-react';
import {api} from '@/lib/api/client';
import {rows,str,type Row} from '@/lib/types/domain';
import {PetCard} from '@/components/pets/PetCard';
import {PetProfileForm} from '@/components/pets/PetProfileForm';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';
import {Button} from '@/components/ui/Button';

export function PetManagementWorkspace({initialPets,initialError=''}:{initialPets:Row[];initialError?:string}) {
  const router=useRouter();
  const [pets,setPets]=useState(initialPets);
  const [error,setError]=useState(initialError);
  const [loading,setLoading]=useState(false);
  const [query,setQuery]=useState('');
  const [showCreate,setShowCreate]=useState(false);
  const [notice,setNotice]=useState('');

  useEffect(()=>{setPets(initialPets);setError(initialError);},[initialPets,initialError]);
  const reload=useCallback(async()=>{
    setLoading(true);
    try{setPets(rows(await api('/pets')));setError('');}
    catch(e){setError(e instanceof Error?e.message:'Unable to load pets.');}
    finally{setLoading(false);}
  },[]);
  const visible=useMemo(()=>pets.filter(p=>[str(p,'name'),str(p,'species'),str(p,'breed')].some(value=>value.toLowerCase().includes(query.trim().toLowerCase()))),[pets,query]);
  function created(){
    setNotice('Pet added successfully.');setShowCreate(false);
    void reload();router.refresh();
  }

  return <section className="page-section">
    <div className="page-heading">
      <div><span className="eyebrow">YOUR COMPANIONS</span><h1>My pets</h1><p>One place for your pet profiles, care history and appointments.</p></div>
      <Button onClick={()=>{setShowCreate(v=>!v);setNotice('');}}><Plus size={18}/>{showCreate?'Close form':'Add a pet'}</Button>
    </div>
    {showCreate&&<div className="panel pet-create-panel"><div className="flex-between"><div><h2>Add a companion</h2><p>Start with the essentials. Medical information can be added later.</p></div></div><PetProfileForm mode="create" onSaved={created} onCancel={()=>setShowCreate(false)}/></div>}
    {notice&&<p className="success-message pet-notice" role="status">{notice}</p>}
    {error&&<ErrorState message={error} onRetry={()=>void reload()}/>}
    <div className="panel pet-directory">
      <div className="pet-directory-toolbar">
        <div><h2>Your pet profiles</h2><p>{pets.length} active {pets.length===1?'pet':'pets'}</p></div>
        <div className="pet-directory-actions">
          <label className="pet-search"><Search size={18}/><span className="sr-only">Search pets</span><input type="search" placeholder="Search pets" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search pets" /></label>
          <Button variant="secondary" onClick={()=>void reload()} disabled={loading}><RefreshCw size={16} aria-hidden="true"/>{loading?'Refreshing':'Refresh'}</Button>
        </div>
      </div>
      {loading&&<p className="hint" role="status">Refreshing pet profiles…</p>}
      {error&&!pets.length?<p className="hint">Try again when the server is available.</p>
        :!pets.length?<EmptyState title="No pet profiles yet" description="Add your first companion to start tracking care and health records."/>
        :!visible.length?<EmptyState title="No matching pets" description="Try another name, breed, or species."/>
        :<div className="pet-grid pet-directory-grid">{visible.map(p=><PetCard key={str(p,'id')} pet={p}/>)}</div>}
    </div>
  </section>;
}
