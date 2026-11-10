'use client';
import {useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api/client';
import {field,rows,str,type Row} from '@/lib/types/domain';
import {formatCareTime} from '@/lib/care/tasks';
import {Button} from '@/components/ui/Button';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';

/** Read-only view of delivered in-app CARE_REMINDER notifications, not queue internals. */
export function CareReminderPanel(){
 const [items,setItems]=useState<Row[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function load(){
  if(busy)return;
  setBusy(true);setError('');
  try{
   const all=rows(await api('/notifications'));
   setItems(all.filter(item=>str(item,'kind').toUpperCase()==='CARE_REMINDER').slice(0,5));
   setLoaded(true);
  }catch(caught){setError(caught instanceof Error?caught.message:'Unable to load reminders.');}
  finally{setBusy(false);}
 }
 const unread=items.filter(item=>!field(item,'readAt')).length;
 return <div className="panel care-reminders-panel">
  <div className="medical-section-header"><div><span className="eyebrow">IN-APP REMINDERS</span><h2>Recent care reminders</h2><p>Delivered notifications, not scheduled or queued jobs. Recent results may be limited to your 100 latest notifications.</p></div>
    <Button variant="secondary" onClick={()=>void load()} disabled={busy}>{busy?'Loading':'Load reminders'}</Button>
  </div>
  {error&&<ErrorState message={error} onRetry={()=>void load()}/>}
  {loaded&&!error&&<><p className="hint">{unread} unread in the {items.length} most recent care reminders shown.</p>
   {!items.length?<EmptyState title="No recent care reminders" description="Reminders will appear after the reminder and outbox workers create notifications."/>
    :<ul className="care-reminder-list">{items.map((item,index)=><li key={str(item,'id')||index}>
       <div><strong>{str(item,'title')||'Pet care reminder'}</strong><p>{str(item,'body')}</p><small>{formatCareTime(str(item,'createdAt'))}</small></div>
       <span className={field(item,'readAt')?'badge badge-gray':'badge badge-amber'}>{field(item,'readAt')?'Read':'Unread'}</span>
      </li>)}</ul>}
  </>}
  <Link className="inline-link" href="/notifications">Open all notifications</Link>
 </div>;
}
