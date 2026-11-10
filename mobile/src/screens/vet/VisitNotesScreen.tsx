import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {useRoute} from '@react-navigation/native';
import {Screen,Surface} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';import {ErrorBanner} from '../../components/ui/ErrorBanner';
import {post} from '../../lib/api/http';import {getErrorMessage} from '../../lib/api/errors';import {t} from '../../lib/theme/tokens';
export default function VisitNotesScreen(){const {params}=useRoute<any>(),id=Number(params?.id||0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function confirm(){try{setBusy(true);setError('');await post(`/appointments/${id}/confirm`);Alert.alert('Confirmed','The appointment was confirmed.');}catch(e){setError(getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title={`Vet visit #${id}`} subtitle="Review and confirm your assigned appointment." back>
 {error&&<ErrorBanner message={error}/>}<Button title="Confirm appointment" onPress={()=>void confirm()} loading={busy}/>
 <Surface><Text style={{fontWeight:'800',color:t.ink}}>Visit notes unavailable</Text><Text style={{color:t.muted,marginTop:10,lineHeight:20}}>The current API does not expose a veterinarian-specific medical-note creation endpoint. Private owner medical records are not accessible through the vet role. This screen will support notes after the authorized backend workflow is added.</Text></Surface>
 </Screen>;
}
