import React,{useState,useEffect} from 'react';import {Text,Switch,Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';import {Screen,Surface} from '../../components/ui/Screen';
import {useNotifications} from '../../lib/hooks/useNotifications';import {t} from '../../lib/theme/tokens';
const KEY='pawcare_notification_preference_v1';
export default function ReminderSettingsScreen(){const [enabled,setEnabled]=useState(false),{permission,requestPermission}=useNotifications();
 useEffect(()=>{void AsyncStorage.getItem(KEY).then(v=>setEnabled(v==='true')).catch(()=>{});},[]);
 async function change(v:boolean){if(v&&!(await requestPermission())){Alert.alert('Permission denied','Enable notifications in device settings.');return;}setEnabled(v);await AsyncStorage.setItem(KEY,String(v));}
 return <Screen title="Reminder settings" subtitle="Control local notification consent." back><Surface>
 <Text style={{fontWeight:'800',color:t.ink,fontSize:16}}>Allow local alerts</Text>
 <Switch value={enabled} onValueChange={v=>void change(v)} trackColor={{true:t.brand,false:'#D5DFDB'}} style={{alignSelf:'flex-start'}}/>
 <Text style={{color:t.muted,fontSize:13,lineHeight:20}}>Preference saved on this device. Server-side reminder delivery and remote push-token registration are not yet connected. Permission: {permission}.</Text>
 </Surface></Screen>;
}
