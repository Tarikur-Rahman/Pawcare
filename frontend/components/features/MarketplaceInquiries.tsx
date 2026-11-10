'use client';
import {useEffect,useMemo,useState} from 'react';
import {api} from '@/lib/api/client';
import {field,rows,str,type Row} from '@/lib/types/domain';
import {filterInquiries,marketDate,marketError,marketId} from '@/lib/marketplace/listings';
import {ErrorState} from '@/components/ui/ErrorState';
import {EmptyState} from '@/components/ui/EmptyState';

export function MarketplaceInquiries(){
 const [items,setItems]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const [query,setQuery]=useState(''),[status,setStatus]=useState('ALL');
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');setItems([]);
  api('/marketplace/inquiries',{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setItems(rows(value));})
   .catch(caught=>{if(!controller.signal.aborted)setError(marketError(caught,'Unable to load private inquiries.'));})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const statuses=useMemo(()=>[...new Set(items.map(item=>str(item,'status').trim().toUpperCase()).filter(Boolean))].sort(),[items]);
 const visible=useMemo(()=>filterInquiries(items,query,status),[items,query,status]);
 return <div className="panel marketplace-inquiries"><h2>My private marketplace inquiries</h2>
  <p className="hint">The backend returns only inquiries you sent or received on your listings. Inquiries do not represent a sale, payment or agreed ownership transfer.</p>
  <div className="filter-bar"><label className="search-box"><span className="sr-only">Search private inquiries</span><input type="search" aria-label="Search private inquiries" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search message or listing ID"/></label>
   <select aria-label="Filter inquiries by status" value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All statuses</option>
    {statuses.map(s=><option value={s} key={s}>{s}</option>)}</select>
   <button type="button" className="btn btn-secondary" disabled={loading} onClick={()=>setReload(n=>n+1)}>Refresh inquiries</button></div>
  {loading?<p role="status">Loading private inquiries…</p>:error?<ErrorState message={error} onRetry={()=>setReload(n=>n+1)}/>
   :items.length===0?<EmptyState title="No private inquiries yet" description="Sent and received inquiries will appear here."/>
   :visible.length===0?<EmptyState title="No matching inquiries" description="Try a different message or status."/>
   :<div className="marketplace-inquiry-list">{visible.map((item,index)=>{
    const inquiryId=marketId(field(item,'id','inquiryId')),listingId=marketId(field(item,'listingId'));
    return <div className="moderation-row" key={inquiryId||`inquiry-${index}`}><div>
     <strong>Inquiry #{inquiryId||'Unavailable'} · Listing #{listingId||'Unavailable'}</strong>
     <p>{str(item,'message')||'No message available.'}</p>
     <p className="hint">{str(item,'status')||'Status unavailable'} · {marketDate(str(item,'createdAt'))}</p></div>
    </div>;})}</div>}
 </div>;
}
