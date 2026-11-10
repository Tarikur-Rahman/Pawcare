import {useEffect,useState} from 'react';
import NetInfo from '@react-native-community/netinfo';
export function useNetworkStatus(){const [online,setOnline]=useState(true);
 useEffect(()=>{const unsubscribe=NetInfo.addEventListener(s=>setOnline(s.isConnected!==false&&s.isInternetReachable!==false));return unsubscribe;},[]);
 return online;
}
