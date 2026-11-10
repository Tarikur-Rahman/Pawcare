import {NextRequest,NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {ACCESS_COOKIE,REFRESH_COOKIE,cookieConfig} from '@/lib/auth/session';
import {backendRequest} from '@/lib/api/server';
import {sameOriginMutation} from '@/lib/auth/csrf';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
function error(code:string,message:string,status:number){return NextResponse.json({code,message},{status,headers:{'Cache-Control':'no-store'}});}
async function proxy(request:NextRequest,context:Context){
 const {path}=await context.params;
 if(!path.length||path.length>10||path.some(p=>!/^[-a-zA-Z0-9_]+$/.test(p)))return error('INVALID_PATH','Invalid route.',400);
 const method=request.method;
 if(!['GET','POST','PUT','PATCH','DELETE'].includes(method))return error('METHOD_NOT_ALLOWED','Not allowed.',405);
 if(method!=='GET'&&!sameOriginMutation(request))return error('INVALID_REQUEST','Same-origin request required.',403);
 // Web clients never call the payment provider webhook endpoint.
 if(path[0]==='auth'||(path[0]==='payments'&&path[1]==='webhook'))return error('NOT_FOUND','Unknown route.',404);
 const query=request.nextUrl.search;
 if(query.length>2048)return error('INVALID_QUERY','Query too long.',400);
 const route='/'+path.join('/')+query;
 const jar=await cookies();let token=jar.get(ACCESS_COOKIE)?.value;
 const headers=new Headers({'Accept':'application/json'});
 const contentType=request.headers.get('content-type')||'';
 let body:Uint8Array|undefined;
 if(method!=='GET'){
   const length=Number(request.headers.get('content-length')||0);
   if(length>8*1024*1024)return error('TOO_LARGE','Request exceeds upload limit.',413);
   if(!contentType.startsWith('application/json')&&!contentType.startsWith('multipart/form-data'))return error('INVALID_CONTENT_TYPE','JSON or multipart required.',415);
   const buffer=new Uint8Array(await request.arrayBuffer());
   if(buffer.byteLength>8*1024*1024)return error('TOO_LARGE','Request exceeds upload limit.',413);
   body=buffer;headers.set('Content-Type',contentType);
   const key=request.headers.get('Idempotency-Key');if(key&&/^[A-Za-z0-9_-]{12,160}$/.test(key))headers.set('Idempotency-Key',key);
 }
 let res:Response;
 try{
   res=await backendRequest(route,{method,headers,body:body?body as unknown as BodyInit:undefined},token);
   // Attempt one server-side refresh; the refresh token never goes to browser JS.
   if(res.status===401&&jar.get(REFRESH_COOKIE)?.value){
     const previous=jar.get(REFRESH_COOKIE)!.value;
     const refresh=await backendRequest('/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:previous})});
     if(refresh.ok){const data=(await refresh.json() as {data?:{accessToken?:string;refreshToken?:string}}).data;
       if(data?.accessToken&&data.refreshToken){token=data.accessToken;
         res=await backendRequest(route,{method,headers,body:body?body as unknown as BodyInit:undefined},token);
         const result=await finish(res);
         result.cookies.set(ACCESS_COOKIE,data.accessToken,{...cookieConfig,maxAge:15*60});
         result.cookies.set(REFRESH_COOKIE,data.refreshToken,{...cookieConfig,maxAge:14*24*3600});
         return result;
       }
     }
   }
   return await finish(res);
 }catch{return error('API_UNAVAILABLE','PawCare API is unavailable.',503);}
}
async function finish(upstream:Response){
 // Avoid passing upstream Set-Cookie, Authorization, CORS, or hop-by-hop headers.
 const headers=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 const ct=upstream.headers.get('content-type');if(ct)headers.set('Content-Type',ct);
 const id=upstream.headers.get('x-request-id');if(id)headers.set('X-Request-Id',id);
 return new NextResponse(upstream.status===204||upstream.status===304?null:await upstream.arrayBuffer(),{status:upstream.status,headers});
}
export const GET=proxy;
export const POST=proxy;
export const PUT=proxy;
export const PATCH=proxy;
export const DELETE=proxy;
