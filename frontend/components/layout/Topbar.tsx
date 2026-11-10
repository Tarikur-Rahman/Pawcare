 'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Menu,X,ArrowUpRight} from 'lucide-react';
import {useState} from 'react';
const links=[['/adopt','Adopt'],['/marketplace','Marketplace'],['/lost-found','Lost & found'],['/shop','Food store']];
export function Topbar(){const path=usePathname();const [open,setOpen]=useState(false);return <header className="public-header"><nav className="container nav-content" aria-label="Main navigation"><Link href="/" className="brand"><span className="brand-icon">🐾</span> PawCare<span className="brand-dot">.</span></Link><div className={`nav-links ${open?'nav-open':''}`}>{links.map(([href,text])=><Link key={href} href={href} onClick={()=>setOpen(false)} aria-current={path.startsWith(href)?'page':undefined}>{text}</Link>)}</div><div className="nav-actions"><Link className="nav-login" href="/login">Sign in</Link><Link className="btn btn-primary btn-small" href="/register">Get started <ArrowUpRight size={16}/></Link></div><button className="mobile-menu" aria-label={open?'Close menu':'Open menu'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></nav></header>;}