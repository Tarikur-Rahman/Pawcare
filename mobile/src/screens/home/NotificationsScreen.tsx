import React,{useState} from 'react';import {Alert,Text,View} from 'react-native';
import {Screen,Surface} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';import {LoadingSkeleton} from '../../components/ui/LoadingSkeleton';import {EmptyState} from '../../components/ui/EmptyState';
import {ErrorBanner} from '../../components/ui/ErrorBanner';import {useQueryState} from '../../lib/hooks/useQueryState';import {post} from '../../lib/api/http';import {getErrorMessage} from '../../lib/api/errors';import {t} from '../../lib/theme/tokens';import {prettyDate} from '../../lib/utils/date';
type Notification={id:number;title:string;body:string;readAt?:string|null;createdAt:string};
export default function NotificationsScreen(){const {data,loading,error,refresh}=useQueryState<Notification[]>('/notifications');const [busy,setBusy]=useState<number|null>(null);
 async function mark(id:number){try{setBusy(id);await post(`/notifications/${id}/read`);await refresh();}catch(e){Alert.alert('Unable to mark as read',getErrorMessage(e));}finally{setBusy(null);}}
 return <Screen title="Notifications" subtitle="Important PawCare updates" back onRefresh={()=>void refresh()} refreshing={loading}>
 {error&&<ErrorBanner message={error} onRetry={()=>void refresh()}/>}{loading&&!data?<LoadingSkeleton/>:!data?.length?<EmptyState message="Your notifications will appear here."/>:
 data.map(item=><Surface key={item.id}><Text style={{fontWeight:'800',fontSize:16,color:t.ink}}>{item.title}</Text><Text style={{color:t.muted,marginTop:5}}>{item.body}</Text><Text style={{color:t.muted,marginTop:8,fontSize:12}}>{prettyDate(item.createdAt)}</Text>
 {!item.readAt&&<Button title="Mark as read" variant="outline" loading={busy===item.id} onPress={()=>void mark(item.id)} style={{marginTop:11}}/>}</Surface>)}</Screen>;
}
