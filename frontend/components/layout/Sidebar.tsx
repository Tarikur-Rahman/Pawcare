'use client';
import {useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {LayoutDashboard,PawPrint,ClipboardList,CalendarDays,Wallet,HeartHandshake,Store,Search,ShoppingCart,Package,Bookmark,Bell,UserRound,ShieldCheck,Users,CheckCircle2,ChartBar,Boxes,HeartPulse,LogOut} from 'lucide-react';
import {authAction} from '@/lib/api/client';
import type {Role} from '@/lib/types/domain';
const icons={dashboard:LayoutDashboard,pets:PawPrint,care:ClipboardList,appointments:CalendarDays,expenses:Wallet,'my-adoptions':HeartHandshake,'my-listings':Store,'my-reports':Search,cart:ShoppingCart,orders:Package,favorites:Bookmark,notifications:Bell,profile:UserRound,vet:HeartPulse,admin:ShieldCheck,users:Users,moderation:ShieldCheck,verification:CheckCircle2,catalog:Store,inventory:Boxes,reports:ChartBar};
const owner=[['/dashboard','Overview','dashboard'],['/pets','My pets','pets'],['/care','Care & routines','care'],['/appointments','Appointments','appointments'],['/expenses','Expenses','expenses'],['/my-adoptions','Adoptions','my-adoptions'],['/my-listings','My listings','my-listings'],['/my-reports','Lost & found reports','my-reports'],['/cart','Cart','cart'],['/orders','Orders','orders'],['/favorites','Saved','favorites'],['/notifications','Notifications','notifications'],['/profile','Profile','profile']];
const vet=[['/vet','Overview','vet'],['/vet/appointments','Appointments','appointments']];
const admin=[['/admin','Overview','admin'],['/admin/users','Users','users'],['/admin/moderation','Moderation','moderation'],['/admin/verification','Verification','verification'],['/admin/catalog','Food catalog','catalog'],['/admin/inventory','Inventory','inventory'],['/admin/orders','Orders','orders'],['/admin/reports','Reports','reports']];
export function Sidebar({role,onNavigate}:{role:Role;onNavigate?:()=>void}){
 const current=usePathname();
 const [signingOut,setSigningOut]=useState(false);
 const [signOutError,setSignOutError]=useState('');
 const links=role==='ADMIN'?admin:role==='VET'?vet:owner;
 async function signOut(){
   if(signingOut)return;
   setSignOutError('');setSigningOut(true);
   try{
     await authAction('logout');
     window.location.assign('/login');
   }catch{setSignOutError('Could not end your session. Please try again.');setSigningOut(false);}
 }
 return <aside className="sidebar"><Link href="/" className="brand sidebar-brand" onClick={onNavigate}><span className="brand-icon">🐾</span> PawCare<span className="brand-dot">.</span></Link><div className="sidebar-label">{role==='ADMIN'?'ADMIN CENTER':role==='VET'?'VETERINARY SPACE':'YOUR SPACE'}</div><nav aria-label="Workspace navigation" className="sidebar-links">{links.map(([href,label,key])=>{const Icon=icons[key as keyof typeof icons]||PawPrint;const active=current===href||(href!=='/vet'&&href!=='/admin'&&href!=='/dashboard'&&current.startsWith(href+'/'));return <Link key={href} onClick={onNavigate} href={href} className={active?'sidebar-link active':'sidebar-link'} aria-current={active?'page':undefined}><Icon size={18}/><span>{label}</span></Link>;})}</nav><div className="sidebar-bottom"><Link href="/" className="sidebar-link"><PawPrint size={18}/> Explore PawCare</Link><button className="sidebar-link logout" type="button" onClick={signOut} disabled={signingOut}><LogOut size={18}/> {signingOut?'Signing out…':'Sign out'}</button>{signOutError&&<p role="alert" className="sidebar-error">{signOutError}</p>}</div></aside>;
}
