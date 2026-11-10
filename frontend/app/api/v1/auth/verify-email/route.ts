import {NextRequest,NextResponse} from 'next/server';
import {backendRequest} from '@/lib/api/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/** Optional web-facing target for the backend's Email:VerificationUrlBase. */
export async function GET(request:NextRequest){
 const token=request.nextUrl.searchParams.get('token');
 let target='/verify-email?status=invalid';
 if(token && token.length>=40 && token.length<=128 && /^[A-Za-z0-9_-]+$/.test(token)){
   try {
     const result=await backendRequest('/auth/verify-email',{
       method:'POST',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({token}),
     });
     if(result.ok)target='/login?message=email-verified';
     else if(result.status>=500)target='/verify-email?status=unavailable';
   }catch{target='/verify-email?status=unavailable';}
 }
 const response=NextResponse.redirect(new URL(target,request.url),303);
 response.headers.set('Cache-Control','no-store');
 response.headers.set('Referrer-Policy','no-referrer');
 return response;
}
