import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {useRoute} from '@react-navigation/native';
import {Screen,Surface,LabeledValue} from '../../components/ui/Screen';import {LoadingSkeleton} from '../../components/ui/LoadingSkeleton';import {ErrorBanner} from '../../components/ui/ErrorBanner';
import {ApplicationForm} from '../../components/adoption/ApplicationForm';import {useQueryState} from '../../lib/hooks/useQueryState';import {post} from '../../lib/api/http';
import {getErrorMessage} from '../../lib/api/errors';import {useAuth} from '../../lib/auth/AuthContext';import {t} from '../../lib/theme/tokens';import {Adoption} from '../../lib/models/domain';
export default function AdoptionDetailsScreen(){const route=useRoute<any>(),id=Number(route.params?.id||0),{user}=useAuth();
 const {data,loading,error,refresh}=useQueryState<Adoption>(`/adoptions/${id}`,{publicData:true});const [sending,setSending]=useState(false);
 async function apply(answers:string){try{setSending(true);await post(`/adoptions/${id}/applications`,{answers});Alert.alert('Application submitted','The owner will review your request.');}catch(e){Alert.alert('Unable to apply',getErrorMessage(e));}finally{setSending(false);}}
 return <Screen title="Adoption details" back subtitle="Learn about the pet before requesting adoption.">
 {error&&<ErrorBanner message={error} onRetry={()=>void refresh()}/>}{loading&&!data?<LoadingSkeleton/>:data?<Surface>
 <Text style={{color:t.ink,fontWeight:'900',fontSize:19}}>{data.title}</Text><Text style={{color:t.muted,marginTop:7,lineHeight:21}}>{data.description}</Text>
 <LabeledValue label="Species" value={data.species}/><LabeledValue label="General area" value={data.generalArea}/></Surface>:null}
 {user?<Surface><ApplicationForm loading={sending} onSubmit={answers=>void apply(answers)}/></Surface>:<Text style={{color:t.muted}}>Sign in to submit an adoption application.</Text>}
 </Screen>;
}
