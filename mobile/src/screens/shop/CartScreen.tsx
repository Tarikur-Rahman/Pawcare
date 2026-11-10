import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {useNavigation} from '@react-navigation/native';
import {Screen,Surface} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';import {CartSummary} from '../../components/shop/CartSummary';
import {ErrorBanner} from '../../components/ui/ErrorBanner';import {EmptyState} from '../../components/ui/EmptyState';
import {useQueryState} from '../../lib/hooks/useQueryState';import {q} from '../../lib/api/queries';import {CartLine} from '../../lib/models/domain';import {formatMoney} from '../../lib/utils/money';import {getErrorMessage} from '../../lib/api/errors';import {t} from '../../lib/theme/tokens';
export default function CartScreen(){const nav=useNavigation<any>(),{data,loading,error,refresh}=useQueryState<CartLine[]>('/cart'),[busy,setBusy]=useState(false);
 async function change(item:CartLine,delta:number){try{setBusy(true);await q.setCart(item.productId,Math.max(0,item.quantity+delta));await refresh();}catch(e){Alert.alert('Unable to update cart',getErrorMessage(e));}finally{setBusy(false);}}
 const currencies=new Set((data||[]).map(x=>x.currency));
 return <Screen title="Your cart" subtitle="Check quantities before reserving stock." back onRefresh={()=>void refresh()} refreshing={loading}>
 {error&&<ErrorBanner message={error} onRetry={()=>void refresh()}/>}
 {!data?.length?<EmptyState message="Your food cart is empty." action="Browse products" onAction={()=>nav.navigate('FoodStore')}/>:<>
 {data.map(x=><Surface key={x.productId}><Text style={{color:t.ink,fontWeight:'800'}}>{x.title}</Text><Text style={{color:t.brand,marginTop:5}}>{formatMoney(x.priceMinor,x.currency)} × {x.quantity}</Text>
 <Button title="− Remove one" variant="outline" loading={busy} onPress={()=>void change(x,-1)} style={{marginVertical:7}}/>
 <Button title="+ Add one" variant="outline" loading={busy} onPress={()=>void change(x,1)}/></Surface>)}
 <CartSummary items={data}/><Button title="Continue to checkout" disabled={currencies.size!==1} onPress={()=>nav.navigate('Checkout')}/></>}</Screen>;
}
