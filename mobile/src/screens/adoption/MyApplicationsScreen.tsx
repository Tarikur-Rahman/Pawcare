import React,{useState} from 'react';import {Alert,Text,View} from 'react-native';
import {Screen,Surface} from '../../components/ui/Screen';import {Input} from '../../components/ui/Input';import {Button} from '../../components/ui/Button';
import {ErrorBanner} from '../../components/ui/ErrorBanner';import {api,post} from '../../lib/api/http';import {getErrorMessage} from '../../lib/api/errors';import {t} from '../../lib/theme/tokens';
type Application={id:number;applicantId:number;status:string;submittedAt:string};
export default function MyApplicationsScreen(){const [id,setId]=useState(''),[applications,setApplications]=useState<Application[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{setError('');setBusy(true);setApplications(await api<Application[]>(`/adoptions/${Number(id)}/applications`));}catch(e){setError(getErrorMessage(e));}finally{setBusy(false);}}
 async function action(path:string,body?:unknown,headers?:Record<string,string>){try{setBusy(true);await post(path,body,headers);Alert.alert('Request submitted','The backend confirmed your update.');await load();}catch(e){setError(getErrorMessage(e));}finally{setBusy(false);}}
 const valid=Number.isSafeInteger(Number(id))&&Number(id)>0;
 return <Screen title="My adoptions" subtitle="Manage draft submissions, adoption requests and dual handover confirmations." back>
 <Surface><Input label="Adoption listing ID" value={id} onChangeText={setId} keyboardType="number-pad" helper="The current API does not provide a personal listing index; enter an adoption ID you own."/>
 {error&&<ErrorBanner message={error}/>}<Button title="View applications" disabled={!valid} loading={busy} onPress={()=>void load()}/>
 <View style={{height:9}}/><Button title="Submit draft for moderation" variant="outline" disabled={!valid} onPress={()=>void action(`/adoptions/${id}/submit`)}/>
 <View style={{height:9}}/><Button title="Confirm my handover step" variant="outline" disabled={!valid} onPress={()=>void action(`/adoptions/${id}/handover`,undefined,{'Idempotency-Key':`handover-${id}-${Date.now()}`})}/>
 </Surface>{applications.map(a=><Surface key={a.id}><Text style={{fontWeight:'800',color:t.ink}}>Application #{a.id}</Text><Text style={{color:t.muted}}>Applicant #{a.applicantId} · {a.status}</Text>
 <Button title="Approve application" variant="outline" onPress={()=>void action(`/adoptions/${id}/applications/${a.id}/decision`,{accept:true})}/>
 <View style={{height:8}}/><Button title="Decline application" variant="ghost" onPress={()=>void action(`/adoptions/${id}/applications/${a.id}/decision`,{accept:false})}/></Surface>)}
 <Text style={{color:t.muted,fontSize:12}}>Ownership changes only after both authorized participants confirm a verified handover.</Text></Screen>;
}
