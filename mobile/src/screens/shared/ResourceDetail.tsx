import React from 'react';import {Text,View} from 'react-native';import {useRoute,useNavigation} from '@react-navigation/native';
import {Screen,Surface,LabeledValue} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';
import {LoadingSkeleton} from '../../components/ui/LoadingSkeleton';import {ErrorBanner} from '../../components/ui/ErrorBanner';
import {useQueryState} from '../../lib/hooks/useQueryState';import {t} from '../../lib/theme/tokens';
export function ResourceDetail({title,path,actions=[],publicData=false,description}:{title:string;path:string;publicData?:boolean;description?:string;actions?:{label:string;route:string}[]}){
 const route=useRoute<any>(),nav=useNavigation<any>();const id=Number(route.params?.id||route.params?.petId||0);
 const {data,loading,error,refresh}=useQueryState<Record<string,unknown>>(path.replace(':id',String(id)),{publicData});
 return <Screen title={title} subtitle={description} back onRefresh={()=>void refresh()} refreshing={loading&&!data}>
 {error&&<ErrorBanner message={error} onRetry={()=>void refresh()}/>}
 {loading&&!data?<LoadingSkeleton/>:data?<Surface>
 {Object.entries(data).filter(([k,v])=>v===null||['string','number','boolean'].includes(typeof v)).map(([key,val])=><LabeledValue key={key} label={key.replace(/[A-Z]/g,c=>' '+c)} value={val}/>)}
 </Surface>:!error?<Text style={{color:t.muted}}>No record found.</Text>:null}
 {actions.map((a)=><Button key={a.label} title={a.label} onPress={()=>nav.navigate(a.route,{id,petId:id})}/>)}
 </Screen>;
}
