import {NextRequest,NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {ACCESS_COOKIE,REFRESH_COOKIE,cookieConfig} from '@/lib/auth/session';
import {backendRequest} from '@/lib/api/server';
import {sameOriginMutation} from '@/lib/auth/csrf';
import {jsonOrNull} from '@/lib/api/errors';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{action:string}>};
const permitted=['login','register','refresh','logout','me','resend-verification','forgot-password','reset-password'];
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});}
function clearCookies(reply:NextResponse){reply.cookies.set(ACCESS_COOKIE,'',{...cookieConfig,maxAge:0});reply.cookies.set(REFRESH_COOKIE,'',{...cookieConfig,maxAge:0});}
function setTokens(reply:NextResponse,data:Record<string,unknown>){
 if(typeof data.accessToken!=='string'||typeof data.refreshToken!=='string')return false;
 reply.cookies.set(ACCESS_COOKIE,data.accessToken,{...cookieConfig,maxAge:15*60});
 reply.cookies.set(REFRESH_COOKIE,data.refreshToken,{...cookieConfig,maxAge:14*24*3600});
 return true;
}
async function upstream(path:string,body:unknown,token?:string){
 return backendRequest(`/auth/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},token);
}
export async function GET(req:NextRequest,context:Context){
 const {action}=await context.params;
 if(action!=='me')return response({code:'NOT_FOUND',message:'Unknown action.'},404);
 const token=(await cookies()).get(ACCESS_COOKIE)?.value;
 if(!token)return response({code:'AUTH_REQUIRED',message:'Sign in required.'},401);
 try{const res=await backendRequest('/auth/me',{},token);return response(await jsonOrNull(res),res.status);}catch{return response({code:'API_UNAVAILABLE',message:'The API is unavailable.'},503);}
}
export async function POST(req:NextRequest,context:Context){
 const {action}=await context.params;
 if(!permitted.includes(action)||action==='me')return response({code:'NOT_FOUND',message:'Unknown action.'},404);
 if(!sameOriginMutation(req))return response({code:'INVALID_REQUEST',message:'Same-origin request required.'},403);
 const jar=await cookies();
 if(action==='logout'){
   try{const refresh=jar.get(REFRESH_COOKIE)?.value,access=jar.get(ACCESS_COOKIE)?.value;
     if(refresh&&access)await upstream('logout',{refreshToken:refresh},access);
   }catch{/* Client cookies are cleared even if the API cannot be reached. */}
   const out=response({data:{signedOut:true}});clearCookies(out);return out;
 }
 if(action==='refresh'){
   const refresh=jar.get(REFRESH_COOKIE)?.value;
   if(!refresh)return response({code:'AUTH_REQUIRED',message:'No refresh session.'},401);
   try{const res=await upstream('refresh',{refreshToken:refresh});const payload=await jsonOrNull(res);
     if(!res.ok){const out=response(payload??{code:'AUTH_REQUIRED'},res.status);clearCookies(out);return out;}
     const data=((payload as Record<string,unknown>)?.data??{}) as Record<string,unknown>;
     const out=response({data:{refreshed:true}});if(!setTokens(out,data))return response({code:'INVALID_SESSION'},502);return out;
   }catch{return response({code:'API_UNAVAILABLE',message:'The API is unavailable.'},503);}
 }
 let body:unknown;
 try{const raw=await req.text();if(raw.length>16000)return response({code:'TOO_LARGE'},413);body=JSON.parse(raw||'{}');}
 catch{return response({code:'INVALID_JSON',message:'Invalid request body.'},400);}
 try{
   const res=await upstream(action,body);
   const payload=await jsonOrNull(res);
   if(!res.ok)return response(payload??{code:'REQUEST_FAILED'},res.status);
   if(action==='login'){
     const data=((payload as Record<string,unknown>)?.data??{}) as Record<string,unknown>;
     const out=response({data:{authenticated:true}},res.status);
     if(!setTokens(out,data))return response({code:'INVALID_AUTH_RESPONSE',message:'Unable to establish session.'},502);
     return out;
   }
   return response(payload,res.status);
 }catch{return response({code:'API_UNAVAILABLE',message:'Unable to reach PawCare API.'},503);}
}
