import React,{useState} from 'react';import {Alert,Text,View} from 'react-native';import {Screen,Surface} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';
import {Input} from '../../components/ui/Input';import {ErrorBanner} from '../../components/ui/ErrorBanner';import {EmptyState} from '../../components/ui/EmptyState';
import {useQueryState} from '../../lib/hooks/useQueryState';import {Pet} from '../../lib/models/domain';import {post} from '../../lib/api/http';import {getErrorMessage} from '../../lib/api/errors';
import {formatMoney,toMinorUnits} from '../../lib/utils/money';import {t} from '../../lib/theme/tokens';
type Expense={id:number;category:string;description?:string;amountMinor:number;currency:string;occurredAt:string};
export default function ExpensesScreen(){const pets=useQueryState<Pet[]>('/pets'),[petId,setPetId]=useState<number|null>(null),expenses=useQueryState<Expense[]>(petId?`/pets/${petId}/expenses`:'/pets/0/expenses',{enabled:!!petId});
 const [amount,setAmount]=useState(''),[category,setCategory]=useState('FOOD'),[description,setDescription]=useState(''),[busy,setBusy]=useState(false);
 async function save(){if(!petId)return;try{setBusy(true);await post(`/pets/${petId}/expenses`,{amountMinor:toMinorUnits(amount),currency:'BDT',category:category.toUpperCase(),occurredAt:new Date().toISOString(),description});setAmount('');await expenses.refresh();Alert.alert('Saved','Expense recorded.');}
 catch(e){Alert.alert('Unable to save',getErrorMessage(e));}finally{setBusy(false);}}
 return <Screen title="Expenses" subtitle="Track every pet-care cost." onRefresh={()=>void expenses.refresh()} refreshing={expenses.loading}>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(pets.data||[]).map(p=><Button key={p.id} title={p.name} variant={petId===p.id?'primary':'outline'} onPress={()=>setPetId(p.id)}/>)}</View>
 {!petId?<EmptyState message="Choose a pet to see its expenses."/>:<>
 <Surface><Text style={{fontWeight:'800',color:t.ink,fontSize:17,marginBottom:12}}>Add expense</Text>
 <Input label="Amount (BDT)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad"/><Input label="Category" value={category} onChangeText={setCategory} placeholder="FOOD"/>
 <Input label="Description" value={description} onChangeText={setDescription}/><Button title="Save expense" loading={busy} onPress={()=>void save()}/></Surface>
 {expenses.error&&<ErrorBanner message={expenses.error} onRetry={()=>void expenses.refresh()}/>}
 {!expenses.data?.length?<EmptyState message="No expenses recorded yet."/>:expenses.data.map(x=><Surface key={x.id}><Text style={{fontWeight:'800',color:t.ink}}>{x.category}</Text><Text style={{color:t.brand,marginTop:6}}>{formatMoney(x.amountMinor,x.currency)}</Text><Text style={{color:t.muted}}>{x.description}</Text></Surface>)}
 </>}</Screen>;
}
