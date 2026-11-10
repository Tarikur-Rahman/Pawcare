import {ApiError,fromApiResponse} from './errors';
import {clearTokens,getAccessToken,getRefreshToken,storeTokens} from '../auth/secureTokens';
const url=(process.env.EXPO_PUBLIC_API_URL||'').trim().replace(/\/+$/,'');
export const API_BASE = url.endsWith('/api/v1')?url:url+'/api/v1';
export function apiConfigured(){return /^https?:\/\/[^/]+/i.test(url) && !/10\.0\.2\.2/.test(url);}
type Method='GET'|'POST'|'PUT'|'PATCH'|'DELETE';
export type RequestOptions={method?:Method;body?:unknown;authenticated?:boolean;headers?:Record<string,string>;timeoutMs?:number;retryAuth?:boolean};
let refreshRunning:Promise<boolean>|null=null;
function safePath(path:string){if(!path.startsWith('/')||path.startsWith('//')||path.includes('..')||/[\r\n]/.test(path))throw new Error('Invalid API path.'); return path;}
async function raw(path:string,opts:RequestOptions={},bearer?:string|null){
 if(!apiConfigured())throw new ApiError(0,'API_NOT_CONFIGURED','Set EXPO_PUBLIC_API_URL to your server address in mobile/.env.');
 if(!__DEV__&&!url.startsWith('https://'))throw new ApiError(0,'INSECURE_URL','Production requires an HTTPS API URL.');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),opts.timeoutMs||15000);
 try{
  const response=await fetch(API_BASE+safePath(path),{method:opts.method||'GET',headers:{Accept:'application/json',...(opts.body===undefined?{}:{'Content-Type':'application/json'}),...(bearer?{Authorization:`Bearer ${bearer}`}:{ }),...opts.headers},body:opts.body===undefined?undefined:JSON.stringify(opts.body),signal:controller.signal});
  const contentType=response.headers.get('content-type')||'';
  let result:unknown=null;
  if(contentType.includes('application/json')){try{result=await response.json();}catch{result=null;}}
  if(!response.ok)throw fromApiResponse(response.status,result);
  const envelope=result as {data?:unknown}|null;
  return (envelope&&Object.hasOwn(envelope,'data')?envelope.data:result) as unknown;
 }catch(error){
  if(error instanceof ApiError)throw error;
  if((error as Error)?.name==='AbortError')throw new ApiError(0,'TIMEOUT','The server took too long to respond.');
  throw new ApiError(0,'NETWORK_ERROR','Could not reach PawCare. Check Wi-Fi and that the API is running.');
 }finally{clearTimeout(timer);}
}
async function renew():Promise<boolean>{
 const refresh=await getRefreshToken();if(!refresh)return false;
 try{
  const output=await raw('/auth/refresh',{method:'POST',body:{refreshToken:refresh},authenticated:false});
  const r=output as {accessToken:string;refreshToken:string};
  if(!r?.accessToken||!r?.refreshToken)throw new Error('Missing tokens');
  await storeTokens(r.accessToken,r.refreshToken);return true;
 }catch{await clearTokens();return false;}
}
export async function api<T>(path:string,opts:RequestOptions={}):Promise<T>{
 const secured=opts.authenticated!==false;
 const token=secured?await getAccessToken():null;
 try{return await raw(path,opts,token) as T;}
 catch(error){
  if(secured && error instanceof ApiError&&error.status===401&&opts.retryAuth!==false){
   if(!refreshRunning)refreshRunning=renew().finally(()=>{refreshRunning=null;});
   if(await refreshRunning)return await raw(path,{...opts,retryAuth:false},await getAccessToken()) as T;
  }
  throw error;
 }
}
export const get=<T,>(p:string,authenticated=true)=>api<T>(p,{authenticated});
export const post=<T,>(p:string,body?:unknown,headers?:Record<string,string>)=>api<T>(p,{method:'POST',body,headers});
export const patch=<T,>(p:string,body:unknown)=>api<T>(p,{method:'PATCH',body});
export const put=<T,>(p:string,body:unknown)=>api<T>(p,{method:'PUT',body});
export async function uploadFile(uri:string,fileName:string,mimeType:string):Promise<unknown>{
 if(!apiConfigured())throw new ApiError(0,'API_NOT_CONFIGURED','Configure the API URL.');
 const token=await getAccessToken();if(!token)throw new ApiError(401,'UNAUTHORIZED','Please sign in.');
 const form=new FormData();form.append('file',{uri,name:fileName,type:mimeType} as unknown as Blob);
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
 try{const response=await fetch(API_BASE+'/media',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form,signal:controller.signal});
 const payload=await response.json().catch(()=>null);if(!response.ok)throw fromApiResponse(response.status,payload);
 return (payload&&typeof payload==='object'&&'data' in payload)?payload.data:payload;
 }catch(e){if(e instanceof ApiError)throw e;throw new ApiError(0,'UPLOAD_FAILED','Upload failed. Retry when your connection is stable.');}
 finally{clearTimeout(timer);}
}
