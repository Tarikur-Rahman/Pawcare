'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Search} from 'lucide-react';
import type {Row} from '@/lib/types/domain';
import {filterMarket,marketSpecies} from '@/lib/marketplace/listings';
import {SaleListingCard} from './SaleListingCard';
import {ErrorState} from '@/components/ui/ErrorState';
import {EmptyState} from '@/components/ui/EmptyState';

export function MarketplaceCatalog({items,error}:{items:Row[];error:string|null}){
 const [query,setQuery]=useState(''),[species,setSpecies]=useState('ALL'),[sort,setSort]=useState<'NEWEST'|'PRICE_ASC'|'PRICE_DESC'>('NEWEST');
 const options=useMemo(()=>[...new Set(items.map(marketSpecies).filter(Boolean))].sort(),[items]);
 const visible=useMemo(()=>filterMarket(items,query,species,sort),[items,query,species,sort]);
 return <section className="container browse-page">
  <div className="browse-heading"><div><span className="eyebrow">REVIEWED COMMUNITY LISTINGS</span><h1>Pet marketplace</h1>
   <p>Discover published pet listings and send responsible private inquiries. Live-animal checkout, payment and transfers are not available.</p>
   <Link href="/my-listings" className="inline-link">Seller drafts &amp; private inquiries</Link></div><div className="feature-orb" aria-hidden="true">🐾</div></div>
  <div className="filter-bar"><label className="search-box"><Search size={19} aria-hidden="true"/><span className="sr-only">Search pet listings</span>
   <input type="search" aria-label="Search pet listings" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Species, area, description or listing ID"/></label>
   <select aria-label="Filter by species" value={species} onChange={e=>setSpecies(e.target.value)}><option value="ALL">All species</option>
    {options.map(s=><option value={s} key={s}>{s.charAt(0)+s.slice(1).toLowerCase()}</option>)}</select>
   <select aria-label="Sort listings" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}>
    <option value="NEWEST">Newest first (server order)</option><option value="PRICE_ASC">Price: low to high per currency</option><option value="PRICE_DESC">Price: high to low per currency</option></select></div>
  {!error&&<div className="results-line"><strong>{visible.length} approved {visible.length===1?'listing':'listings'}</strong>
   <span>Price sorting groups different currencies; values are not converted.</span></div>}
  {error?<ErrorState message={error}/>:items.length===0?<EmptyState title="No approved marketplace listings" description="Listings appear only after seller verification and moderator approval."/>
   :visible.length===0?<EmptyState title="No matching pet listings" description="Try a different species or search term."/>
   :<div className="listing-grid">{visible.map(item=><SaleListingCard item={item} key={String(item.id)}/>)}</div>}
  <aside className="safety-note"><strong>Animal welfare first</strong> Only a currently approved seller may create a draft; reviewers check welfare evidence before publication. Never send money or arrange animal shipment through PawCare.</aside>
 </section>;
}
