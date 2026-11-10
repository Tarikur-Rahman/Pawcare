import Link from 'next/link';
import {notFound} from 'next/navigation';
import {safePublic} from '@/lib/api/server';
import {field,str,type Row} from '@/lib/types/domain';
import {lostCategory,lostDate,lostId} from '@/lib/lost-found/reports';
import {FavoriteButton} from '@/components/features/FavoriteButton';
import {ReportListing} from '@/components/features/ReportListing';
import {SightingForm} from '@/components/lost-found/SightingForm';
import {ReunionClaimForm} from '@/components/lost-found/ReunionClaimForm';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id:raw}=await params;
 const id=lostId(raw);
 if(!id||id!==raw)notFound();
 const {data,error}=await safePublic(`/lost-found/${id}`);
 if(!data&&!error)notFound();
 const item=(data??{}) as Row;
 const category=lostCategory(item);
 return <div className="container detail-page"><div className="breadcrumbs"><Link href="/">Home</Link> / <Link href="/lost-found">Lost &amp; found</Link> / Report #{id}</div>
  <div className="detail-grid"><div className="detail-main"><div className="detail-art"><span aria-hidden="true">🔎</span></div>
   <span className="eyebrow">{category==='FOUND'?'FOUND PET':category==='LOST'?'LOST PET':'LOST & FOUND'}</span>
   <h1 className="detail-title">{str(item,'species')||'Pet report'}</h1>
   {error?<p className="form-alert" role="alert">{error}</p>:<>
    <div className="panel"><h2>Public report details</h2>
     <p>Report ID: {lostId(field(item,'id'))||id}</p>
     <p>Approximate area: {str(item,'generalArea')||'Not specified'}</p>
     <p>Observed: {lostDate(str(item,'observedAt'))}</p></div>
    <p className="hint">Description and private evidence are not part of the public report response. Do not share precise locations or personal details here.</p>
    <FavoriteButton entityType="LOST_FOUND" entityId={id}/><ReportListing entityType="LOST_FOUND" entityId={id}/>
   </>}</div>
   <aside className="detail-side"><div className="panel"><h2>Help safely</h2>
    <p className="hint">Sightings are sent privately. Only the report owner can view them. Ownership claims require private evidence and moderator verification.</p>
    {error?<Link href="/lost-found" className="btn btn-secondary">Back to reports</Link>:<><SightingForm id={id}/><ReunionClaimForm id={id}/></>}
    <p className="disclaimer">You must <Link href="/login">sign in</Link> to send a sighting or claim.</p></div></aside>
  </div></div>;
}
