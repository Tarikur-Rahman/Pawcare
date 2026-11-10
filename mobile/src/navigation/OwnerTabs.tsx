import React from 'react';import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/home/DashboardScreen';import PetsScreen from '../screens/pets/PetsScreen';import ExploreScreen from '../screens/explore/ExploreScreen';
import CareScreen from '../screens/care/CareScreen';import AccountScreen from '../screens/account/AccountScreen';import {t} from '../lib/theme/tokens';
import {Text} from 'react-native';
const Tab=createBottomTabNavigator();
export function OwnerTabs(){return <Tab.Navigator screenOptions={({route})=>({headerShown:false,tabBarActiveTintColor:t.brand,tabBarInactiveTintColor:t.muted,tabBarLabelStyle:{fontSize:10,fontWeight:'700'},tabBarStyle:{height:64,paddingTop:7,paddingBottom:7,borderTopColor:t.border,backgroundColor:t.paper},tabBarIcon:({focused})=><Text style={{fontSize:21,opacity:focused?1:0.65}}>{({Home:'🏠',Pets:'🐾',Explore:'🔎',Care:'💚',Account:'👤'} as Record<string,string>)[route.name]}</Text>})}>
<Tab.Screen name="Home" component={DashboardScreen}/><Tab.Screen name="Pets" component={PetsScreen}/><Tab.Screen name="Explore" component={ExploreScreen}/><Tab.Screen name="Care" component={CareScreen}/><Tab.Screen name="Account" component={AccountScreen}/>
</Tab.Navigator>}
