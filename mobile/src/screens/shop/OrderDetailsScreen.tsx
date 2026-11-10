import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {useRoute} from '@react-navigation/native';import {Screen,Surface,LabeledValue} from '../../components/ui/Screen';
import {Button} from '../../components/ui/Button';import {ErrorBanner} from '../../components/ui/ErrorBanner';import {useQueryState} from '../../lib/hooks/useQueryState';
import {post} from '../../lib/api/http';import {Order} from '../../lib/models/domain';import {getErrorMessage} from '../../lib/api/errors';import {formatMoney} from '../../lib/utils/money';import {t} from '../../lib/theme/tokens';
export default function OrderDetailsScreen(){const route=useRoute<any>(),id=Number(route.params?.id||0),{data,error,refresh}=useQueryState<Order>(`/orders/${id}`),[busy,setBusy]=useState(false);
 async function cancel(){try{setBusy(true);await post(`/orders/${id}/cancel`);Alert.alert('Cancelled','Eligible unpaid order cancelled.');await refresh();}catch(e){Alert.alert('Cannot cancel',getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title={`Order #${id}`} subtitle="Order status and reserved stock" back>{error&&<ErrorBanner message={error} onRetry={()=>void refresh()}/>}{data?<Surface>
 <LabeledValue label="Status" value={data.status}/><LabeledValue label="Order number" value={data.orderNumber}/><LabeledValue label="Total" value={formatMoney(data.totalMinor,data.currency)}/>
 {data.status==='PLACED'&&<Button title="Cancel unpaid order" variant="danger" loading={busy} onPress={()=>void cancel()}/>}</Surface>:null}
 <Text style={{color:t.muted,fontSize:12}}>Payment processing is disabled until a verified provider is configured. Only eligible unpaid placed orders may be cancelled.</Text></Screen>;
}
