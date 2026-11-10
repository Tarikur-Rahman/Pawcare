import 'react-native-gesture-handler';
import React from 'react';
import {Text,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/lib/auth/AuthContext';
import {RootNavigator} from './src/navigation/RootNavigator';
import {useNetworkStatus} from './src/lib/hooks/useNetworkStatus';
function MobileApp(){const online=useNetworkStatus();return <View style={{flex:1}}>
 {!online&&<View accessibilityRole="alert" style={{backgroundColor:'#FFF1DE',padding:8,alignItems:'center'}}><Text style={{color:'#945019',fontSize:12,fontWeight:'700'}}>Offline · public cached lists may be outdated</Text></View>}
 <RootNavigator/></View>;}
export default function App(){return <SafeAreaProvider><AuthProvider><StatusBar style="dark"/><MobileApp/></AuthProvider></SafeAreaProvider>;}
