import Link from 'next/link';
import {notFound} from 'next/navigation';
import {safePublic} from '@/lib/api/server';
import {field,str,type Row} from '@/lib/types/domain';
import {formatMoney} from '@/lib/utils/currency';
import {marketId,marketCurrency,marketPrice,marketDate} from '@/lib/marketplace/listings';
import {FavoriteButton} from '@/components/features/FavoriteButton';
import {ReportListing} from '@/components/features/ReportListing';
import {InquiryPanel} from '@/components/marketplace/InquiryPanel';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id:raw}=await params;
 const id=marketId(raw);
 if(!id||id!==raw)notFound();
 const {data,error}=await safePublic(`/marketplace/pets/${id}`);
 if(!data&&!error)notFound();
 const item=(data??{}) as Row;
 const price=marketPrice(item),currency=marketCurrency(item);
 return <div className="container detail-page"><div className="breadcrumbs"><Link href="/">Home</Link> / <Link href="/marketplace">Marketplace</Link> / Listing #{id}</div>
  <div className="detail-grid"><div className="detail-main"><div className="detail-art"><span aria-hidden="true">🐾</span></div>
   <span className="eyebrow">APPROVED PET LISTING · INQUIRY ONLY</span>
   <h1 className="detail-title">{str(item,'title')||`Listing #${id}`}</h1>
   {error?<p role="alert" className="form-alert">{error}</p>:<>
    <p className="detail-body">{str(item,'description')||'Description has not been provided.'}</p>
    <div className="panel"><h2>Listing details</h2><p>Species: {str(item,'species')||'Not specified'}</p>
     <p>General area: {str(item,'generalArea')||'Not disclosed'}</p>
     <p>Asking amount: {price!==null&&currency?formatMoney(price,currency):'Unavailable'}</p>
     <p>Published: {marketDate(str(item,'postedAt'))}</p>
     <p className="hint">Listing ID: {marketId(field(item,'id'))||id}. This amount is informational; no payment or animal sale is completed through PawCare.</p></div>
    <FavoriteButton entityType="PET_SALE" entityId={id}/><ReportListing entityType="PET_SALE" entityId={id}/></>}</div>
   <aside className="detail-side"><div className="panel"><h2>Ask a responsible question</h2>
    <p className="hint">Your inquiry is visible only to authorized participants. Final sale payment, animal shipping and transfer are disabled.</p>
    {error?<Link href="/marketplace" className="btn btn-secondary">Back to listings</Link>:<InquiryPanel id={id}/>}
    <p className="disclaimer">You must <Link href="/login">sign in</Link> to send an inquiry.</p></div></aside>
  </div></div>;
}
