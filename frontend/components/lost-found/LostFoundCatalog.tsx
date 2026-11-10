'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Search} from 'lucide-react';
import type {Row} from '@/lib/types/domain';
import {lostCategory,lostSpecies,filterLostReports} from '@/lib/lost-found/reports';
import {LostPetCard} from './LostPetCard';
import {ErrorState} from '@/components/ui/ErrorState';
import {EmptyState} from '@/components/ui/EmptyState';

export function LostFoundCatalog({items,error}:{items:Row[];error:string|null}){
 const [search,setSearch]=useState(''),[category,setCategory]=useState('ALL'),[species,setSpecies]=useState('ALL');
 const speciesOptions=useMemo(()=>Array.from(new Set(items.map(lostSpecies).filter(Boolean))).sort(),[items]);
 const visible=useMemo(()=>filterLostReports(items,search,category,species),[items,search,category,species]);
 return <section className="container browse-page">
  <div className="browse-heading"><div><span className="eyebrow">PAWCARE COMMUNITY ALERTS</span><h1>Lost &amp; found pets</h1>
   <p>Search published community reports and share private sightings to help reunite pets safely.</p>
   <Link href="/my-reports" className="inline-link">Create or manage a report</Link></div><div className="feature-orb" aria-hidden="true">🔎</div></div>
  <div className="filter-bar"><label className="search-box"><Search size={19} aria-hidden="true"/>
   <span className="sr-only">Search lost and found reports</span><input type="search" aria-label="Search lost and found reports" placeholder="Search by species, area or report ID" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <select aria-label="Filter by report type" value={category} onChange={e=>setCategory(e.target.value)}>
    <option value="ALL">Lost and found</option><option value="LOST">Lost pets</option><option value="FOUND">Found pets</option></select>
   <select aria-label="Filter by species" value={species} onChange={e=>setSpecies(e.target.value)}>
    <option value="ALL">All species</option>{speciesOptions.map(s=><option key={s} value={s}>{s.charAt(0)+s.slice(1).toLowerCase()}</option>)}</select></div>
  {!error&&<div className="results-line"><strong>{visible.length} open {visible.length===1?'report':'reports'}</strong>
   <span>Only approved public information is displayed.</span></div>}
  {error?<ErrorState message={error}/>:items.length===0?<EmptyState title="No open public reports" description="Published lost and found reports will appear here."/>
   :visible.length===0?<EmptyState title="No matching reports" description="Try another species, category or area."/>
   :<div className="listing-grid">{visible.map((item,index)=><LostPetCard key={String(item.id??index)} item={item}/>)}</div>}
  <aside className="safety-note"><strong>Safety first</strong> Exact addresses, reporter identities, private sightings and ownership evidence are not shown publicly. Meet in a safe place and verify any ownership claim through PawCare moderation.</aside>
 </section>;
}
