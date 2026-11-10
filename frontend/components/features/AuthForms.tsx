'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {authAction} from '@/lib/api/client';
import {postLoginDestination} from '@/lib/auth/destinations';
import {emailValid} from '@/lib/validation/forms';
import {normalizeUser,type Row} from '@/lib/types/domain';
import {FormField} from '@/components/ui/FormField';
import {Button} from '@/components/ui/Button';

type AuthFormProps={mode:'login'|'register';nextPath?:string;initialNotice?:string};

export function AuthForm({mode,nextPath,initialNotice}:AuthFormProps){
 const router=useRouter();
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [name,setName]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState(initialNotice??'');
 const [registered,setRegistered]=useState(false);

 async function submit(e:FormEvent<HTMLFormElement>){
   e.preventDefault();
   if(busy)return;
   setError('');setNotice('');
   const address=email.trim().toLowerCase();
   if(!emailValid(address)||/[^\x00-\x7f]/.test(address)){setError('Enter a valid email address.');return;}
   if(password.length<12||password.length>128){setError('Password must be 12 to 128 characters.');return;}
   if(mode==='register'){
     if(!name.trim()||name.trim().length>120){setError('Enter a name of 1 to 120 characters.');return;}
     if(confirmPassword!==password){setError('Passwords do not match.');return;}
   }
   setBusy(true);
   try {
     if(mode==='login'){
       await authAction('login',{email:address,password,deviceLabel:'PawCare Web'});
       const user=normalizeUser(await authAction<Row>('me'));
       router.replace(postLoginDestination(user.role,nextPath));
       router.refresh();
     }else{
       await authAction('register',{email:address,password,displayName:name.trim()});
       setPassword('');setConfirmPassword('');
       setRegistered(true);
       setNotice('Account created. Check your email for a verification link before signing in.');
     }
   }catch(e){setError(e instanceof Error?e.message:'Unable to continue.');}
   finally{setBusy(false);}
 }
 return <div className="auth-card">
   <span className="eyebrow">{mode==='login'?'WELCOME BACK':'JOIN THE PAWCARE FAMILY'}</span>
   <h1>{mode==='login'?'Sign in to PawCare':'Create your account'}</h1>
   <p>{mode==='login'?'Your companions and care routines are here.':'A little more care begins with a single account.'}</p>
   {notice&&<p className="success-message" role="status">{notice}</p>}
   {registered?<div className="auth-complete"><p>Verification links expire after 24 hours. If you do not receive an email, you can request another link.</p>
     <Link className="btn btn-primary btn-wide" href="/login">Go to sign in</Link>
     <Link href="/resend-verification">Resend verification email</Link>
   </div>:<form onSubmit={submit}>
     {mode==='register'&&<FormField label="Full name" name="displayName" required value={name} onChange={e=>setName(e.target.value)} maxLength={120} autoComplete="name" disabled={busy}/>}
     <FormField label="Email address" name="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} disabled={busy}/>
     <FormField label="Password" name="password" type="password" required autoComplete={mode==='login'?'current-password':'new-password'} minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/>
     {mode==='register'&&<><FormField label="Confirm password" name="confirmPassword" type="password" required autoComplete="new-password" minLength={12} maxLength={128} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} disabled={busy}/><p className="hint">Use 12 to 128 characters. You must verify your email before signing in.</p></>}
     {error&&<p className="form-alert" role="alert">{error}</p>}
     <Button className="btn-wide" loading={busy} type="submit">{mode==='login'?'Sign in':'Create account'}</Button>
   </form>}
   <div className="auth-links">
     <Link href={mode==='login'?'/register':'/login'}>{mode==='login'?'Create an account':'Already have an account? Sign in'}</Link>
     {mode==='login'&&<Link href="/resend-verification">Resend verification</Link>}
   </div>
   {mode==='login'&&<div className="auth-links"><Link href="/forgot-password">Forgot password?</Link></div>}
 </div>;
}

export function ResendVerificationForm(){
 const [email,setEmail]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [submitted,setSubmitted]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
   e.preventDefault();
   if(busy)return;
   const address=email.trim().toLowerCase();
   if(!emailValid(address)||/[^\x00-\x7f]/.test(address)){setError('Enter a valid email address.');return;}
   setError('');setBusy(true);
   try{await authAction('resend-verification',{email:address});setSubmitted(true);}
   catch(e){setError(e instanceof Error?e.message:'Unable to send the request.');}
   finally{setBusy(false);}
 }
 return <div className="auth-card"><span className="eyebrow">VERIFY YOUR EMAIL</span><h1>Resend verification</h1>
   <p>Enter the email address you used to register.</p>
   {submitted?<p role="status" className="success-message">If this account is awaiting verification, a new link will be emailed. Please check your inbox and spam folder.</p>:
   <form onSubmit={submit}>
     <FormField label="Email address" name="email" type="email" autoComplete="email" value={email} required maxLength={254} disabled={busy} onChange={e=>setEmail(e.target.value)}/>
     {error&&<p role="alert" className="form-alert">{error}</p>}
     <Button className="btn-wide" type="submit" loading={busy}>Send verification link</Button>
   </form>}
   <div className="auth-links"><Link href="/login">Back to sign in</Link></div>
 </div>;
}


