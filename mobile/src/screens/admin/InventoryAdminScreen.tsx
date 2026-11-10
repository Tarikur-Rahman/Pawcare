import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {Screen,Surface} from '../../components/ui/Screen';import {Input} from '../../components/ui/Input';import {Button} from '../../components/ui/Button';
import {ErrorBanner} from '../../components/ui/ErrorBanner';import {ResourceList} from '../shared/ResourceList';import {post} from '../../lib/api/http';import {getErrorMessage} from '../../lib/api/errors';
export default function InventoryAdminScreen(){const [productId,setProductId]=useState(''),[delta,setDelta]=useState(''),[reason,setReason]=useState('RESTOCK'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function adjust(){try{setBusy(true);setError('');await post('/admin/inventory/adjust',{productId:Number(productId),quantityDelta:Number(delta),reason:reason.toUpperCase()});Alert.alert('Stock adjusted','Reload inventory to see the current balance.');}catch(e){setError(getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title="Inventory" subtitle="Authorized store staff only." back>{error&&<ErrorBanner message={error}/>}
 <Surface><Input label="Product ID" value={productId} onChangeText={setProductId} keyboardType="number-pad"/><Input label="Quantity delta" value={delta} onChangeText={setDelta} keyboardType="numeric" helper="Positive to add; negative to reduce."/>
 <Input label="Reason code" value={reason} onChangeText={setReason} placeholder="RESTOCK"/><Button title="Apply adjustment" loading={busy} onPress={()=>void adjust()}/></Surface></Screen>;
}
