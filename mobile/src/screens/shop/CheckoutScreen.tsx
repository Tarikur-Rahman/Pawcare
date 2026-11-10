import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {useNavigation} from '@react-navigation/native';import {Screen,Surface} from '../../components/ui/Screen';
import {CheckoutForm} from '../../components/shop/CheckoutForm';import {ErrorBanner} from '../../components/ui/ErrorBanner';import {useQueryState} from '../../lib/hooks/useQueryState';
import {api} from '../../lib/api/http';import {getErrorMessage} from '../../lib/api/errors';import {CartLine} from '../../lib/models/domain';import {t} from '../../lib/theme/tokens';
function makeKey(){const r=Math.random().toString(36).slice(2);return `mobile-checkout-${Date.now()}-${r}`;}
export default function CheckoutScreen(){const nav=useNavigation<any>(),{data,error}=useQueryState<CartLine[]>('/cart'),addresses=useQueryState<{id:number;recipientName:string;line1:string;city:string;countryCode:string;scope:string}[]>('/users/me/addresses'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const [key,setKey]=useState(makeKey);
 async function checkout(shippingAddressId:number){try{setBusy(true);setMessage('');if(!data?.length)throw new Error('Your cart is empty.');
 await api('/checkout',{method:'POST',body:{shippingAddressId},headers:{'Idempotency-Key':key}});
 Alert.alert('Order placed','Your order is unpaid. Payment collection is not enabled yet. Stock has been reserved.',[{text:'View orders',onPress:()=>nav.navigate('Orders')}]);setKey(makeKey());
 }catch(e){setMessage(getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title="Checkout" subtitle="Safe, server-side stock reservation" back>
 {(error||message)&&<ErrorBanner message={error||message}/>}<Surface><CheckoutForm addresses={addresses.data||[]} loading={busy} onAddAddress={()=>nav.navigate('Addresses')} onCheckout={id=>void checkout(id)}/></Surface>
 <Text style={{color:t.muted,fontSize:12,lineHeight:19}}>Checkout creates an unpaid order. No money is charged. If network status is uncertain, retry with the same request key; do not submit a new order blindly.</Text></Screen>;
}
