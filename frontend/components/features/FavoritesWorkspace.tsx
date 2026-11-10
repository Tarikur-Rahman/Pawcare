'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api/client';
import {field,rows,str,type Row} from '@/lib/types/domain';
import {contentError,contentId,favoriteLabel,favoriteLink,filterFavorites,FAVORITE_TYPES} from '@/lib/content/moderation';
import {ErrorState} from '@/components/ui/ErrorState';
import {EmptyState} from '@/components/ui/EmptyState';

export function FavoritesWorkspace(){
 const [items,setItems]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [refresh,setRefresh]=useState(0),[query,setQuery]=useState(''),[type,setType]=useState('ALL');
 const [confirmId,setConfirmId]=useState(''),[removing,setRemoving]=useState(''),[actionError,setActionError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');setConfirmId('');setActionError('');
  api('/favorites',{signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setItems(rows(result));})
   .catch(e=>{if(!controller.signal.aborted){setItems([]);setError(contentError(e,'Unable to load your favorites.'));}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[refresh]);
 const visible=useMemo(()=>filterFavorites(items,query,type),[items,query,type]);
 async function remove(){
  const id=contentId(confirmId);if(!id||removing)return;
  setRemoving(id);setActionError('');
  try {await api(`/favorites/${id}`,{method:'DELETE'});
   setItems(current=>current.filter(item=>contentId(field(item,'id','favoriteId'))!==id));setConfirmId('');
  }catch(e){setActionError(contentError(e,'Unable to remove this favorite.'));}
  finally{setRemoving('');}
 }
 return <section className="page-section"><div className="page-heading"><div>
  <span className="eyebrow">SAVED FOR LATER</span><h1>Your favorites</h1><p>Revisit approved adoption, marketplace, lost &amp; found and food listings.</p>
 </div><button type="button" className="btn btn-secondary" disabled={loading||!!removing} onClick={()=>setRefresh(n=>n+1)}>Refresh favorites</button></div>
 <div className="filter-bar"><input className="form-input" type="search" aria-label="Search saved favorites" value={query} placeholder="Search type or record ID" onChange={e=>setQuery(e.target.value)}/>
  <select aria-label="Filter saved favorites by type" value={type} onChange={e=>setType(e.target.value)}>
   <option value="ALL">All listing types</option>{FAVORITE_TYPES.map(t=><option key={t} value={t}>{favoriteLabel({entityType:t})}</option>)}</select></div>
 {actionError&&<p role="alert" className="form-alert">{actionError}</p>}
 {loading?<p role="status">Loading your favorites…</p>:error?<ErrorState message={error} onRetry={()=>setRefresh(n=>n+1)}/>
  :items.length===0?<EmptyState title="No saved favorites yet" description="Open a published listing and choose Save listing." href="/adopt" action="Explore adoptions"/>
  :visible.length===0?<EmptyState title="No matching favorites" description="Try another listing type or ID."/>
  :<div className="marketplace-inquiry-list">{visible.map(item=>{
   const id=contentId(field(item,'id','favoriteId')),link=favoriteLink(item);
   return <div className="moderation-row" key={id}><div><strong>{favoriteLabel(item)} · #{str(item,'entityId')}</strong><p className="hint">Saved record #{id}</p></div>
    <div className="action-buttons"><Link className="btn btn-secondary" href={link}>View listing</Link>
     {confirmId===id?<div><p className="hint">Remove this saved item?</p>
      <button className="btn btn-secondary" type="button" disabled={!!removing} onClick={()=>setConfirmId('')}>Keep</button>
      <button className="btn btn-danger" type="button" disabled={!!removing} onClick={()=>void remove()}>{removing===id?'Removing…':'Confirm removal'}</button></div>
      :<button className="btn btn-secondary" type="button" disabled={!!removing} onClick={()=>{setConfirmId(id);setActionError('');}}>Remove favorite</button>}
    </div></div>;})}</div>}
 </section>;
}
