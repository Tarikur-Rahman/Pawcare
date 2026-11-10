import {useCallback,useState} from 'react';
import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
export function useNotifications(){
 const [permission,setPermission]=useState<'granted'|'denied'|'undetermined'>('undetermined');
 const requestPermission=useCallback(async()=>{
  const status=await Notifications.requestPermissionsAsync();setPermission(status.granted?'granted':'denied');
  if(status.granted && Platform.OS==='android')await Notifications.setNotificationChannelAsync('care',{name:'Care reminders',importance:Notifications.AndroidImportance.DEFAULT});
  return status.granted;
 },[]);
 // Remote push requires an EAS development build, device token API and explicit user opt-in.
 return {permission,requestPermission};
}
