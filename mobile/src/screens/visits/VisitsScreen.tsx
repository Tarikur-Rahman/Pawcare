import React from 'react';import {useNavigation} from '@react-navigation/native';
import {Screen} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';import {EmptyState} from '../../components/ui/EmptyState';
import {ErrorBanner} from '../../components/ui/ErrorBanner';import {LoadingSkeleton} from '../../components/ui/LoadingSkeleton';
import {VisitCalendar} from '../../components/appointments/VisitCalendar';import {useQueryState} from '../../lib/hooks/useQueryState';import {Visit} from '../../lib/models/domain';
export default function VisitsScreen(){const nav=useNavigation<any>(),{data,loading,error,refresh}=useQueryState<Visit[]>('/appointments');return <Screen title="Vet visits" subtitle="Book and track appointments." onRefresh={()=>void refresh()} refreshing={loading}>
 <Button title="+ Book a visit" onPress={()=>nav.navigate('BookVisit')}/><Button title="Find veterinarians" variant="outline" onPress={()=>nav.navigate('VetDirectory')}/>
 {error&&<ErrorBanner message={error} onRetry={()=>void refresh()}/>}{loading&&!data?<LoadingSkeleton/>:!data?.length?<EmptyState message="No appointments scheduled."/>:<VisitCalendar visits={data}/>}</Screen>}
