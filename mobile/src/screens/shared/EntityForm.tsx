import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {useNavigation,useRoute} from '@react-navigation/native';
import {Screen,Surface} from '../../components/ui/Screen';import {Input} from '../../components/ui/Input';import {Button} from '../../components/ui/Button';
import {ErrorBanner} from '../../components/ui/ErrorBanner';import {api,RequestOptions} from '../../lib/api/http';
import {getErrorMessage,ApiError} from '../../lib/api/errors';import {required} from '../../lib/validation/forms';import {t} from '../../lib/theme/tokens';
export type Field={name:string;label:string;placeholder?:string;required?:boolean;multiline?:boolean;numeric?:boolean;secure?:boolean;initial?:string;helper?:string};
export type FormProps={title:string;subtitle?:string;fields:Field[];path:string;method?:'POST'|'PATCH'|'PUT';
 actionLabel?:string;completeMessage?:string;mapValues?:(v:Record<string,string>,params:any)=>Record<string,unknown>;initial?:Record<string,string>};
export function EntityForm(props:FormProps){
 const nav=useNavigation<any>(),route=useRoute<any>(),params=route.params||{};
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(props.fields.map(f=>[f.name,props.initial?.[f.name]??f.initial??''])));
 const [sending,setSending]=useState(false),[error,setError]=useState<string|null>(null);
 const [fieldErrors,setFieldErrors]=useState<Record<string,string[]>>({});
 async function submit(){setError(null);setFieldErrors({});try{
  for(const f of props.fields)if(f.required)required(values[f.name]||'',f.label);
  const body=props.mapValues?props.mapValues(values,params):Object.fromEntries(props.fields.map(f=>[f.name,f.numeric?Number(values[f.name]):values[f.name].trim()]));
  const target=props.path.replace(':id',String(params.id||params.petId||0)).replace(':petId',String(params.petId||params.id||0));
  setSending(true);await api(target,{method:props.method||'POST',body} as RequestOptions);
  Alert.alert('Saved',props.completeMessage||'The information was saved successfully.',[{text:'OK',onPress:()=>nav.canGoBack()?nav.goBack():nav.navigate('Dashboard')}]);
 }catch(e){if(e instanceof ApiError)setFieldErrors(e.fieldErrors);setError(getErrorMessage(e));}finally{setSending(false);}}
 return <Screen title={props.title} subtitle={props.subtitle} back><Surface>
 {error&&<ErrorBanner message={error}/>}
 {props.fields.map(f=><Input key={f.name} label={f.label} placeholder={f.placeholder} helper={f.helper} value={values[f.name]||''}
 onChangeText={v=>setValues(x=>({...x,[f.name]:v}))} multiline={f.multiline} numberOfLines={f.multiline?4:1}
 keyboardType={f.numeric?'numeric':'default'} secureTextEntry={f.secure} error={fieldErrors[f.name]?.[0]} />)}
 <Button title={props.actionLabel||'Save'} onPress={()=>void submit()} loading={sending}/>
 </Surface><Text style={{fontSize:12,color:t.muted}}>Data is sent securely to the PawCare API. Changes are saved only after the server confirms them.</Text></Screen>
}
