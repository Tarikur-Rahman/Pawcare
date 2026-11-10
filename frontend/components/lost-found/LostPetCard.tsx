import Link from 'next/link';
import {ArrowUpRight,MapPin} from 'lucide-react';
import type {Row} from '@/lib/types/domain';
import {field,str} from '@/lib/types/domain';
import {lostId,lostCategory,lostDate} from '@/lib/lost-found/reports';
export function LostPetCard({item}:{item:Row}){
 const id=lostId(field(item,'id','postId')),category=lostCategory(item);
 return <article className="listing-card"><div className="listing-visual listing-lost"><span aria-hidden="true">🔎</span><div className="visual-tag">Community alert</div></div>
  <div className="listing-content"><span className="eyebrow">{category==='FOUND'?'FOUND PET':category==='LOST'?'LOST PET':'PET REPORT'}</span>
   <h3>{str(item,'species')||'Species not specified'}</h3>
   <p><MapPin size={14} aria-hidden="true"/> {str(item,'generalArea')||'Approximate area unavailable'}</p>
   <p>Observed: {lostDate(str(item,'observedAt'))}</p>
   {id?<Link href={`/lost-found/${id}`} className="inline-link">View report <ArrowUpRight size={17} aria-hidden="true"/></Link>:<span className="hint">Report details unavailable</span>}
  </div></article>;
}
