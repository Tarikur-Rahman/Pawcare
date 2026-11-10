import {ApiError,fromResponse,jsonOrNull} from '@/lib/api/errors';
export type ApiOptions = {method?:'GET'|'POST'|'PUT'|'PATCH'|'DELETE'; body?:unknown; idempotencyKey?:string; signal?:AbortSignal};
export async function api<T>(path:string,options:ApiOptions={}):Promise<T> {
 if(!path.startsWith('/')||path.startsWith('//')||path.includes('..'))throw new Error('Invalid API path');
 const method=options.method||'GET';
 const headers:Record<string,string>={'Accept':'application/json'};
 if(method!=='GET')headers['X-PawCare-Request']='web';
 if(options.body!==undefined)headers['Content-Type']='application/json';
 if(options.idempotencyKey)headers['Idempotency-Key']=options.idempotencyKey;
 let response:Response;
 try {response=await fetch(`/api/relay${path}`,{method,headers,body:options.body===undefined?undefined:JSON.stringify(options.body),credentials:'same-origin',cache:'no-store',signal:options.signal});}
 catch {throw new ApiError(0,'NETWORK_ERROR','Unable to connect to PawCare. Check the server connection.');}
 const result=await jsonOrNull(response);
 if(!response.ok)throw fromResponse(response.status,result);
 if(response.status===204)return undefined as T;
 const obj=(result&&typeof result==='object'?result:{}) as Record<string,unknown>;
 return (Object.prototype.hasOwnProperty.call(obj,'data')?obj.data:result) as T;
}
export async function authAction<T>(action:'login'|'register'|'logout'|'refresh'|'me'|'resend-verification'|'forgot-password'|'reset-password', body?:unknown):Promise<T> {
 const method=action==='me'?'GET':'POST';
 let response:Response;
 try {response=await fetch(`/api/auth/${action}`,{method,credentials:'same-origin',cache:'no-store',headers:method==='GET'?{}:{'Content-Type':'application/json','X-PawCare-Request':'web'},body:method==='GET'?undefined:JSON.stringify(body??{})});}
 catch {throw new ApiError(0,'NETWORK_ERROR','Unable to connect to PawCare. Check the server connection.');}
 const result=await jsonOrNull(response);
 if(!response.ok)throw fromResponse(response.status,result);
 const obj=result as Record<string,unknown>|null;
 return (obj&&Object.prototype.hasOwnProperty.call(obj,'data')?obj.data:result) as T;
}
