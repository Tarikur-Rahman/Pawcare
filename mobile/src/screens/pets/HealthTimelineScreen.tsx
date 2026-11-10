import React,{useState} from 'react';import {Text,Alert,View} from 'react-native';import {useRoute} from '@react-navigation/native';
import {Screen,Surface} from '../../components/ui/Screen';import {Input} from '../../components/ui/Input';import {Button} from '../../components/ui/Button';import {ErrorBanner} from '../../components/ui/ErrorBanner';
import {LoadingSkeleton} from '../../components/ui/LoadingSkeleton';import {EmptyState} from '../../components/ui/EmptyState';
import {useQueryState} from '../../lib/hooks/useQueryState';import {post} from '../../lib/api/http';import {prettyDate,isoFromLocal} from '../../lib/utils/date';import {getErrorMessage} from '../../lib/api/errors';import {t} from '../../lib/theme/tokens';
type Event={type:string;title:string;occurredAt:string;id:number};
export default function HealthTimelineScreen(){const route=useRoute<any>(),petId=Number(route.params?.petId||route.params?.id||0);
 const {data,loading,error,refresh}=useQueryState<Event[]>(`/pets/${petId}/medical`);
 const [type,setType]=useState<'VACCINE'|'MEDICATION'>('VACCINE'),[name,setName]=useState(''),[date,setDate]=useState(''),[details,setDetails]=useState(''),[busy,setBusy]=useState(false);
 async function save(){try{setBusy(true);if(!name.trim())throw new Error('Name is required');const when=isoFromLocal(date);
 if(type==='VACCINE')await post(`/pets/${petId}/medical/vaccinations`,{vaccineName:name,administeredAt:when,nextDueAt:null});
 else await post(`/pets/${petId}/medical/medications`,{medicationName:name,dosageText:details||'As directed',startAt:when,endAt:null});
 setName('');setDate('');setDetails('');await refresh();Alert.alert('Saved','Health record added.');}catch(e){Alert.alert('Unable to save',getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title="Health timeline" subtitle="Vaccinations, medications and veterinary records." back onRefresh={()=>void refresh()} refreshing={loading}>
 {error&&<ErrorBanner message={error} onRetry={()=>void refresh()}/>}<Text style={{color:t.ink,fontWeight:'800'}}>Timeline</Text>
 {loading&&!data?<LoadingSkeleton/>:!data?.length?<EmptyState message="No health records yet."/>:data.map(x=><Surface key={`${x.type}-${x.id}`}><Text style={{color:t.ink,fontWeight:'800'}}>{x.type} · {x.title}</Text><Text style={{color:t.muted,marginTop:5}}>{prettyDate(x.occurredAt)}</Text></Surface>)}
 <Surface><Text style={{color:t.ink,fontSize:17,fontWeight:'800',marginBottom:12}}>Add medical record</Text>
 <View style={{flexDirection:'row',gap:8,marginBottom:15}}><Button title="Vaccination" variant={type==='VACCINE'?'primary':'outline'} onPress={()=>setType('VACCINE')} style={{flex:1}}/><Button title="Medication" variant={type==='MEDICATION'?'primary':'outline'} onPress={()=>setType('MEDICATION')} style={{flex:1}}/></View>
 <Input label={type==='VACCINE'?'Vaccine name':'Medication name'} value={name} onChangeText={setName}/>
 <Input label="Date/time (ISO local)" placeholder="2026-11-10T14:30" value={date} onChangeText={setDate}/>
 {type==='MEDICATION'&&<Input label="Dosage instructions" value={details} onChangeText={setDetails}/>}
 <Button title="Save record" loading={busy} onPress={()=>void save()}/></Surface></Screen>;
}
