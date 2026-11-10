import React,{useState} from 'react';import {Alert,Pressable,Text,View} from 'react-native';import {useNavigation} from '@react-navigation/native';
import {Screen,Surface} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';import {ErrorBanner} from '../../components/ui/ErrorBanner';
import {EmptyState} from '../../components/ui/EmptyState';import {LoadingSkeleton} from '../../components/ui/LoadingSkeleton';import {StatusBadge} from '../../components/ui/StatusBadge';
import {useQueryState} from '../../lib/hooks/useQueryState';import {post} from '../../lib/api/http';import {getErrorMessage} from '../../lib/api/errors';import {Pet} from '../../lib/models/domain';import {prettyDate} from '../../lib/utils/date';import {t} from '../../lib/theme/tokens';
type Task={id:number;type:string;title:string;dueAt:string;status:string};
export default function CareScreen(){const nav=useNavigation<any>(),[petId,setPetId]=useState<number|null>(null);
 const pets=useQueryState<Pet[]>('/pets'),tasks=useQueryState<Task[]>(petId?`/pets/${petId}/tasks`:'/pets/0/tasks',{enabled:!!petId});
 async function complete(id:number){try{await post(`/tasks/${id}/complete`);await tasks.refresh();}catch(e){Alert.alert('Unable to update task',getErrorMessage(e));}}
 return <Screen title="Daily care" subtitle="Your routine, made simple." onRefresh={()=>void Promise.all([pets.refresh(),tasks.refresh()])} refreshing={tasks.loading}>
 <Button title="Reminder preferences" variant="outline" onPress={()=>nav.navigate('ReminderSettings')}/>
 {pets.loading&&!pets.data?<LoadingSkeleton/>:<View style={{gap:8}}><Text style={{color:t.ink,fontWeight:'700'}}>Choose a pet</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(pets.data||[]).map(p=><Button key={p.id} title={p.name} variant={petId===p.id?'primary':'outline'} onPress={()=>setPetId(p.id)}/>)}</View></View>}
 {petId?<><Button title="+ Create care task" onPress={()=>nav.navigate('TaskEditor',{petId})}/>{tasks.error&&<ErrorBanner message={tasks.error} onRetry={()=>void tasks.refresh()}/>}
 {tasks.loading&&!tasks.data?<LoadingSkeleton/>:!tasks.data?.length?<EmptyState message="No care tasks scheduled for this pet."/>:tasks.data.map(x=><Surface key={x.id}><Text style={{color:t.ink,fontWeight:'800'}}>{x.title}</Text><Text style={{color:t.muted,marginTop:7}}>{x.type} · {prettyDate(x.dueAt)}</Text><View style={{marginVertical:8}}><StatusBadge value={x.status}/></View>{x.status==='PENDING'&&<Button title="Mark complete" variant="outline" onPress={()=>void complete(x.id)}/>}</Surface>)}</>:<EmptyState message="Choose a pet above to see its care schedule."/>}
 </Screen>;
}
