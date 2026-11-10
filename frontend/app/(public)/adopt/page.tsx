import {safePublic} from '@/lib/api/server';
import {rows} from '@/lib/types/domain';
import {AdoptionCatalog} from '@/components/adoption/AdoptionCatalog';

export const dynamic='force-dynamic';

export default async function Page(){
 const {data,error}=await safePublic('/adoptions');
 return <AdoptionCatalog items={rows(data)} error={error}/>;
}
