import React from 'react';import {createNativeStackNavigator} from '@react-navigation/native-stack';
import VetQueueScreen from '../screens/vet/VetQueueScreen';import VisitNotesScreen from '../screens/vet/VisitNotesScreen';import AccountScreen from '../screens/account/AccountScreen';
const Stack=createNativeStackNavigator();
export function VetNavigator(){return <Stack.Navigator screenOptions={{headerShown:false}}><Stack.Screen name="VetQueue" component={VetQueueScreen}/><Stack.Screen name="VisitNotes" component={VisitNotesScreen}/><Stack.Screen name="Account" component={AccountScreen}/></Stack.Navigator>}
