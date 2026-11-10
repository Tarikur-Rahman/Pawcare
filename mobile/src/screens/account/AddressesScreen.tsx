import React,{useState} from 'react';import {Alert,Text} from 'react-native';
import {Screen,Surface,LabeledValue} from '../../components/ui/Screen';import {Input} from '../../components/ui/Input';import {Button} from '../../components/ui/Button';
import {ErrorBanner} from '../../components/ui/ErrorBanner';import {EmptyState} from '../../components/ui/EmptyState';
import {post} from '../../lib/api/http';import {useQueryState} from '../../lib/hooks/useQueryState';import {getErrorMessage} from '../../lib/api/errors';import {t} from '../../lib/theme/tokens';
type Address={id:number;recipientName:string;line1:string;city:string;countryCode:string;scope:string};
export default function AddressesScreen(){const {data,error,refresh}=useQueryState<Address[]>('/users/me/addresses');
 const [recipientName,setName]=useState(''),[line1,setLine]=useState(''),[city,setCity]=useState(''),[countryCode,setCountry]=useState('BD'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function add(){try{setBusy(true);setMessage('');await post('/users/me/addresses',{recipientName,line1,city,countryCode,scope:'SHIPPING'});setName('');setLine('');setCity('');await refresh();Alert.alert('Address saved','You can now select it in checkout.');}catch(e){setMessage(getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title="My addresses" subtitle="Private shipping addresses for food orders." back onRefresh={()=>void refresh()}>
 {(error||message)&&<ErrorBanner message={error||message} onRetry={()=>void refresh()}/>}
 {!data?.length?<EmptyState message="Add an address before checking out."/>:data.filter(a=>a.scope==='SHIPPING').map(a=><Surface key={a.id}><Text style={{fontWeight:'800',color:t.ink}}>Address #{a.id}</Text><LabeledValue label="Recipient" value={a.recipientName}/><LabeledValue label="Address" value={`${a.line1}, ${a.city}, ${a.countryCode}`}/></Surface>)}
 <Surface><Text style={{fontWeight:'800',color:t.ink,fontSize:16,marginBottom:10}}>Add shipping address</Text>
 <Input label="Recipient name" value={recipientName} onChangeText={setName}/><Input label="Street / building" value={line1} onChangeText={setLine}/>
 <Input label="City" value={city} onChangeText={setCity}/><Input label="2-letter country code" value={countryCode} onChangeText={setCountry} autoCapitalize="characters"/>
 <Button title="Save address" disabled={!recipientName||!line1||!city||countryCode.length!==2} loading={busy} onPress={()=>void add()}/></Surface>
 </Screen>;
}
