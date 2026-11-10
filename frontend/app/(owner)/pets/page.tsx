import {serverApi} from '@/lib/api/server';
import {rows} from '@/lib/types/domain';
import {PetManagementWorkspace} from '@/components/features/PetManagementWorkspace';

export const dynamic='force-dynamic';
export default async function Page(){
  try {
    const pets=rows(await serverApi('/pets',true));
    return <PetManagementWorkspace initialPets={pets}/>;
  } catch(error){
    return <PetManagementWorkspace initialPets={[]} initialError={error instanceof Error?error.message:'Unable to load pets.'}/>;
  }
}
