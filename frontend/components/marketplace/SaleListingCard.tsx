import Link from 'next/link';
import type {Row} from '@/lib/types/domain';
import {str,field} from '@/lib/types/domain';
import {formatMoney} from '@/lib/utils/currency';
import {marketId,marketPrice,marketCurrency,marketSpecies} from '@/lib/marketplace/listings';
import {ArrowUpRight,MapPin} from 'lucide-react';
export function SaleListingCard({item}:{item:Row}){
 const id=marketId(field(item,'id','listingId'));
 if(!id)return null;
 const amount=marketPrice(item),currency=marketCurrency(item);
 return <article className="listing-card"><div className="listing-visual listing-sale"><span aria-hidden="true">🐾</span><div className="visual-tag">Approved · Inquiry only</div></div>
  <div className="listing-content"><span className="eyebrow">PET MARKETPLACE · {marketSpecies(item)||'COMPANION'}</span>
   <h3>{str(item,'title')||`Listing #${id}`}</h3><p><MapPin size={14} aria-hidden="true"/> {str(item,'generalArea')||'General area only'}</p>
   <strong>{amount===null||!currency?'Price unavailable':formatMoney(amount,currency)}</strong>
   <Link href={`/marketplace/${id}`} className="inline-link">View listing <ArrowUpRight size={17} aria-hidden="true"/></Link></div></article>;
}
