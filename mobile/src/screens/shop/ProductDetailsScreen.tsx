import React,{useState} from 'react';import {Alert,Text} from 'react-native';import {useNavigation,useRoute} from '@react-navigation/native';
import {Screen,Surface,LabeledValue} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';import {ErrorBanner} from '../../components/ui/ErrorBanner';
import {LoadingSkeleton} from '../../components/ui/LoadingSkeleton';import {useQueryState} from '../../lib/hooks/useQueryState';import {q} from '../../lib/api/queries';
import {getErrorMessage} from '../../lib/api/errors';import {Product} from '../../lib/models/domain';import {useAuth} from '../../lib/auth/AuthContext';import {formatMoney} from '../../lib/utils/money';import {t} from '../../lib/theme/tokens';
export default function ProductDetailsScreen(){const {params}=useRoute<any>(),nav=useNavigation<any>(),id=Number(params?.id||0),{user}=useAuth();
 const {data,error,loading,refresh}=useQueryState<Product>(`/shop/products/${id}`,{publicData:true});const [qty,setQty]=useState(1),[busy,setBusy]=useState(false);
 async function add(){try{setBusy(true);await q.setCart(id,qty);Alert.alert('Cart updated','Product added to your shopping cart.');}catch(e){Alert.alert('Could not add to cart',getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title="Product details" subtitle="Server-verified pricing and availability" back>
 {error&&<ErrorBanner message={error} onRetry={()=>void refresh()}/>}{loading&&!data?<LoadingSkeleton/>:data?<Surface>
 <Text style={{fontSize:20,color:t.ink,fontWeight:'900'}}>{data.title}</Text><Text style={{fontSize:21,color:t.brand,fontWeight:'800',marginTop:8}}>{formatMoney(data.priceMinor,data.currency)}</Text>
 <LabeledValue label="Brand" value={data.brand}/><LabeledValue label="Target species" value={data.species}/><LabeledValue label="Available stock" value={data.availableQuantity}/>
 <LabeledValue label="Ingredients" value={data.ingredients}/><LabeledValue label="Allergens" value={data.allergens}/><Text style={{color:t.muted,marginVertical:10}}>{data.description}</Text>
 {user&&data.availableQuantity>0?<><Text style={{color:t.muted,marginBottom:10}}>Quantity: {qty}</Text><Button title="− Decrease" variant="outline" disabled={qty<=1} onPress={()=>setQty(n=>Math.max(1,n-1))}/>
 <Button title="+ Increase" variant="outline" disabled={qty>=Math.min(data.availableQuantity,99)} onPress={()=>setQty(n=>n+1)} style={{marginVertical:8}}/>
 <Button title="Add to cart" loading={busy} onPress={()=>void add()}/><Button title="View cart" variant="ghost" onPress={()=>nav.navigate('Cart')} style={{marginTop:8}}/></>:<Text style={{color:t.muted}}>Sign in to shop. Stock may be unavailable.</Text>}</Surface>:null}</Screen>;
}
