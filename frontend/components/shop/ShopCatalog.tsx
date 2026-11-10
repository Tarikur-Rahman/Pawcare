'use client';

import {useMemo,useState} from 'react';
import {Search,ShoppingCart} from 'lucide-react';
import Link from 'next/link';
import {type Row,str,field} from '@/lib/types/domain';
import {filterCatalog,positiveId,speciesOptions,type SortMode} from '@/lib/shop/catalog';
import {ProductCard} from '@/components/shop/ProductCard';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';

export function ShopCatalog({products,categories,productError,categoryError}:{products:Row[];categories:Row[];productError:string|null;categoryError:string|null}){
 const [query,setQuery]=useState(''),[species,setSpecies]=useState('ALL'),[category,setCategory]=useState('ALL');
 const [stock,setStock]=useState<'ALL'|'AVAILABLE'>('ALL'),[sort,setSort]=useState<SortMode>('NEWEST');
 const availableSpecies=useMemo(()=>speciesOptions(products),[products]);
 const visible=useMemo(()=>filterCatalog(products,{query,species,category,stock,sort}),[products,query,species,category,stock,sort]);
 return <section className="container browse-page shop-page">
  <div className="browse-heading"><div><span className="eyebrow">EVERYDAY PET NUTRITION</span>
   <h1>Food & treats</h1><p>Browse active PawCare products, compare prices and check availability before adding to your cart.</p></div>
   <div className="feature-orb" aria-hidden="true">🥣</div></div>
  <div className="shop-header-actions"><Link href="/cart" className="btn btn-secondary"><ShoppingCart size={16} aria-hidden="true"/> View cart</Link></div>
  {productError?<ErrorState message={productError}/>:<>
   <div className="shop-filter-bar">
    <label className="shop-search"><Search size={17} aria-hidden="true"/><span className="sr-only">Search products</span>
     <input className="form-input" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search food, brands or species" aria-label="Search products"/></label>
    <label className="shop-filter-field">Species<select className="form-input" aria-label="Filter products by species" value={species} onChange={e=>setSpecies(e.target.value)}><option value="ALL">All species</option>{availableSpecies.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
    {!categoryError&&categories.length>0&&<label className="shop-filter-field">Category<select className="form-input" aria-label="Filter products by category" value={category} onChange={e=>setCategory(e.target.value)}><option value="ALL">All categories</option>{categories.map(row=>{const id=positiveId(field(row,'id'));return id?<option key={id} value={id}>{str(row,'name')||`Category ${id}`}</option>:null;})}</select></label>}
    <label className="shop-filter-field">Availability<select className="form-input" aria-label="Filter products by availability" value={stock} onChange={e=>setStock(e.target.value as 'ALL'|'AVAILABLE')}><option value="ALL">All stock levels</option><option value="AVAILABLE">Exclude sold out</option></select></label>
    <label className="shop-filter-field">Sort<select className="form-input" aria-label="Sort products" value={sort} onChange={e=>setSort(e.target.value as SortMode)}><option value="NEWEST">Newest first</option><option value="NAME">Name A–Z</option><option value="PRICE_ASC">Price low to high</option><option value="PRICE_DESC">Price high to low</option></select></label>
   </div>
   {categoryError&&<p className="shop-info" role="status">Categories are unavailable; you can still browse products.</p>}
   <div className="results-line"><strong>{visible.length} of {products.length} products</strong><span>Showing up to 100 recent active products from PawCare.</span></div>
   {visible.length?<div className="listing-grid">{visible.map(p=><ProductCard key={positiveId(field(p,'id'))} item={p}/>)}</div>
    :products.length===0?<EmptyState title="No products available" description="The store has no active products at the moment."/>
    :<EmptyState title="No matching products" description="Try a different search, category, or stock filter."/>}
  </>}
 </section>;
}
