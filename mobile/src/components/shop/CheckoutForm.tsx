import React,{useState} from 'react';import {Text,View} from 'react-native';import {Button} from '../ui/Button';import {t} from '../../lib/theme/tokens';
type Address={id:number;recipientName:string;line1:string;city:string;countryCode:string;scope:string};
export function CheckoutForm({addresses,onCheckout,onAddAddress,loading}:{addresses:Address[];onCheckout:(addressId:number)=>void;onAddAddress:()=>void;loading?:boolean}){
 const [addressId,setAddressId]=useState<number|null>(null);const valid=addresses.some(a=>a.id===addressId&&a.scope==='SHIPPING');
 return <View style={{gap:10}}><Text style={{color:t.ink,fontSize:15,fontWeight:'800',marginBottom:6}}>Select a shipping address</Text>
 {addresses.filter(a=>a.scope==='SHIPPING').map(a=><Button key={a.id} title={`${a.recipientName} · ${a.city} (#${a.id})`} variant={addressId===a.id?'primary':'outline'} onPress={()=>setAddressId(a.id)}/>)}
 <Button title="Add a shipping address" variant="ghost" onPress={onAddAddress}/>
 <Button title="Place unpaid order" loading={loading} disabled={!valid||loading} onPress={()=>{if(addressId!==null)onCheckout(addressId);}}/>
 </View>
}
