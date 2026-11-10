'use client';
import {useRouter} from 'next/navigation';
import {PetProfileForm} from '@/components/pets/PetProfileForm';
import {type Row} from '@/lib/types/domain';

/** Only profile edits belong here; medical record creation lives in MedicalRecordsWorkspace. */
export function PetProfileEditors({pet}:{pet:Row}){
 const router=useRouter();
 return <div className="panel"><h2>Edit pet profile</h2><p>Update your companion's name, breed and birthday.</p>
  <PetProfileForm mode="edit" pet={pet} onSaved={()=>router.refresh()}/>
 </div>;
}
