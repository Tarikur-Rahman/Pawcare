'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {CalendarClock,RefreshCw,Search} from 'lucide-react';
import {api} from '@/lib/api/client';
import {rows,str,type Row} from '@/lib/types/domain';
import {careIndicator,careSummary,careTaskId,filterCareTasks,formatCareTime,type CareFilter} from '@/lib/care/tasks';
import {CareTaskForm} from '@/components/care/CareTaskForm';
import {CareReminderPanel} from '@/components/care/CareReminderPanel';
import {Button} from '@/components/ui/Button';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';
import {StatusBadge} from '@/components/ui/StatusBadge';

const FILTERS:{value:CareFilter;label:string}[]=[
 {value:'ALL',label:'All'}, {value:'PENDING',label:'Pending'}, {value:'OVERDUE',label:'Overdue'},
 {value:'COMPLETED',label:'Completed'}, {value:'CANCELLED',label:'Cancelled'},
];

export function CareWorkspace(){
 const [pets,setPets]=useState<Row[]>([]);
 const [petId,setPetId]=useState('');
 const [petsLoading,setPetsLoading]=useState(true);
 const [petsError,setPetsError]=useState('');
 const [petsRefresh,setPetsRefresh]=useState(0);
 const [tasks,setTasks]=useState<Row[]>([]);
 const [tasksLoading,setTasksLoading]=useState(false);
 const [tasksError,setTasksError]=useState('');
 const [refresh,setRefresh]=useState(0);
 const [notice,setNotice]=useState('');
 const [filter,setFilter]=useState<CareFilter>('PENDING');
 const [search,setSearch]=useState('');
 const [busyTaskId,setBusyTaskId]=useState('');
 const [cancelId,setCancelId]=useState('');

 useEffect(()=>{
  const controller=new AbortController();
  setPetsLoading(true);
  api('/pets',{signal:controller.signal}).then(result=>{
   if(controller.signal.aborted)return;
   const active=rows(result).filter(p=>(str(p,'status')||'ACTIVE').toUpperCase()==='ACTIVE');
   setPets(active);setPetsError('');
   const requested=new URLSearchParams(window.location.search).get('petId');
   setPetId(current=>active.some(p=>str(p,'id')===current)?current:str(active.find(p=>str(p,'id')===requested),'id')||str(active[0],'id'));
  }).catch(error=>{if(!controller.signal.aborted)setPetsError(error instanceof Error?error.message:'Unable to load your pets.');})
   .finally(()=>{if(!controller.signal.aborted)setPetsLoading(false);});
  return ()=>controller.abort();
 },[petsRefresh]);

 useEffect(()=>{
  if(!petId){setTasks([]);setTasksError('');setTasksLoading(false);return;}
  const controller=new AbortController();
  setTasksLoading(true);setTasksError('');setTasks([]);
  api(`/pets/${petId}/tasks`,{signal:controller.signal}).then(result=>{
   if(!controller.signal.aborted){setTasks(rows(result));setTasksError('');}
  }).catch(error=>{
   if(!controller.signal.aborted)setTasksError(error instanceof Error?error.message:'Unable to load care tasks.');
  }).finally(()=>{if(!controller.signal.aborted)setTasksLoading(false);});
  return ()=>controller.abort();
 },[petId,refresh]);

 const now=new Date();
 const summary=careSummary(tasks,now);
 const visible=filterCareTasks(tasks,filter,search,now);
 const selected=pets.find(p=>str(p,'id')===petId);
 function updated(message:string){setNotice(message);setCancelId('');setRefresh(n=>n+1);}
 async function runAction(id:string,kind:'complete'|'cancel'){
  if(busyTaskId||!id)return;
  setNotice('');setTasksError('');setBusyTaskId(id);
  try{
   await api(`/tasks/${id}/${kind}`,{method:'POST'});
   updated(kind==='complete'?'Task completed.':'Task cancelled.');
  }catch(error){setTasksError(error instanceof Error?error.message:`Unable to ${kind} the task.`);}
  finally{setBusyTaskId('');}
 }
 return <section className="page-section">
  <div className="page-heading"><div><span className="eyebrow">ROUTINES & REMINDERS</span><h1>Care & routines</h1><p>Schedule care, track what is due, and record completed tasks for your pets.</p></div>
   <Link href="/notifications" className="btn btn-secondary">View notifications</Link>
  </div>
  <div className="panel care-pet-picker">
   <div><h2>Choose a companion</h2><p className="hint">Tasks are private to the pet owner and stored in PawCare.</p></div>
   <div className="care-pet-controls"><label className="form-field" htmlFor="care-pet-id">Pet
    <select id="care-pet-id" className="form-input" value={petId} disabled={petsLoading||busyTaskId!==''} onChange={e=>{setPetId(e.target.value);setNotice('');setCancelId('');setFilter('PENDING');}}>
     {!pets.length&&<option value="">{petsLoading?'Loading pets…':'No active pets'}</option>}
     {pets.map(p=><option key={str(p,'id')} value={str(p,'id')}>{str(p,'name')}</option>)}
    </select></label>
    <Button variant="secondary" onClick={()=>setPetsRefresh(n=>n+1)} disabled={petsLoading}><RefreshCw size={16} aria-hidden="true"/>{petsLoading?'Loading':'Refresh pets'}</Button>
   </div>
  </div>
  {petsError&&<ErrorState message={petsError} onRetry={()=>setPetsRefresh(n=>n+1)}/>}
  {petsLoading&&<p role="status" className="hint">Loading your companions…</p>}
  {!petsLoading&&!petsError&&!pets.length&&<EmptyState title="Add a pet first" description="You need an active pet profile to create care tasks." href="/pets" action="Add a pet"/>}
  {selected&&<>
   {notice&&<p className="success-message care-notice" role="status">{notice}</p>}
   <div className="care-stats" aria-label="Care task overview">
    <div><strong>{summary.pending}</strong><span>Pending</span></div>
    <div><strong>{summary.overdue}</strong><span>Overdue</span></div>
    <div><strong>{summary.dueSoon}</strong><span>Due in 24 hours</span></div>
    <div><strong>{summary.completed}</strong><span>Completed</span></div>
   </div>
   <div className="dashboard-lower care-layout"><div className="panel care-tasks-panel">
    <div className="medical-section-header"><div><h2>{str(selected,'name')}'s care tasks</h2><p>Up to 200 latest tasks, with upcoming tasks shown first.</p></div>
     <Button variant="secondary" disabled={tasksLoading} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/>{tasksLoading?'Loading':'Refresh tasks'}</Button>
    </div>
    {tasksError&&<ErrorState message={tasksError} onRetry={()=>setRefresh(n=>n+1)}/>}
    <div className="care-toolbar"><div className="medical-filters" aria-label="Filter care tasks">
     {FILTERS.map(item=><button key={item.value} type="button" className={`medical-filter${filter===item.value?' selected':''}`} aria-pressed={filter===item.value} onClick={()=>setFilter(item.value)}>{item.label}</button>)}
    </div><label className="care-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Search care tasks</span><input className="form-input" type="search" aria-label="Search care tasks" placeholder="Search tasks" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    {tasksLoading?<p className="hint" role="status">Loading scheduled tasks…</p>
     :tasksError&&!tasks.length?null
     :!tasks.length?<EmptyState title="No care tasks yet" description="Use the form to schedule your pet's first care task."/>
     :!visible.length?<EmptyState title="No matching tasks" description="Try another status or search term."/>
     :<ul className="care-task-list">{visible.map((task,index)=>{
      const id=careTaskId(task);const status=str(task,'status').toUpperCase();const indicator=careIndicator(task,now);
      return <li key={id||`unknown-${index}`} className="care-task-row"><div className="care-task-main"><div className="care-task-title"><strong>{str(task,'title')}</strong>
        {indicator==='OVERDUE'?<span className="care-overdue">Overdue</span>:indicator==='DUE_SOON'?<span className="care-due-soon">Due soon</span>:<StatusBadge status={status}/>}</div>
       <p><CalendarClock size={15} aria-hidden="true"/> {formatCareTime(str(task,'dueAt'))}</p>
       <p>{str(task,'type').replaceAll('_',' ').toLowerCase()} · {str(task,'recurrenceRule')?`Repeats ${str(task,'recurrenceRule').toLowerCase()}`:'One-time task'}</p></div>
       {status==='PENDING'&&id&&<div className="care-task-actions">
        <Button variant="secondary" className="btn-small" disabled={!!busyTaskId} loading={busyTaskId===id} onClick={()=>void runAction(id,'complete')}>Mark complete</Button>
        {cancelId===id?<div className="care-cancel-confirm"><span>Cancel this task?</span><Button variant="danger" className="btn-small" disabled={!!busyTaskId} onClick={()=>void runAction(id,'cancel')}>Confirm cancel</Button><Button variant="ghost" className="btn-small" onClick={()=>setCancelId('')}>Keep task</Button></div>
         :<Button variant="ghost" className="btn-small" disabled={!!busyTaskId} onClick={()=>setCancelId(id)}>Cancel task</Button>}
       </div>}
      </li>;
     })}</ul>}
   </div><div className="panel care-create-panel"><CareTaskForm key={petId} petId={petId} onCreated={()=>updated('Care task scheduled.')}/>
     <div className="care-reminder-note"><strong>How reminders work</strong><p>Tasks are saved immediately. With both the reminder and outbox workers enabled, in-app reminders are generated shortly before their due time. Recurring occurrences are generated after completion and when due. Notifications are not guaranteed until those workers are configured and running.</p></div>
   </div></div>
   <CareReminderPanel/>
  </>}
 </section>;
}
