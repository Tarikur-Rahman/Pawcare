import Link from 'next/link';
import {CalendarDays,PawPrint,Heart,Bell,ArrowUpRight,Users,ShoppingBag} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {serverApi} from '@/lib/api/server';
import {rows,str,type Row} from '@/lib/types/domain';
import {activePets,dashboardCount,nextVisits,unreadPreview} from '@/lib/dashboard/overview';
import {formatAppointmentTime} from '@/lib/appointments/booking';
import {notificationTime} from '@/lib/notifications/records';
import {PetCard} from '@/components/pets/PetCard';
import {EmptyState} from '@/components/ui/EmptyState';

type Result={value:unknown;error:string};
type DashboardTile=readonly [label:string,value:string,href:string,Icon:LucideIcon];
async function get(path:string):Promise<Result>{
 try{return {value:await serverApi(path,true),error:''};}
 catch{return {value:null,error:'The server could not load this information.'};}
}
function asRow(value:unknown):Row|null{
 return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Row:null;
}
function StatTile({label,value,href,Icon}:{label:string;value:string;href:string;Icon:LucideIcon}){
 return <div className="stat-card"><span className="stat-icon"><Icon size={21}/></span><h3>{value}</h3><p>{label}</p>
  <Link href={href} className="inline-link">View details <ArrowUpRight size={14} aria-hidden="true"/></Link></div>;
}

