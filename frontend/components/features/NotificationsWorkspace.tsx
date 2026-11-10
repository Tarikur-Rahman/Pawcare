'use client';

import {useEffect,useMemo,useState} from 'react';
import {Bell,Check,RefreshCw,Search} from 'lucide-react';
import {api} from '@/lib/api/client';
import {rows,str,type Row} from '@/lib/types/domain';
import {filterNotifications,isUnread,notificationId,notificationSummary,notificationTime,type NotificationFilter} from '@/lib/notifications/records';
import {Button} from '@/components/ui/Button';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';

const FILTERS:{value:NotificationFilter;label:string}[]=[
 {value:'ALL',label:'All'},{value:'UNREAD',label:'Unread'},{value:'READ',label:'Read'},
];

export function NotificationsWorkspace(){
 const [items,setItems]=useState<Row[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [actionError,setActionError]=useState('');
 const [notice,setNotice]=useState('');
 const [refresh,setRefresh]=useState(0);
 const [filter,setFilter]=useState<NotificationFilter>('ALL');
 const [search,setSearch]=useState('');
 const [busyId,setBusyId]=useState('');

 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  api('/notifications',{signal:controller.signal}).then(data=>{
   if(!controller.signal.aborted)setItems(rows(data));
  }).catch(caught=>{
   if(!controller.signal.aborted)setError(caught instanceof Error?caught.message:'Unable to load notifications.');
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[refresh]);

 const summary=notificationSummary(items);
 const visible=useMemo(()=>filterNotifications(items,filter,search),[items,filter,search]);
 async function markRead(id:string){
  if(busyId||!/^[1-9]\d*$/.test(id)||!items.some(item=>notificationId(item)===id&&isUnread(item)))return;
  setBusyId(id);setActionError('');setNotice('');
  try{
   await api(`/notifications/${id}/read`,{method:'POST'});
   // The read state changes only after the backend confirms success (204).
   setItems(current=>current.map(item=>notificationId(item)===id?{...item,readAt:new Date().toISOString()}:item));
   setNotice('Notification marked as read.');
  }catch(caught){setActionError(caught instanceof Error?caught.message:'Unable to mark notification as read.');}
  finally{setBusyId('');}
 }

 return <section className="page-section">
  <div className="page-heading"><div><span className="eyebrow">STAY CONNECTED</span><h1>Notifications</h1>
   <p>Review care reminders and important updates. Latest 100 notifications are shown.</p></div>
   <Button type="button" variant="secondary" disabled={loading||!!busyId} onClick={()=>{setNotice('');setRefresh(n=>n+1);}}><RefreshCw size={16} aria-hidden="true"/>Refresh</Button>
  </div>
  <div className="notification-stats" aria-label="Notification summary">
   <div><strong>{summary.total}</strong><span>Recent</span></div>
   <div><strong>{summary.unread}</strong><span>Unread</span></div>
   <div><strong>{summary.read}</strong><span>Read</span></div>
  </div>
  <div className="panel notification-panel">
   <div className="notification-toolbar"><div className="medical-filters" aria-label="Filter notifications">
    {FILTERS.map(option=><button key={option.value} type="button" className={`medical-filter${filter===option.value?' selected':''}`} aria-pressed={filter===option.value} onClick={()=>setFilter(option.value)}>{option.label}</button>)}
   </div><label className="notification-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Search notifications</span>
    <input className="form-input" type="search" aria-label="Search notifications" placeholder="Search updates" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
   {notice&&<p className="success-message notification-notice" role="status">{notice}</p>}
   {actionError&&<ErrorState message={actionError} onRetry={()=>setActionError('')}/>}
   {error&&<ErrorState message={error} onRetry={()=>setRefresh(n=>n+1)}/>}
   {loading?<p role="status" className="hint">Loading notifications…</p>
    :error?null
    :!items.length?<EmptyState title="All caught up" description="Care reminders and other updates will appear here when available."/>
    :!visible.length?<EmptyState title="No matching notifications" description="Try another status or search term."/>
    :<ul className="notification-list">{visible.map((item,index)=>{
     const id=notificationId(item);const unread=isUnread(item);
     return <li key={id||`notification-${index}`} className={`notification-row${unread?' notification-unread':''}`}>
      <div className="notification-icon" aria-hidden="true">{unread?<Bell size={19}/>:<Check size={19}/>}</div>
      <div className="notification-content"><div className="notification-title"><strong>{str(item,'title')||'PawCare update'}</strong><span>{unread?'Unread':'Read'}</span></div>
       <p>{str(item,'body','message')||'No additional details provided.'}</p>
       <small>{notificationTime(str(item,'createdAt'))}{str(item,'kind')?` · ${str(item,'kind').replaceAll('_',' ')}`:''}</small>
      </div>
      {unread&&id&&<Button type="button" className="btn-small" variant="secondary" loading={busyId===id} disabled={!!busyId} onClick={()=>void markRead(id)}>Mark read</Button>}
     </li>;
    })}</ul>}
  </div>
 </section>;
}
