import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {Screen,Surface} from '../../components/ui/Screen';
import {Input} from '../../components/ui/Input';import {Button} from '../../components/ui/Button';import {ErrorBanner} from '../../components/ui/ErrorBanner';import {EmptyState} from '../../components/ui/EmptyState';
import {useQueryState} from '../../lib/hooks/useQueryState';import {post} from '../../lib/api/http';import {getErrorMessage} from '../../lib/api/errors';import {t} from '../../lib/theme/tokens';
export default function ModerationScreen(){const {data,error,refresh}=useQueryState<Record<string,unknown>[]>('/admin/moderation');const [entityType,setEntityType]=useState(''),[entityId,setEntityId]=useState(''),[reason,setReason]=useState('MANUAL_REVIEW'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function review(approve:boolean){try{setBusy(true);setMessage('');await post('/admin/moderation/decision',{entityType,entityId:Number(entityId),approve,reasonCode:reason});Alert.alert('Review saved','The moderation decision was accepted.');await refresh();}catch(e){setMessage(getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title="Moderation" subtitle="Review and decide on submitted listings." back onRefresh={()=>void refresh()}>
 {(error||message)&&<ErrorBanner message={error||message} onRetry={()=>void refresh()}/>}
 {!data?.length?<EmptyState message="No moderation items in the queue."/>:data.map((r,i)=><Surface key={String(r.id||i)}><Text style={{fontWeight:'800',color:t.ink}}>{String(r.entityType||r.type||'Review')} #{String(r.entityId||r.id||'')}</Text><Text style={{color:t.muted}}>{String(r.status||'Pending')}</Text></Surface>)}
 <Surface><Text style={{color:t.ink,fontWeight:'800',marginBottom:12}}>Review selected item</Text>
 <Input label="Entity type" value={entityType} onChangeText={setEntityType} placeholder="ADOPTION, PET_SALE, LOST_FOUND"/>
 <Input label="Entity ID" value={entityId} onChangeText={setEntityId} keyboardType="number-pad"/>
 <Input label="Reason code" value={reason} onChangeText={setReason}/>
 <Button title="Approve" disabled={!entityType||Number(entityId)<=0} loading={busy} onPress={()=>void review(true)}/>
 <Button title="Reject" disabled={!entityType||Number(entityId)<=0} variant="danger" style={{marginTop:9}} loading={busy} onPress={()=>void review(false)}/>
 </Surface></Screen>;
}
