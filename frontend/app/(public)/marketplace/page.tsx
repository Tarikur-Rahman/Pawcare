import {safePublic} from '@/lib/api/server';
import {rows} from '@/lib/types/domain';
import {MarketplaceCatalog} from '@/components/marketplace/MarketplaceCatalog';
export const dynamic='force-dynamic';
export default async function Page(){
 const {data,error}=await safePublic('/marketplace/pets');
 return <MarketplaceCatalog items={rows(data)} error={error}/>;
}
