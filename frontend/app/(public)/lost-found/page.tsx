import {safePublic} from '@/lib/api/server';
import {rows} from '@/lib/types/domain';
import {LostFoundCatalog} from '@/components/lost-found/LostFoundCatalog';
export const dynamic='force-dynamic';
export default async function Page(){
 const {data,error}=await safePublic('/lost-found');
 return <LostFoundCatalog items={rows(data)} error={error}/>;
}
