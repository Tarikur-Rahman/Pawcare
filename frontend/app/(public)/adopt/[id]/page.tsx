import Link from 'next/link';
import {notFound} from 'next/navigation';
import {safePublic} from '@/lib/api/server';
import {str,type Row} from '@/lib/types/domain';
import {adoptionId} from '@/lib/adoption/records';
import {FavoriteButton} from '@/components/features/FavoriteButton';
import {ReportListing} from '@/components/features/ReportListing';
import {ApplicationForm} from '@/components/adoption/ApplicationForm';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id:id}=await params;
 if(!adoptionId(id))notFound();
 const {data,error}=await safePublic('/adoptions/'+id);
 if(!data&&!error)notFound();
 const item=(data||{}) as Row;
 return <div className="container detail-page"><div className="breadcrumbs"><Link href="/">Home</Link> / <Link href="/adopt">Adoption information</Link> / Details</div><div className="detail-grid"><div className="detail-main"><div className="detail-art"><span>🏡</span></div><span className="eyebrow">Adoption information</span><h1 className="detail-title">{str(item,'title','species')||'Adoption information'}</h1>{error?<p role="alert" className="form-alert">{error}</p>:<><p className="detail-body">{str(item,'description')||'Further information has not been supplied.'}</p><div className="panel"><h2>At a glance</h2><p>Area: {str(item,'generalArea')||'Not publicly disclosed'}</p><p>Species: {str(item,'species')||'Not specified'}</p></div><FavoriteButton entityType="ADOPTION" entityId={id}/><ReportListing entityType="ADOPTION" entityId={id}/></>}</div><aside className="detail-side"><div className="panel"><h2>Make a difference</h2><p className="hint">Read the pet’s story, then submit an adoption application. Approval and handover are separate steps.</p>{error?<Link href="/adopt" className="btn btn-secondary">Back to listings</Link>:<ApplicationForm id={id}/>}<p className="disclaimer">For actions that require an account, please <Link href="/login">sign in</Link> first.</p></div></aside></div></div>;
}
