import {useCallback,useEffect,useRef,useState} from 'react';
import {useIsFocused} from '@react-navigation/native';
import {api} from '../api/http';
import {getErrorMessage} from '../api/errors';
import {readPublicCache,savePublicCache} from '../storage/offlineCache';
export function useQueryState<T>(path:string,{publicData=false,cacheKey,enabled=true}:{publicData?:boolean;cacheKey?:string;enabled?:boolean}={}){
 const [data,setData]=useState<T|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),[stale,setStale]=useState(false);
 const focused=useIsFocused(),requestId=useRef(0);
 const refresh=useCallback(async()=>{
  if(!enabled)return;
  const id=++requestId.current;setLoading(true);setError(null);
  try{const result=await api<T>(path,{authenticated:!publicData});if(id!==requestId.current)return;
   setData(result);setStale(false);if(cacheKey&&publicData)await savePublicCache(cacheKey,result);
  }catch(e){if(id!==requestId.current)return;
   if(cacheKey&&publicData){const cached=await readPublicCache<T>(cacheKey);if(id!==requestId.current)return;
    if(cached){setData(cached.data);setStale(true);setError('Showing saved public results. Connect to refresh.');}
    else setError(getErrorMessage(e));
   }else setError(getErrorMessage(e));
  }finally{if(id===requestId.current)setLoading(false);}
 },[path,publicData,cacheKey,enabled]);
 useEffect(()=>{requestId.current++;setData(null);setStale(false);setError(null);
  if(focused&&enabled)void refresh();
  return ()=>{requestId.current++;};
 },[focused,enabled,refresh,path]);
 return {data,loading,error,stale,refresh};
}
