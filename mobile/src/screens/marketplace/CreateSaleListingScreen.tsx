import React,{useState} from 'react';import {Alert} from 'react-native';import {useNavigation} from '@react-navigation/native';
import {Screen,Surface} from '../../components/ui/Screen';import {Input} from '../../components/ui/Input';import {Button} from '../../components/ui/Button';
import {PhotoPicker} from '../../components/media/PhotoPicker';import {ErrorBanner} from '../../components/ui/ErrorBanner';import {post} from '../../lib/api/http';
import {getErrorMessage} from '../../lib/api/errors';import {toMinorUnits} from '../../lib/utils/money';
export default function CreateSaleListingScreen(){const nav=useNavigation<any>();const [petId,setPetId]=useState(''),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[area,setArea]=useState(''),[amount,setAmount]=useState(''),[assetId,setAssetId]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function create(){try{setBusy(true);setError('');if(!assetId)throw new Error('Upload a welfare evidence image before creating a draft.');
 await post('/marketplace/pets',{petId:Number(petId),title,description,generalArea:area,askingMinor:toMinorUnits(amount),currency:'BDT',welfareEvidenceFileId:assetId});
 Alert.alert('Draft created','Your listing is not public until reviewed.');nav.goBack();}catch(e){setError(getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title="Create sale draft" subtitle="Only verified sellers can submit moderated pet listings." back><Surface>
 {!!error&&<ErrorBanner message={error}/>}<Input label="Your pet ID" value={petId} keyboardType="number-pad" onChangeText={setPetId}/>
 <Input label="Listing title" value={title} onChangeText={setTitle}/><Input label="Description and animal welfare details" multiline value={description} onChangeText={setDescription}/>
 <Input label="General area (never a street address)" value={area} onChangeText={setArea}/><Input label="Asking amount (BDT)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount}/>
 <PhotoPicker onUploaded={result=>{const id=Number((result as {id?:number})?.id);if(id>0)setAssetId(id);}}/>
 <Button title="Save private draft" loading={busy} disabled={!assetId} onPress={()=>void create()}/></Surface></Screen>;
}
