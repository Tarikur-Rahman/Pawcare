import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {useRoute,useNavigation} from '@react-navigation/native';import {Screen,Surface} from '../../components/ui/Screen';
import {Input} from '../../components/ui/Input';import {Button} from '../../components/ui/Button';import {PhotoPicker} from '../../components/media/PhotoPicker';
import {ErrorBanner} from '../../components/ui/ErrorBanner';import {post} from '../../lib/api/http';import {isoFromLocal} from '../../lib/utils/date';import {getErrorMessage} from '../../lib/api/errors';import {t} from '../../lib/theme/tokens';
export default function SightingScreen(){const nav=useNavigation<any>(),route=useRoute<any>(),id=Number(route.params?.id||0);
 const [area,setArea]=useState(''),[date,setDate]=useState(''),[description,setDescription]=useState(''),[proof,setProof]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function sendSighting(){try{setBusy(true);setError('');await post(`/lost-found/${id}/sightings`,{approximateArea:area,observedAt:isoFromLocal(date),description});Alert.alert('Sighting submitted','The report owner can review your private sighting.');nav.goBack();}catch(e){setError(getErrorMessage(e));}finally{setBusy(false);}}
 async function claim(){try{setBusy(true);setError('');if(!proof)throw new Error('Please upload proof first.');await post(`/lost-found/${id}/claims`,{proofAssetId:proof});Alert.alert('Claim sent','Reunification requires moderator review and both parties’ confirmation.');nav.goBack();}catch(e){setError(getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title="Sighting & claim" subtitle="Share private information only through reviewed PawCare requests." back>
 {error&&<ErrorBanner message={error}/>}<Surface><Input label="Approximate area" value={area} onChangeText={setArea}/>
 <Input label="Observed at (ISO local)" value={date} onChangeText={setDate} placeholder="2026-11-10T18:00"/>
 <Input label="Private description" multiline value={description} onChangeText={setDescription}/>
 <Button title="Submit sighting" loading={busy} onPress={()=>void sendSighting()}/></Surface>
 <Surface><Text style={{color:t.ink,fontWeight:'800',marginBottom:12}}>Claim ownership / reunification</Text>
 <PhotoPicker onUploaded={result=>{const n=Number((result as {id?:number})?.id);if(n>0)setProof(n);}}/>
 <Button title="Submit verified claim" disabled={!proof} loading={busy} onPress={()=>void claim()}/></Surface></Screen>;
}
