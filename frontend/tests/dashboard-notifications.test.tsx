// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {rows,type Row} from '@/lib/types/domain';
import {dashboardCount,activePets,nextVisits,unreadPreview} from '@/lib/dashboard/overview';
import {filterNotifications,isUnread,notificationId,notificationSummary,notificationTime} from '@/lib/notifications/records';
import {NotificationsWorkspace} from '@/components/features/NotificationsWorkspace';
import {DashboardOverview} from '@/components/features/DashboardOverview';

const mocks=vi.hoisted(()=>({api:vi.fn(),serverApi:vi.fn()}));
vi.mock('@/lib/api/client',()=>({api:mocks.api}));
vi.mock('@/lib/api/server',()=>({serverApi:mocks.serverApi}));

const updates:Row[]=[
 {id:10,kind:'CARE_REMINDER',title:'Feed Miso',body:'Breakfast due',createdAt:'2026-11-07T07:00:00Z',readAt:null},
 {id:11,kind:'ORDER_UPDATE',title:'Order delivered',body:'Parcel arrived',createdAt:'2026-11-08T10:00:00Z',readAt:'2026-11-08T12:00:00Z'},
 {id:12,kind:'APPOINTMENT',title:'Vet follow-up',body:'Appointment tomorrow',createdAt:'2026-11-09T10:00:00Z',readAt:null},
];
const visits:Row[]=[
 {id:1,status:'REQUESTED',petId:3,startsAt:'2030-11-09T10:00:00Z',endsAt:'2030-11-09T11:00:00Z'},
 {id:2,status:'CONFIRMED',petId:3,startsAt:'2030-11-08T10:00:00Z',endsAt:'2030-11-08T11:00:00Z'},
 {id:3,status:'CANCELLED',petId:3,startsAt:'2030-11-07T10:00:00Z',endsAt:'2030-11-07T11:00:00Z'},
];

beforeEach(()=>{
 vi.clearAllMocks();
 mocks.api.mockImplementation(async (path:string,options?:{method?:string})=>{
  if(path==='/notifications')return updates;
  if(path.startsWith('/notifications/')&&options?.method==='POST')return undefined;
  throw new Error('Unexpected request: '+path);
 });
 mocks.serverApi.mockImplementation(async(path:string)=>{
  if(path==='/reports/dashboard')return {petCount:1,pendingTasks:2,upcomingVisits:2,unreadNotifications:2};
  if(path==='/pets')return [{id:3,name:'Miso',status:'ACTIVE'}];
  if(path==='/appointments')return visits;
  if(path==='/notifications')return updates;
  throw new Error('Unexpected server request: '+path);
 });
});

describe('dashboard summary and preview helpers',()=>{
 it('shows missing values as unknown, not a fabricated zero',()=>{
  expect(dashboardCount(null,'petCount')).toBe('—');
  expect(dashboardCount({},'petCount')).toBe('—');
  expect(dashboardCount({petCount:-1},'petCount')).toBe('—');
  expect(dashboardCount({petCount:'1.5'},'petCount')).toBe('—');
  expect(dashboardCount({petCount:0},'petCount')).toBe('0');
  expect(dashboardCount({petCount:'4'},'petCount')).toBe('4');
 });
 it('excludes archived pets',()=>{
  expect(activePets([{id:1,status:'ACTIVE'},{id:2,status:'ARCHIVED'},{id:3}]).map(x=>x.id)).toEqual([1,3]);
 });
 it('only shows active upcoming visits sorted by start time',()=>{
  expect(nextVisits(visits,new Date('2030-11-06T00:00:00Z')).map(x=>x.id)).toEqual([2,1]);
  expect(nextVisits(visits,new Date('2030-11-06T00:00:00Z'),1).map(x=>x.id)).toEqual([2]);
 });
 it('excludes expired visits and invalid timestamps',()=>{
  expect(nextVisits([...visits,{id:4,status:'REQUESTED',startsAt:'bad',endsAt:'2030-11-09T12:00:00Z'}],new Date('2030-11-08T12:00:00Z')).map(x=>x.id)).toEqual([1]);
 });
 it('shows only unread notifications in descending creation order',()=>{
  expect(unreadPreview(updates).map(x=>x.id)).toEqual([12,10]);
  expect(unreadPreview(updates,1).map(x=>x.id)).toEqual([12]);
 });
});

describe('notifications helpers',()=>{
 it('accepts positive ids without allowing an injected route',()=>{
  expect(notificationId({id:12})).toBe('12');
  expect(notificationId({id:'12/../../pets'})).toBe('');
  expect(notificationId({id:'0'})).toBe('');
  expect(notificationId({})).toBe('');
 });
 it('distinguishes unread and read records',()=>{
  expect(isUnread(updates[0])).toBe(true);
  expect(isUnread(updates[1])).toBe(false);
  expect(notificationSummary(updates)).toEqual({total:3,unread:2,read:1});
 });
 it('filters read status and searches title/body/kind without mutating original order',()=>{
  expect(filterNotifications(updates,'UNREAD','').map(x=>x.id)).toEqual([12,10]);
  expect(filterNotifications(updates,'READ','').map(x=>x.id)).toEqual([11]);
  expect(filterNotifications(updates,'ALL','parcel').map(x=>x.id)).toEqual([11]);
  expect(filterNotifications(updates,'ALL','care_reminder').map(x=>x.id)).toEqual([10]);
  expect(updates.map(x=>x.id)).toEqual([10,11,12]);
 });
 it('returns a safe fallback for missing notification timestamps',()=>{
  expect(notificationTime('invalid')).toBe('Time unavailable');
  expect(notificationTime('2026-11-07T07:00:00Z')).not.toBe('Time unavailable');
 });
});

