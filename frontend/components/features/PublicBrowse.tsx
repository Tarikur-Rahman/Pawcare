 'use client';
import {useMemo,useState} from 'react';
import {Search} from 'lucide-react';
import type {Row} from '@/lib/types/domain';
import {AdoptionCard} from '@/components/adoption/AdoptionCard';
import {SaleListingCard} from '@/components/marketplace/SaleListingCard';
import {LostPetCard} from '@/components/lost-found/LostPetCard';
import {ProductCard} from '@/components/shop/ProductCard';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';
export function PublicBrowse({type,title,subtitle,items,error}:{type:'adoption'|'sale'|'lost'|'food';title:string;subtitle:string;items:Row[];error:string|null}){
 const [query,setQuery]=useState('');const [species,setSpecies]=useState('ALL');
 const filtered=useMemo(()=>items.filter(item=>{const text=JSON.stringify(item).toLowerCase();return text.includes(query.toLowerCase())&&(species==='ALL'||text.includes(species.toLowerCase()));}),[items,query,species]);
 const Card=type==='adoption'?AdoptionCard:type==='sale'?SaleListingCard:type==='lost'?LostPetCard:ProductCard;
 return <div className="container browse-page"><div className="browse-heading"><div><span className="eyebrow">{type==='adoption'?'FIND A FOREVER FRIEND':type==='sale'?'RESPONSIBLE PET LISTINGS':type==='lost'?'HELP BRING THEM HOME':'EVERYDAY GOODNESS'}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="feature-orb" aria-hidden="true">{type==='food'?'🥣':type==='lost'?'🔎':type==='sale'?'🐾':'♥'}</div></div><div className="filter-bar"><label className="search-box"><Search size={19}/><span className="sr-only">Search listings</span><input placeholder="Search by name, breed, or area…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter by species" value={species} onChange={e=>setSpecies(e.target.value)}><option value="ALL">All animals</option><option value="DOG">Dogs</option><option value="CAT">Cats</option><option value="BIRD">Birds</option><option value="FISH">Fish</option></select></div><div className="results-line"><strong>{filtered.length} {type==='food'?'products':'listings'}</strong><span>Only approved public information is shown.</span></div>{error?<ErrorState message={error}/>:filtered.length?<div className="listing-grid">{filtered.map((item,i)=><Card key={String(item.id??i)} item={item}/>)}</div>:<EmptyState title="No matches found" description="Try a different keyword or species filter."/>}<aside className="safety-note"><strong>🐾 Your safety matters.</strong> Never send deposits to strangers or disclose private contact details in public comments. Report suspicious listings to PawCare.</aside></div>;
}