export async function DashboardOverview({type='owner'}:{type?:'owner'|'vet'|'admin'}){
 if(type==='vet'){
  const visits=await get('/appointments');const upcoming=visits.error?[]:nextVisits(rows(visits.value));
  return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">YOUR DAY AT A GLANCE</span>
   <h1>Your veterinary workspace</h1><p>Review your assigned appointments and the visits coming up.</p></div></div>
   <div className="workspace-grid dashboard-tiles"><StatTile label="Upcoming visits" value={visits.error?'—':String(upcoming.length)} href="/vet/appointments" Icon={CalendarDays}/></div>
   <div className="panel dashboard-section">{visits.error?<p role="alert">Appointments are unavailable. <Link className="inline-link" href="/vet">Try again</Link></p>:
    !upcoming.length?<EmptyState title="No upcoming visits" description="New requests and confirmed appointments will appear here."/>:
    <ul className="dashboard-preview-list">{upcoming.map((item,index)=><li key={str(item,'id')||index}><div><strong>Pet #{str(item,'petId')}</strong>
     <p>{formatAppointmentTime(str(item,'startsAt'))} · {str(item,'status').toLowerCase()}</p></div><Link href="/vet/appointments" className="inline-link">Manage</Link></li>)}</ul>}</div>
  </section>;
 }
 if(type==='admin'){
  const [users,orders]=await Promise.all([get('/admin/users'),get('/admin/orders')]);
  const tiles:DashboardTile[]=[['Users',users.error?'—':String(rows(users.value).length),'/admin/users',Users],
   ['Orders',orders.error?'—':String(rows(orders.value).length),'/admin/orders',ShoppingBag]];
  return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">YOUR DAY AT A GLANCE</span>
   <h1>PawCare operations</h1><p>Review users and orders across your workspace.</p></div></div>
   {(users.error||orders.error)&&<p className="dashboard-warning" role="alert">Some operations data could not load. Refresh to try again.</p>}
   <div className="workspace-grid dashboard-tiles">{tiles.map(([label,value,href,Icon])=><StatTile key={label} label={label} value={value} href={href} Icon={Icon}/>)}</div>
  </section>;
 }

 const [reportResponse,petsResponse,visitsResponse,notificationsResponse]=await Promise.all([
  get('/reports/dashboard'),get('/pets'),get('/appointments'),get('/notifications'),
 ]);
 const report=asRow(reportResponse.value);
 const pets=petsResponse.error?[]:activePets(rows(petsResponse.value));
 const upcoming=visitsResponse.error?[]:nextVisits(rows(visitsResponse.value));
 const unread=notificationsResponse.error?[]:unreadPreview(rows(notificationsResponse.value));
 const names=new Map(pets.map(pet=>[str(pet,'id'),str(pet,'name')]));
 const tiles:DashboardTile[]=[
  ['My pets',report?dashboardCount(report,'petCount'):petsResponse.error?'—':String(pets.length),'/pets',PawPrint],
  ['Upcoming visits',dashboardCount(report,'upcomingVisits'),'/appointments',CalendarDays],
  ['Pending care tasks',dashboardCount(report,'pendingTasks'),'/care',Heart],
  ['Unread notifications',dashboardCount(report,'unreadNotifications'),'/notifications',Bell],
 ];
 const warnings=[reportResponse.error?'Summary totals':null,petsResponse.error?'Pet profiles':null,
  visitsResponse.error?'Appointments':null,notificationsResponse.error?'Notifications':null].filter(Boolean);
 return <section className="page-section">
  <div className="page-heading"><div><span className="eyebrow">YOUR DAY AT A GLANCE</span>
   <h1>A little care goes a long way.</h1><p>All the important moments for your companions, in one place.</p></div>
   <Link className="btn btn-secondary" href="/dashboard">Refresh overview</Link></div>
  {!!warnings.length&&<p className="dashboard-warning" role="alert">Some sections are unavailable ({warnings.join(', ')}). Missing totals are shown as —, not zero.</p>}
  <div className="workspace-grid dashboard-tiles">{tiles.map(([label,value,href,Icon])=><StatTile key={label} label={label} value={value} href={href} Icon={Icon}/>)}</div>
  <div className="dashboard-lower dashboard-primary">
   <div className="panel"><div className="flex-between"><h2>Your companions</h2><Link className="inline-link" href="/pets">Manage pets →</Link></div>
    {petsResponse.error?<p className="hint" role="alert">Pet profiles are unavailable right now. Refresh the dashboard to try again.</p>:
     pets.length?<div className="pet-grid">{pets.slice(0,3).map(p=><PetCard pet={p} key={str(p,'id')}/>)}</div>:
     <EmptyState title="Start with your first pet" description="Create a profile to track care, health and milestones." href="/pets" action="Add a pet"/>}</div>
   <div className="panel"><h2>Quick actions</h2><p>Jump back into the care your companion needs.</p>
    <div className="quick-actions"><Link href="/care" className="btn btn-secondary">Plan care</Link>
     <Link href="/appointments" className="btn btn-secondary">Book a visit</Link>
     <Link href="/expenses" className="btn btn-secondary">Track expenses</Link>
     <Link href="/notifications" className="btn btn-secondary">View notifications</Link></div></div>
  </div>
  <div className="dashboard-lower dashboard-highlights">
   <div className="panel"><div className="flex-between"><h2>Upcoming visits</h2><Link className="inline-link" href="/appointments">All appointments →</Link></div>
    {visitsResponse.error?<p className="hint" role="alert">Appointments are unavailable right now.</p>:
     !upcoming.length?<EmptyState title="No upcoming visits" description="Book a visit when your companion needs a checkup." href="/appointments" action="Book an appointment"/>:
     <ul className="dashboard-preview-list">{upcoming.map((item,index)=><li key={str(item,'id')||index}><div>
      <strong>{names.get(str(item,'petId'))||`Pet #${str(item,'petId')}`}</strong>
      <p>{formatAppointmentTime(str(item,'startsAt'))} · {str(item,'status').toLowerCase()}</p></div>
      <Link className="inline-link" href="/appointments">Details</Link></li>)}</ul>}</div>
   <div className="panel"><div className="flex-between"><h2>Unread updates</h2><Link className="inline-link" href="/notifications">All notifications →</Link></div>
    {notificationsResponse.error?<p className="hint" role="alert">Notifications are unavailable right now.</p>:
     !unread.length?<EmptyState title="No recent unread updates" description="New care reminders and notifications will appear here."/>:
     <ul className="dashboard-preview-list">{unread.map((item,index)=><li key={str(item,'id')||index}><div>
      <strong>{str(item,'title')||'PawCare update'}</strong><p>{str(item,'body')||'No additional details provided.'}</p>
      <small>{notificationTime(str(item,'createdAt'))}</small></div>
      <Link className="inline-link" href="/notifications">Read</Link></li>)}</ul>}</div>
  </div>
 </section>;
}
