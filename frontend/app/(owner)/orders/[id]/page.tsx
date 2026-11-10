import {notFound} from 'next/navigation';
import {serverApi} from '@/lib/api/server';
import {ErrorState} from '@/components/ui/ErrorState';
import {OrderDetailWorkspace} from '@/components/features/OrderDetailWorkspace';
import {positiveId} from '@/lib/shop/catalog';
import type {Row} from '@/lib/types/domain';

export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!positiveId(id))notFound();
 let order:Row;
 try{
  const data=await serverApi(`/orders/${id}`,true);
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Order data unavailable');
  order=data as Row;
 }catch{
  return <section className="page-section"><ErrorState message="Order unavailable or access denied. Return to My orders to try again."/></section>;
 }
 return <OrderDetailWorkspace initialOrder={order}/>;
}
