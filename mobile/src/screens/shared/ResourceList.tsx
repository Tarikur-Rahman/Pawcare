import React,{useMemo,useState} from 'react';
import {Text,View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Screen,Surface} from '../../components/ui/Screen';
import {Input} from '../../components/ui/Input';
import {Button} from '../../components/ui/Button';
import {EmptyState} from '../../components/ui/EmptyState';
import {LoadingSkeleton} from '../../components/ui/LoadingSkeleton';
import {ErrorBanner} from '../../components/ui/ErrorBanner';
import {PetSummaryCard} from '../../components/pets/PetSummaryCard';
import {AdoptionCard} from '../../components/adoption/AdoptionCard';
import {SaleCard} from '../../components/marketplace/SaleCard';
import {LostPetCard} from '../../components/lostfound/LostPetCard';
import {ProductCard} from '../../components/shop/ProductCard';
import {useQueryState} from '../../lib/hooks/useQueryState';
import {t} from '../../lib/theme/tokens';
import {useAuth} from '../../lib/auth/AuthContext';
import type {Pet,Adoption,SaleListing,LostPost,Product} from '../../lib/models/domain';
type Props={title:string;subtitle:string;path:string;detail?:string;create?:string;createLabel?:string;
 kind?:'pet'|'adoption'|'sale'|'lost'|'product'|'generic';publicData?:boolean;cacheKey?:string;emptyText?:string};
export function ResourceList(props:Props){
 const nav=useNavigation<any>(); const {user}=useAuth(); const {data,loading,error,stale,refresh}=useQueryState<unknown>(props.path,{publicData:props.publicData,cacheKey:props.cacheKey});
 const [filter,setFilter]=useState('');
 const rows=Array.isArray(data)?data as Record<string,unknown>[]:[];
 const visible=useMemo(()=>rows.filter(r=>Object.values(r).some(v=>String(v||'').toLowerCase().includes(filter.trim().toLowerCase()))),[rows,filter]);
 const open=(item:Record<string,unknown>)=>{if(props.detail)nav.navigate(props.detail,{id:Number(item.id),petId:Number(item.id)});};
 return <Screen title={props.title} subtitle={props.subtitle} refreshing={loading&&data!==null} onRefresh={()=>void refresh()}>
  {!!props.create&&!!user&&<Button title={props.createLabel||'Create new'} onPress={()=>nav.navigate(props.create)}/>}
  {!!error&&<ErrorBanner message={error} onRetry={()=>void refresh()}/>}
  {stale&&<Text style={{color:t.warning,fontSize:12}}>Offline saved public data · may be outdated</Text>}
  <Input label="Search" placeholder="Find by name, area, or type" value={filter} onChangeText={setFilter} autoCapitalize="none"/>
  {loading&&!data?<LoadingSkeleton/>:visible.length===0?<EmptyState message={props.emptyText||'There are no matching records yet.'}/>:
   visible.map((r,i)=><View key={String(r.id??i)}>
   {props.kind==='pet'?<PetSummaryCard pet={r as Pet} onPress={()=>open(r)}/>:
    props.kind==='adoption'?<AdoptionCard item={r as Adoption} onPress={()=>open(r)}/>:
    props.kind==='sale'?<SaleCard item={r as SaleListing} onPress={()=>open(r)}/>:
    props.kind==='lost'?<LostPetCard item={r as LostPost} onPress={()=>open(r)}/>:
    props.kind==='product'?<ProductCard item={r as Product} onPress={()=>open(r)}/>:
    <Surface><Text style={{color:t.ink,fontWeight:'800',fontSize:15}}>{String(r.title||r.name||r.displayName||r.orderNumber||r.id||'Record')}</Text>
     {Object.entries(r).filter(([k])=>!['title','name','displayName','id','description'].includes(k)).slice(0,5).map(([k,v])=><Text key={k} style={{color:t.muted,fontSize:12,marginTop:5}}>{k.replace(/[A-Z]/g,c=>' '+c)}: {v===null?'—':String(v)}</Text>)}
     {!!props.detail&&<Button title="View details" variant="outline" onPress={()=>open(r)} style={{marginTop:10}}/>}</Surface>}
   </View>)}
 </Screen>;
}
