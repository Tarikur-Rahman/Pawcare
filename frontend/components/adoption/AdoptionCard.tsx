import Link from 'next/link';
import {MapPin,ArrowUpRight} from 'lucide-react';
import type {Row} from '@/lib/types/domain';
import {str} from '@/lib/types/domain';
import {publicAdoptionId} from '@/lib/adoption/records';

export function AdoptionCard({item}:{item:Row}){
 const id=publicAdoptionId(item),species=str(item,'species').trim().toUpperCase();
 return <article className="listing-card"><div className="listing-visual listing-adoption"><span aria-hidden="true">{species==='CAT'?'🐱':species==='BIRD'?'🐦':species==='FISH'?'🐟':'🐶'}</span>
  <div className="visual-tag">Looking for home</div></div><div className="listing-content"><span className="eyebrow">ADOPTION {species?`· ${species}`:''}</span>
  <h3>{str(item,'title')||'Companion available for adoption'}</h3><p><MapPin size={14} aria-hidden="true"/> {str(item,'generalArea')||'Location withheld'}</p>
  {id?<Link href={`/adopt/${id}`} className="inline-link">Meet this pet <ArrowUpRight size={17} aria-hidden="true"/></Link>
   :<span className="hint">Listing details unavailable</span>}</div></article>;
}