describe('owner dashboard integration',()=>{
 it('uses the correct report counters and owner quick links',async()=>{
  render(await DashboardOverview({type:'owner'}));
  const overview=screen.getByRole('heading',{name:'A little care goes a long way.'});
  expect(overview).toBeInTheDocument();
  expect(screen.getByText('Unread notifications')).toBeInTheDocument();
  expect(screen.getByText('Pending care tasks')).toBeInTheDocument();
  expect(screen.queryByText('Orders')).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Track expenses'})).toHaveAttribute('href','/expenses');
  expect(mocks.serverApi).toHaveBeenCalledWith('/reports/dashboard',true);
  expect(mocks.serverApi).toHaveBeenCalledWith('/notifications',true);
 });
 it('shows a truthful unavailable state instead of an empty pets prompt',async()=>{
  mocks.serverApi.mockImplementation(async (path:string)=>{
   if(path==='/pets'||path==='/reports/dashboard')throw new Error('unavailable');
   if(path==='/appointments'||path==='/notifications')return [];
  });
  render(await DashboardOverview({type:'owner'}));
  expect(screen.getByText(/Missing totals are shown as/)).toBeInTheDocument();
  expect(screen.getByText(/Pet profiles are unavailable right now/)).toBeInTheDocument();
  expect(screen.queryByText('Start with your first pet')).not.toBeInTheDocument();
 });
 it('shows next appointments but not closed requests',async()=>{
  render(await DashboardOverview({type:'owner'}));
  const section=screen.getByRole('heading',{name:'Upcoming visits'}).closest('.panel')!;
  expect(within(section as HTMLElement).getAllByText('Miso')).toHaveLength(2);
 });
 it('keeps veterinarian and admin dashboards in their existing routes',async()=>{
  render(await DashboardOverview({type:'vet'}));
  expect(screen.getByRole('heading',{name:'Your veterinary workspace'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:/View details/})).toHaveAttribute('href','/vet/appointments');
 });
 it('preserves the separate admin summary using admin endpoints',async()=>{
  mocks.serverApi.mockImplementation(async(path:string)=>{
   if(path==='/admin/users')return [{id:1},{id:2}];
   if(path==='/admin/orders')return [{id:9}];
   throw new Error('Unexpected server request');
  });
  render(await DashboardOverview({type:'admin'}));
  expect(screen.getByRole('heading',{name:'PawCare operations'})).toBeInTheDocument();
  expect(screen.getByText('Users')).toBeInTheDocument();
  expect(screen.getByText('Orders')).toBeInTheDocument();
  expect(mocks.serverApi).toHaveBeenCalledWith('/admin/users',true);
  expect(mocks.serverApi).toHaveBeenCalledWith('/admin/orders',true);
 });
});

describe('notifications workspace behavior',()=>{
 it('loads the latest notifications with read/unread totals',async()=>{
  render(<NotificationsWorkspace/>);
  expect(await screen.findByText('Feed Miso')).toBeInTheDocument();
  const totals=document.querySelector('.notification-stats') as HTMLElement;
  expect(within(totals).getByText('3')).toBeInTheDocument();
  expect(within(totals).getByText('2')).toBeInTheDocument();
  expect(within(totals).getByText('1')).toBeInTheDocument();
 });
 it('filters unread and searches notification text',async()=>{
  render(<NotificationsWorkspace/>);
  await screen.findByText('Feed Miso');
  fireEvent.click(screen.getByRole('button',{name:'Unread'}));
  expect(screen.queryByText('Order delivered')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox',{name:'Search notifications'}),{target:{value:'follow-up'}});
  expect(screen.getByText('Vet follow-up')).toBeInTheDocument();
  expect(screen.queryByText('Feed Miso')).not.toBeInTheDocument();
 });
 it('marks read only after a successful backend POST',async()=>{
  render(<NotificationsWorkspace/>);
  await screen.findByText('Feed Miso');
  expect(screen.getAllByRole('button',{name:'Mark read'})).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button',{name:'Mark read'})[0]);
  await waitFor(()=>expect(mocks.api).toHaveBeenCalledWith('/notifications/12/read',{method:'POST'}));
  await waitFor(()=>expect(screen.getAllByRole('button',{name:'Mark read'})).toHaveLength(1));
  expect(screen.getByText('Notification marked as read.')).toBeInTheDocument();
 });
 it('does not claim success when the server rejects a mark-read request',async()=>{
  mocks.api.mockImplementation(async(path:string)=>{
   if(path==='/notifications')return updates;
   throw new Error('Cannot update notification');
  });
  render(<NotificationsWorkspace/>);await screen.findByText('Feed Miso');
  fireEvent.click(screen.getAllByRole('button',{name:'Mark read'})[0]);
  expect(await screen.findByText('Cannot update notification')).toBeInTheDocument();
  expect(screen.getAllByRole('button',{name:'Mark read'})).toHaveLength(2);
  expect(screen.queryByText('Notification marked as read.')).not.toBeInTheDocument();
 });
 it('shows retryable API failures rather than an all-caught-up empty state',async()=>{
  mocks.api.mockRejectedValue(new Error('Network unavailable'));
  render(<NotificationsWorkspace/>);
  expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
  expect(screen.queryByText('All caught up')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Retry'})).toBeInTheDocument();
 });
 it('shows an honest empty state when the backend returns no notifications',async()=>{
  mocks.api.mockResolvedValue([]);
  render(<NotificationsWorkspace/>);
  expect(await screen.findByText('All caught up')).toBeInTheDocument();
 });
});
