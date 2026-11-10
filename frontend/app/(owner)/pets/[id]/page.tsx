import {notFound} from 'next/navigation';
import Link from 'next/link';
import {serverApi} from '@/lib/api/server';
import {field,rows,str,type Row} from '@/lib/types/domain';
import {dateInputValue} from '@/lib/pets/payloads';
import {MedicalRecordsWorkspace} from '@/components/pets/MedicalRecordsWorkspace';
import {PetProfileEditors} from '@/components/features/PetProfileEditors';
import {ArchivePet} from '@/components/pets/ArchivePet';
import {ErrorState} from '@/components/ui/ErrorState';
import {StatusBadge} from '@/components/ui/StatusBadge';

export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[1-9]\d*$/.test(id))notFound();
 let pet:Row;
 try{pet=(await serverApi(`/pets/${id}`,true)) as Row;}
 catch(error){return <section className="page-section"><Link href="/pets" className="inline-link">← My pets</Link><div className="pet-detail-error"><ErrorState message={error instanceof Error?error.message:'This pet is unavailable.'}/></div></section>;}
 if(!pet||!str(pet,'id'))notFound();
 let timeline:Row[]=[];
 let timelineError='';
 try{timeline=rows(await serverApi(`/pets/${id}/medical`,true));}
 catch(error){timelineError=error instanceof Error?error.message:'Unable to load health history.';}
 const name=str(pet,'name');
 const birth=dateInputValue(field(pet,'dateOfBirth'));
 return <section className="page-section">
   <div className="page-heading"><div><Link href="/pets" className="inline-link">← My pets</Link><span className="eyebrow pet-detail-eyebrow">COMPANION PROFILE</span><h1>{name}</h1><p>{str(pet,'species')}{str(pet,'breed')?` · ${str(pet,'breed')}`:''}</p></div><StatusBadge status={str(pet,'status')||'ACTIVE'}/></div>
   <div className="pet-facts panel"><div><strong>Species</strong><span>{str(pet,'species')||'Not specified'}</span></div><div><strong>Breed</strong><span>{str(pet,'breed')||'Not specified'}</span></div><div><strong>Sex</strong><span>{str(pet,'sex')||'Unknown'}</span></div><div><strong>Birth date</strong><span>{birth||'Not recorded'}</span></div></div>
   <div className="dashboard-lower"><div>
      <MedicalRecordsWorkspace petId={id} initialRecords={timeline} initialError={timelineError} editable={(str(pet,'status')||'ACTIVE').toUpperCase()==='ACTIVE'}/>
      <div className="panel"><h2>Quick links</h2><div className="quick-actions"><Link className="btn btn-secondary" href={`/care?petId=${id}`}>Care tasks</Link><Link className="btn btn-secondary" href="/appointments">Vet visits</Link><Link className="btn btn-secondary" href="/expenses">Expenses</Link></div></div>
      {(str(pet,'status')||'ACTIVE').toUpperCase()==='ACTIVE'&&<ArchivePet id={id} name={name}/>}
   </div><div>{(str(pet,'status')||'ACTIVE').toUpperCase()==='ACTIVE'&&<PetProfileEditors pet={pet}/>}</div></div>
 </section>;
}
