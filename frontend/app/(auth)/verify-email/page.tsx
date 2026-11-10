import Link from 'next/link';
export const metadata={title:'Email verification'};
export default async function Page({searchParams}:{searchParams:Promise<{status?:string}>}){
 const status=(await searchParams).status;
 const unavailable=status==='unavailable';
 return <div className="auth-card"><span className="eyebrow">ACCOUNT VERIFICATION</span>
 <h1>{unavailable?'Verification is temporarily unavailable':'Verification link not accepted'}</h1>
 <p>{unavailable?'We could not reach PawCare to verify your email. Try the link again later.':'The link may be invalid, expired, or already used. Request a new verification email if your account is still pending.'}</p>
 <div className="auth-links"><Link href="/resend-verification">Request a new link</Link><Link href="/login">Back to sign in</Link></div></div>;
}
