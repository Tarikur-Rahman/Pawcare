import React from 'react';import {Text,View} from 'react-native';import {useNavigation} from '@react-navigation/native';
import {Screen,Surface,LabeledValue} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';import {useAuth} from '../../lib/auth/AuthContext';import {t} from '../../lib/theme/tokens';
export default function AccountScreen(){const nav=useNavigation<any>(),{user,logout}=useAuth();return <Screen title="My account" subtitle="Your PawCare preferences and records.">
 <Surface><Text style={{fontSize:21,fontWeight:'800',color:t.ink}}>{user?.displayName}</Text><LabeledValue label="Email" value={user?.email}/><LabeledValue label="Role" value={user?.role}/><LabeledValue label="Status" value={user?.status}/></Surface>
 <Button title="Edit profile" onPress={()=>nav.navigate('EditProfile')}/><Button title="Shipping addresses" variant="outline" onPress={()=>nav.navigate('Addresses')}/>
 <Button title="Settings" variant="outline" onPress={()=>nav.navigate('Settings')}/>
 <Button title="My adoptions" variant="outline" onPress={()=>nav.navigate('MyApplications')}/>
 <Button title="My listings" variant="outline" onPress={()=>nav.navigate('MySaleListings')}/>
 <Button title="My orders" variant="outline" onPress={()=>nav.navigate('Orders')}/>
 <Button title="Sign out" variant="danger" onPress={()=>void logout()}/></Screen>;
}
