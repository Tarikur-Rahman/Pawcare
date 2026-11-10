import 'server-only';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {serverApi} from '@/lib/api/server';
import {normalizeUser,type Role,type User} from '@/lib/types/domain';
import {roleHome} from './permissions';
export const ACCESS_COOKIE='pawcare_access';
export const REFRESH_COOKIE='pawcare_refresh';
export const cookieConfig={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/'};
export async function accessToken(){return (await cookies()).get(ACCESS_COOKIE)?.value;}
export async function getCurrentUser():Promise<User|null>{
 if(!await accessToken())return null;
 try{return normalizeUser(await serverApi('/auth/me',true));}catch{return null;}
}
export async function requireRole(roles:Role[]):Promise<User>{
 if(!await accessToken())redirect(`/login?next=${encodeURIComponent(roleHome[roles[0]])}`);
 const user=await getCurrentUser();
 if(!user)redirect('/login?message=session-expired');
 if(user.status && user.status!=='ACTIVE')redirect('/login?message=account-unavailable');
 if(!roles.includes(user.role))redirect(user.role==='ADMIN'?'/admin':user.role==='VET'?'/vet':'/dashboard');
 return user;
}
