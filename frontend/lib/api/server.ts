import 'server-only';
import {cookies} from 'next/headers';
import {ApiError,fromResponse,jsonOrNull} from './errors';
// The base URL is server-only and never exposed in client bundles.
export function backendBase():string {
 const base=(process.env.PAWCARE_API_URL||'http://127.0.0.1:5080').replace(/\/$/,'');
 const parsed=new URL(base);
 if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash)throw new Error('Unsafe backend URL');
 if(process.env.NODE_ENV==='production'&&parsed.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(parsed.hostname))throw new Error('Production backend requires HTTPS');
 return base;
}
export async function backendRequest(path:string, init:RequestInit={},token?:string):Promise<Response>{
 if(!/^\/(?:[a-z0-9-]+\/?)+$/i.test(path.split('?')[0])||path.includes('..')||path.startsWith('//'))throw new Error('Invalid upstream route');
 const headers=new Headers(init.headers);
 if(token)headers.set('Authorization',`Bearer ${token}`);
 return fetch(`${backendBase()}/api/v1${path}`,{...init,headers,cache:'no-store',signal:init.signal??AbortSignal.timeout(12000)});
}
export async function serverApi(path:string,authenticated=false):Promise<unknown>{
 const token=authenticated?(await cookies()).get('pawcare_access')?.value:undefined;
 if(authenticated&&!token)throw new ApiError(401,'AUTH_REQUIRED','Please sign in.');
 let response:Response;
 try{response=await backendRequest(path,{},token);}catch{throw new ApiError(503,'API_UNAVAILABLE','PawCare is temporarily unavailable.');}
 const payload=await jsonOrNull(response);
 if(!response.ok)throw fromResponse(response.status,payload);
 const envelope=payload as Record<string,unknown>|null;
 return envelope&&'data'in envelope?envelope.data:payload;
}
export async function safePublic(path:string):Promise<{data:unknown;error:string|null}>{
 try{return {data:await serverApi(path),error:null};}catch(e){return {data:null,error:e instanceof Error?e.message:'Unable to load data.'};}
}
