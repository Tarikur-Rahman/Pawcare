import React from 'react';import {Text,View} from 'react-native';import {useNavigation} from '@react-navigation/native';
import {Screen,Surface,SectionTitle} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';
import {LoadingSkeleton} from '../../components/ui/LoadingSkeleton';import {ErrorBanner} from '../../components/ui/ErrorBanner';
import {useAuth} from '../../lib/auth/AuthContext';import {useQueryState} from '../../lib/hooks/useQueryState';import {field} from '../../lib/models/domain';import {t} from '../../lib/theme/tokens';
export default function DashboardScreen(){const nav=useNavigation<any>(),{user}=useAuth();const {data,loading,error,refresh}=useQueryState<Record<string,unknown>>('/reports/dashboard');
 const cards=[['My pets','petCount'],['Care tasks','pendingTasks'],['Visits','upcomingVisits'],['Unread','unreadNotifications']];
 return <Screen title={`Hello, ${user?.displayName?.split(' ')[0]||'friend'} 👋`} eyebrow="YOUR PET COMPANION" subtitle="Everything your pets need, together." refreshing={loading&&!!data} onRefresh={()=>void refresh()}>
 {error&&<ErrorBanner message={error} onRetry={()=>void refresh()}/>}
 {loading&&!data?<LoadingSkeleton/>:<View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{cards.map(([label,key])=><View key={key} style={{width:'48%',backgroundColor:t.paper,padding:18,borderRadius:16,borderWidth:1,borderColor:t.border}}><Text style={{fontSize:30,fontWeight:'900',color:t.brand}}>{String(field(data,key)??'—')}</Text><Text style={{color:t.muted,marginTop:4}}>{label}</Text></View>)}</View>}
 <SectionTitle>Quick actions</SectionTitle><Surface><View style={{gap:10}}>
 <Button title="🐾 Add a pet" onPress={()=>nav.navigate('EditPet')}/>
 <Button title="🩺 Book a vet visit" variant="outline" onPress={()=>nav.navigate('BookVisit')}/>
 <Button title="💚 Browse adoption" variant="outline" onPress={()=>nav.navigate('AdoptionList')}/>
 <Button title="🛍 Shop pet food" variant="outline" onPress={()=>nav.navigate('FoodStore')}/>
 <Button title="🔔 Notifications" variant="ghost" onPress={()=>nav.navigate('Notifications')}/>
 </View></Surface></Screen>;
}
