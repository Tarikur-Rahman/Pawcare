import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {useRoute} from '@react-navigation/native';
import {Screen,Surface,LabeledValue} from '../../components/ui/Screen';import {ErrorBanner} from '../../components/ui/ErrorBanner';import {LoadingSkeleton} from '../../components/ui/LoadingSkeleton';
import {InquiryPanel} from '../../components/marketplace/InquiryPanel';import {useQueryState} from '../../lib/hooks/useQueryState';import {post} from '../../lib/api/http';import {getErrorMessage} from '../../lib/api/errors';import {useAuth} from '../../lib/auth/AuthContext';
import {formatMoney} from '../../lib/utils/money';import {SaleListing} from '../../lib/models/domain';import {t} from '../../lib/theme/tokens';
export default function SaleDetailsScreen(){const {params}=useRoute<any>(),id=Number(params?.id||0),{user}=useAuth();const {data,loading,error,refresh}=useQueryState<SaleListing>(`/marketplace/pets/${id}`,{publicData:true});const [busy,setBusy]=useState(false);
 async function inquire(message:string){try{setBusy(true);await post('/marketplace/inquiries',{listingId:id,message});Alert.alert('Inquiry sent','The seller can review your private message.');}catch(e){Alert.alert('Inquiry failed',getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title="Marketplace listing" back subtitle="Animal welfare and seller checks come before any transaction.">
 {error&&<ErrorBanner message={error} onRetry={()=>void refresh()}/>}{loading&&!data?<LoadingSkeleton/>:data?<Surface>
 <Text style={{fontSize:19,fontWeight:'800',color:t.ink}}>{data.title}</Text><Text style={{color:t.muted,marginTop:7,lineHeight:20}}>{data.description}</Text>
 <LabeledValue label="Species" value={data.species}/><LabeledValue label="Area" value={data.generalArea}/>
 <LabeledValue label="Asking price" value={formatMoney(data.askingMinor,data.currency)}/></Surface>:null}
 {user?<Surface><InquiryPanel loading={busy} onSubmit={message=>void inquire(message)}/></Surface>:<Text style={{color:t.muted}}>Sign in to send a private inquiry.</Text>}
 <Text style={{color:t.warning}}>Live-animal purchase and shipment are disabled until legal and welfare checks are complete.</Text></Screen>;
}
