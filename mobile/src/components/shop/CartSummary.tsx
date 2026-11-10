import React from 'react';import {View,Text} from 'react-native';import {CartLine} from '../../lib/models/domain';import {formatMoney} from '../../lib/utils/money';import {t} from '../../lib/theme/tokens';
export function CartSummary({items}:{items:CartLine[]}){
 const currency=items[0]?.currency||'BDT',mixed=items.some(x=>x.currency!==currency),total=items.reduce((a,x)=>a+x.priceMinor*x.quantity,0);
 return <View style={{padding:17,backgroundColor:t.tint,borderRadius:15,gap:7}}><Text style={{fontWeight:'800',color:t.ink}}>Order summary</Text>
 <Text style={{color:t.muted}}>{items.length} product lines</Text><Text style={{fontWeight:'800',fontSize:23,color:t.brand}}>{mixed?'Multiple currencies — cannot checkout':formatMoney(total,currency)}</Text>
 <Text style={{color:t.muted,fontSize:12}}>Prices and stock are checked again by the server at checkout.</Text></View>;
}
