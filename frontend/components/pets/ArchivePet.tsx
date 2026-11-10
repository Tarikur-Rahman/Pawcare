'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Archive} from 'lucide-react';
import {api} from '@/lib/api/client';
import {Button} from '@/components/ui/Button';

export function ArchivePet({id,name}:{id:string;name:string}){
  const router=useRouter();
  const [confirming,setConfirming]=useState(false);
  const [typed,setTyped]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function archive(){
    if(busy||typed!==name)return;
    setBusy(true);setError('');
    try{
      await api(`/pets/${id}`,{method:'DELETE'});
      router.replace('/pets');router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Unable to archive pet.');}
    finally{setBusy(false);}
  }
  return <div className="panel pet-archive-panel">
    <div className="pet-archive-title"><Archive size={19} aria-hidden="true"/><h2>Archive pet profile</h2></div>
    <p>Archiving removes this pet from your active list. Medical history remains stored. Pets linked to active listings cannot be archived.</p>
    {!confirming?<Button variant="danger" onClick={()=>setConfirming(true)}>Archive pet</Button>
      :<div className="pet-archive-confirm"><label className="form-field" htmlFor="pet-archive-name">Type <strong>{name}</strong> to confirm
         <input id="pet-archive-name" className="form-input" type="text" autoComplete="off" value={typed} onChange={e=>setTyped(e.target.value)} disabled={busy}/>
       </label><div className="pet-form-actions"><Button variant="danger" disabled={typed!==name} loading={busy} onClick={()=>void archive()}>Confirm archive</Button>
       <Button variant="ghost" disabled={busy} onClick={()=>{setConfirming(false);setTyped('');setError('');}}>Cancel</Button></div></div>}
    {error&&<p className="form-alert" role="alert">{error}</p>}
  </div>;
}
