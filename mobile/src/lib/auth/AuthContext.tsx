import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {api} from '../api/http';
import {ApiError} from '../api/errors';
import {getAccessToken,getRefreshToken,storeTokens,clearTokens} from './secureTokens';
import {Account,normalizeAccount} from '../models/domain';
type Ctx={user:Account|null;loading:boolean;login:(email:string,password:string)=>Promise<void>;
 register:(email:string,password:string,displayName:string)=>Promise<string>;
 logout:()=>Promise<void>;refreshProfile:()=>Promise<void>};
const Context=createContext<Ctx|null>(null);
export function AuthProvider({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<Account|null>(null),[loading,setLoading]=useState(true);
 async function refreshProfile(){const response=await api<unknown>('/auth/me');setUser(normalizeAccount(response));}
 useEffect(()=>{let mounted=true;(async()=>{
  try{const token=await getAccessToken();if(token){const account=await api<unknown>('/auth/me');if(mounted)setUser(normalizeAccount(account));}}
  catch(e){if(e instanceof ApiError&&e.status===401)await clearTokens();}
  finally{if(mounted)setLoading(false);}
 })();return ()=>{mounted=false;};},[]);
 async function login(email:string,password:string){
  const result=await api<{accessToken:string;refreshToken:string}>('/auth/login',{method:'POST',body:{email,password,deviceLabel:'PawCare mobile'},authenticated:false});
  await storeTokens(result.accessToken,result.refreshToken);
  try{await refreshProfile();}catch(e){await clearTokens();setUser(null);throw e;}
 }
 async function register(email:string,password:string,displayName:string){
  const reply=await api<{message?:string}>('/auth/register',{method:'POST',body:{email,password,displayName},authenticated:false});
  return reply.message||'Account created. Verification is required before login.';
 }
 async function logout(){const refreshToken=await getRefreshToken();try{
  if(refreshToken)await api('/auth/logout',{method:'POST',body:{refreshToken}});
 }catch{/* clear locally regardless of offline/server failure */}finally{await clearTokens();setUser(null);}}
 const ctx=useMemo(()=>({user,loading,login,register,logout,refreshProfile}),[user,loading]);
 return <Context.Provider value={ctx}>{children}</Context.Provider>;
}
export function useAuth(){const v=useContext(Context);if(!v)throw new Error('AuthProvider is missing');return v;}
