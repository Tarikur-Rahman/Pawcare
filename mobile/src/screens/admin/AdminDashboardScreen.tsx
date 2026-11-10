import React from 'react';import {Text} from 'react-native';import {useNavigation} from '@react-navigation/native';
import {Screen,Surface} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';
import {ResourceList} from '../shared/ResourceList';import {useQueryState} from '../../lib/hooks/useQueryState';
import {t} from '../../lib/theme/tokens';
export default function AdminDashboardScreen(){const nav=useNavigation<any>();const {data}=useQueryState<Record<string,unknown>[]>('/admin/users');
 return <Screen title="Admin console" subtitle="Manage users and review community safety.">
 <Surface><Text style={{fontSize:27,fontWeight:'900',color:t.brand}}>{data?.length??'—'}</Text><Text style={{color:t.muted}}>Registered users visible to admin</Text></Surface>
 <Button title="Review moderation queue" onPress={()=>nav.navigate('Moderation')}/>
 <Button title="Inventory adjustments" variant="outline" onPress={()=>nav.navigate('InventoryAdmin')}/>
 <Button title="Store sales summary" variant="outline" onPress={()=>nav.navigate('StoreSales')}/>
 <Button title="View users" variant="outline" onPress={()=>nav.navigate('AdminUsers')}/>
 </Screen>;
}
