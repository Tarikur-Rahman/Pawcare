import {AuthForm} from '@/components/features/AuthForms';
export const metadata={title:'Login'};
type Search={next?:string|string[];message?:string|string[]};
export default async function Page({searchParams}:{searchParams:Promise<Search>}){
 const params=await searchParams;
 const nextPath=typeof params.next==='string'?params.next:undefined;
 const initialNotice=params.message==='email-verified'?'Your email is verified. You can now sign in.':undefined;
 return <AuthForm mode="login" nextPath={nextPath} initialNotice={initialNotice}/>;
}