export function ForgotPasswordForm(){
 const [email,setEmail]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [submitted,setSubmitted]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
   event.preventDefault();
   if(busy)return;
   const address=email.trim().toLowerCase();
   if(!emailValid(address)||/[^\x00-\x7f]/.test(address)){
     setError('Enter a valid email address.');return;
   }
   setError('');setBusy(true);
   try{await authAction('forgot-password',{email:address});setSubmitted(true);}
   catch(e){setError(e instanceof Error?e.message:'Unable to submit the request.');}
   finally{setBusy(false);}
 }
 return <div className="auth-card">
   <span className="eyebrow">ACCOUNT RECOVERY</span>
   <h1>Forgot your password?</h1>
   <p>Enter your registered email address. We will send a password reset link if the account is eligible.</p>
   {submitted?<div className="auth-complete">
     <p role="status" className="success-message">If an eligible account exists, password reset instructions will be emailed. Check your inbox and spam folder.</p>
     <p className="hint">Reset links expire in 30 minutes and can only be used once.</p>
   </div>:<form onSubmit={submit}>
     <FormField label="Email address" name="email" type="email" required autoComplete="email" maxLength={254} disabled={busy} value={email} onChange={e=>setEmail(e.target.value)}/>
     {error&&<p className="form-alert" role="alert">{error}</p>}
     <Button className="btn-wide" type="submit" loading={busy}>Send reset link</Button>
   </form>}
   <div className="auth-links"><Link href="/login">Back to sign in</Link></div>
 </div>;
}

export function ResetPasswordForm(){
 const initialized=useRef(false);
 const [ready,setReady]=useState(false);
 const [token,setToken]=useState<string|null>(null);
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [complete,setComplete]=useState(false);
 useEffect(()=>{
   if(initialized.current)return;
   initialized.current=true;
   // The token arrives in the URL fragment, never in the HTTP request to Next.js.
   const value=new URLSearchParams(window.location.hash.slice(1)).get('token');
   window.history.replaceState(window.history.state,'',window.location.pathname);
   setToken(value&&/^[A-Za-z0-9_-]{64}$/.test(value)?value:null);
   setReady(true);
 },[]);
 async function submit(event:FormEvent<HTMLFormElement>){
   event.preventDefault();
   if(busy||!token)return;
   setError('');
   if(password.length<12||password.length>128){setError('Password must be 12 to 128 characters.');return;}
   if(password!==confirmPassword){setError('Passwords do not match.');return;}
   setBusy(true);
   try{
     await authAction('reset-password',{token,newPassword:password});
     setComplete(true);setToken(null);setPassword('');setConfirmPassword('');
   }catch(e){setError(e instanceof Error?e.message:'This link could not be used. Request a new link.');}
   finally{setBusy(false);}
 }
 return <div className="auth-card">
   <span className="eyebrow">SECURE PASSWORD RESET</span>
   <h1>Choose a new password</h1>
   {!ready?<p role="status">Checking your reset link...</p>:
    complete?<div className="auth-complete"><p role="status" className="success-message">Your password was updated. You can sign in with your new password.</p><Link className="btn btn-primary btn-wide" href="/login">Go to sign in</Link></div>:
    !token?<div className="auth-complete"><p role="alert" className="form-alert">Your reset link is missing or invalid. Request a new password reset email.</p><Link href="/forgot-password">Request a new link</Link></div>:
    <form onSubmit={submit}>
      <p>Use a new password of 12 to 128 characters. This link expires 30 minutes after issuance.</p>
      <FormField label="New password" name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/>
      <FormField label="Confirm new password" name="confirmNewPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} disabled={busy} onChange={e=>setConfirmPassword(e.target.value)}/>
      {error&&<p role="alert" className="form-alert">{error}</p>}
      <Button className="btn-wide" type="submit" loading={busy}>Set new password</Button>
    </form>}
   <div className="auth-links"><Link href="/login">Back to sign in</Link></div>
 </div>;
}
