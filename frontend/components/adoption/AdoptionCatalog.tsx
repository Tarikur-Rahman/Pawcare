'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Search} from 'lucide-react';
import type {Row} from '@/lib/types/domain';
import {adoptionSpecies,filterAdoptions} from '@/lib/adoption/records';
import {AdoptionCard} from '@/components/adoption/AdoptionCard';
import {ErrorState} from '@/components/ui/ErrorState';
import {EmptyState} from '@/components/ui/EmptyState';

export function AdoptionCatalog({items,error}:{items:Row[];error:string|null}){
 const [search,setSearch]=useState(''),[species,setSpecies]=useState('ALL');
 const speciesOptions=useMemo(()=>Array.from(new Set(items.map(adoptionSpecies).filter(Boolean))).sort(),[items]);
 const visible=useMemo(()=>filterAdoptions(items,search,species),[items,search,species]);
 return <section className="container browse-page">
  <div className="browse-heading"><div><span className="eyebrow">FIND A FOREVER FRIEND</span><h1>Adopt a companion</h1>
   <p>Explore published adoption listings. Applying does not transfer ownership; every handover requires review and confirmation by both parties.</p>
   <Link className="inline-link" href="/my-adoptions">Manage your adoption listings</Link></div>
   <div className="feature-orb" aria-hidden="true">♥</div></div>
  <div className="filter-bar"><label className="search-box"><Search size={19} aria-hidden="true"/><span className="sr-only">Search adoption listings</span>
   <input aria-label="Search adoption listings" placeholder="Search by title, species, story or area" type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <select aria-label="Filter by species" value={species} onChange={e=>setSpecies(e.target.value)}><option value="ALL">All animals</option>
    {speciesOptions.map(option=><option value={option} key={option}>{option.charAt(0)+option.slice(1).toLowerCase()}</option>)}</select></div>
  {!error&&<div className="results-line"><strong>{visible.length} published {visible.length===1?'listing':'listings'}</strong><span>Only approved public information is shown.</span></div>}
  {error?<ErrorState message={error}/>
   :items.length===0?<EmptyState title="No published adoption listings" description="Approved adoption listings will appear here when available."/>
   :visible.length===0?<EmptyState title="No matching adoption listings" description="Try a different keyword or species."/>
   :<div className="listing-grid">{visible.map(item=><AdoptionCard key={String(item.id)} item={item}/>)}</div>}
  <aside className="safety-note"><strong>Responsible adoption</strong> Meet safely, discuss care requirements, and never share private contact details in public posts. Both parties must confirm the final handover.</aside>
 </section>;
}
