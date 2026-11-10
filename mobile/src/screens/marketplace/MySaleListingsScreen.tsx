import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {Screen,Surface} from '../../components/ui/Screen';import {Input} from '../../components/ui/Input';import {Button} from '../../components/ui/Button';import {ErrorBanner} from '../../components/ui/ErrorBanner';
import {api,post} from '../../lib/api/http';import {getErrorMessage} from '../../lib/api/errors';import {t} from '../../lib/theme/tokens';
export default function MySaleListingsScreen(){const [listing,setListing]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(){try{setBusy(true);setError('');await post(`/marketplace/pets/${Number(listing)}/submit`);Alert.alert('Submitted','Listing submitted for moderation.');}catch(e){setError(getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title="My sale listings" subtitle="Submit drafts for review and view private inquiries." back><Surface>
 {error&&<ErrorBanner message={error}/>}<Input label="Draft listing ID" value={listing} onChangeText={setListing} keyboardType="number-pad" helper="The backend does not yet expose a personal sale listing index."/>
 <Button title="Submit for moderation" disabled={Number(listing)<=0} loading={busy} onPress={()=>void submit()}/></Surface>
 <Text style={{color:t.muted,fontSize:12}}>Public sales are not finalized in the current backend. Buyers may send inquiries only.</Text></Screen>;
}
