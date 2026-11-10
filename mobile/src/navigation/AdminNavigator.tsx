import React from 'react';import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';import ModerationScreen from '../screens/admin/ModerationScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';import InventoryAdminScreen from '../screens/admin/InventoryAdminScreen';import StoreSalesScreen from '../screens/admin/StoreSalesScreen';import AccountScreen from '../screens/account/AccountScreen';
const Stack=createNativeStackNavigator();
export function AdminNavigator(){return <Stack.Navigator screenOptions={{headerShown:false}}>
<Stack.Screen name="AdminHome" component={AdminDashboardScreen}/><Stack.Screen name="Moderation" component={ModerationScreen}/><Stack.Screen name="AdminUsers" component={AdminUsersScreen}/>
<Stack.Screen name="InventoryAdmin" component={InventoryAdminScreen}/><Stack.Screen name="StoreSales" component={StoreSalesScreen}/><Stack.Screen name="Account" component={AccountScreen}/>
</Stack.Navigator>}
