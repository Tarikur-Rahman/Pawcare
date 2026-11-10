// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {CareTaskForm} from '@/components/care/CareTaskForm';
import {CareWorkspace} from '@/components/features/CareWorkspace';
import {
 CARE_TYPES,CareFormError,careTaskPayload,careDueInstant,careIndicator,careSummary,filterCareTasks,
} from '@/lib/care/tasks';

vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const pet={id:17,name:'Milo',status:'ACTIVE'};
const tasks=[
 {id:1,title:'Evening walk',type:'EXERCISE',status:'PENDING',dueAt:'2030-01-02T08:00:00Z',recurrenceRule:'DAILY'},
 {id:2,title:'Morning meal',type:'FEEDING',status:'PENDING',dueAt:'2020-01-02T08:00:00Z',recurrenceRule:null},
 {id:3,title:'Bath',type:'GROOMING',status:'COMPLETED',dueAt:'2020-01-01T08:00:00Z'},
 {id:4,title:'Brush teeth',type:'HYGIENE',status:'CANCELLED',dueAt:'2020-01-02T09:00:00Z'},
];
const now=new Date('2029-12-31T12:00:00Z');
function change(label:string,value:string){fireEvent.change(screen.getByLabelText(label,{exact:false}),{target:{value}});}
function setupApi(){mockApi.mockImplementation((async path=>{
 if(path==='/pets')return [pet];
 if(path==='/pets/17/tasks')return tasks;
 return {};
 }) as typeof api);}
beforeEach(()=>{vi.resetAllMocks();window.history.replaceState({},'','/');});
afterEach(()=>cleanup());

describe('Care task contract',()=>{
 it('accepts every supported care type',()=>{
  expect(CARE_TYPES).toEqual(['FEEDING','GROOMING','MEDICATION','EXERCISE','HYGIENE','OTHER']);
 });
 it('normalizes a one-time task into exact backend fields',()=>{
  const payload=careTaskPayload({type:' feeding ',title:' Feed Milo ',dueAt:'2030-01-02T11:30',recurrenceRule:''},now);
  expect(payload).toEqual({type:'FEEDING',title:'Feed Milo',dueAt:new Date('2030-01-02T11:30').toISOString(),recurrenceRule:null});
 });
 it('supports daily weekly and monthly recurrence only',()=>{
  for(const rule of ['DAILY','WEEKLY','MONTHLY'])expect(careTaskPayload({type:'OTHER',title:'Check',dueAt:'2030-01-02T11:30',recurrenceRule:rule},now).recurrenceRule).toBe(rule);
  expect(()=>careTaskPayload({type:'OTHER',title:'Check',dueAt:'2030-01-02T11:30',recurrenceRule:'FREQ=HOURLY'},now)).toThrow(CareFormError);
 });
 it('rejects invalid task types, empty titles and Oracle byte-limit overflow',()=>{
  expect(()=>careTaskPayload({type:'UNKNOWN',title:'Check',dueAt:'2030-01-02T11:30',recurrenceRule:''},now)).toThrow('supported');
  expect(()=>careTaskPayload({type:'OTHER',title:' ',dueAt:'2030-01-02T11:30',recurrenceRule:''},now)).toThrow('required');
  expect(()=>careTaskPayload({type:'OTHER',title:'🐾'.repeat(41),dueAt:'2030-01-02T11:30',recurrenceRule:''},now)).toThrow('UTF-8 bytes');
 });
 it('rejects nonexistent, malformed and already elapsed local due times',()=>{
  expect(()=>careDueInstant('2030-02-30T10:00')).toThrow(CareFormError);
  expect(()=>careDueInstant('2030-01-02T25:00')).toThrow(CareFormError);
  expect(()=>careDueInstant('2030-01-02')).toThrow(CareFormError);
  expect(()=>careTaskPayload({type:'OTHER',title:'Check',dueAt:'2029-12-30T10:00',recurrenceRule:''},now)).toThrow('future');
 });
 it('labels overdue and near-due tasks without changing persisted status',()=>{
  expect(careIndicator(tasks[1],now)).toBe('OVERDUE');
  expect(careIndicator({status:'PENDING',dueAt:'2030-01-01T08:00:00Z'},now)).toBe('DUE_SOON');
  expect(careIndicator(tasks[0],now)).toBe('UPCOMING');
  expect(careIndicator(tasks[2],now)).toBe('COMPLETED');
  expect(careIndicator(tasks[3],now)).toBe('CANCELLED');
 });
 it('counts only pending overdue tasks and filters/sorts without mutating input',()=>{
  expect(careSummary(tasks,now)).toEqual({total:4,pending:2,overdue:1,dueSoon:0,completed:1,cancelled:1});
  expect(filterCareTasks(tasks,'ALL','',now).map(t=>t.id)).toEqual([2,1,4,3]);
  expect(filterCareTasks(tasks,'OVERDUE','',now).map(t=>t.id)).toEqual([2]);
  expect(filterCareTasks(tasks,'ALL','Walk',now).map(t=>t.id)).toEqual([1]);
  expect(filterCareTasks(tasks,'COMPLETED','',now).map(t=>t.id)).toEqual([3]);
  expect(tasks[0].id).toBe(1);
 });
});

describe('Care entry',()=>{
 it('POSTs the correct payload, clears the form, and notifies parent',async()=>{
  mockApi.mockResolvedValueOnce({id:51,status:'PENDING'});
  const created=vi.fn();render(<CareTaskForm petId="17" onCreated={created}/>);
  change('Care type','FEEDING');change('Task name',' Evening meal ');change('Due date and time','2099-01-02T19:30');change('Repeat','WEEKLY');
  fireEvent.submit(screen.getByRole('button',{name:'Create care task'}).closest('form')!);
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/pets/17/tasks',{method:'POST',body:{type:'FEEDING',title:'Evening meal',dueAt:new Date('2099-01-02T19:30').toISOString(),recurrenceRule:'WEEKLY'}}));
  await waitFor(()=>expect(created).toHaveBeenCalledOnce());
  expect(screen.getByLabelText('Task name',{exact:false})).toHaveValue('');
 });
 it('blocks invalid dates without calling API',async()=>{
  render(<CareTaskForm petId="17" onCreated={vi.fn()}/>);
  change('Task name','Groom');change('Due date and time','2020-01-01T10:00');
  fireEvent.submit(screen.getByRole('button',{name:'Create care task'}).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('future due date');
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('maps server-side field errors and preserves the form on failure',async()=>{
  mockApi.mockRejectedValueOnce(new ApiError(400,'VALIDATION','Not allowed',undefined,{title:['Name is not valid']}));
  render(<CareTaskForm petId="17" onCreated={vi.fn()}/>);
  change('Task name','Walk');change('Due date and time','2099-01-02T19:30');
  fireEvent.submit(screen.getByRole('button',{name:'Create care task'}).closest('form')!);
  expect(await screen.findByText('Name is not valid')).toBeInTheDocument();
  expect(screen.getByLabelText('Task name',{exact:false})).toHaveValue('Walk');
 });
});

describe('Care dashboard',()=>{
 it('loads only active owner pets and displays due tasks with filters',async()=>{
  setupApi();render(<CareWorkspace/>);
  expect(await screen.findByText('Evening walk')).toBeInTheDocument();
  expect(screen.getByText('Morning meal')).toBeInTheDocument();
  expect(screen.queryByText('Bath')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Completed'}));
  expect(screen.getByText('Bath')).toBeInTheDocument();
  expect(screen.queryByText('Morning meal')).not.toBeInTheDocument();
 });
 it('does not act on a settled task; allows completing a pending task',async()=>{
  setupApi();render(<CareWorkspace/>);
  await screen.findByText('Evening walk');
  expect(screen.getAllByRole('button',{name:'Mark complete'})).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button',{name:'Mark complete'})[0]);
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/tasks/2/complete',{method:'POST'}));
  expect(await screen.findByText('Task completed.')).toBeInTheDocument();
 });
 it('requires explicit confirmation to cancel a pending task',async()=>{
  setupApi();render(<CareWorkspace/>);await screen.findByText('Evening walk');
  fireEvent.click(screen.getAllByRole('button',{name:'Cancel task'})[0]);
  expect(mockApi).not.toHaveBeenCalledWith('/tasks/2/cancel',{method:'POST'});
  fireEvent.click(screen.getByRole('button',{name:'Keep task'}));
  expect(screen.queryByRole('button',{name:'Confirm cancel'})).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button',{name:'Cancel task'})[0]);
  fireEvent.click(screen.getByRole('button',{name:'Confirm cancel'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/tasks/2/cancel',{method:'POST'}));
 });
 it('shows task API errors without showing false success',async()=>{
  setupApi();render(<CareWorkspace/>);await screen.findByText('Evening walk');
  mockApi.mockRejectedValueOnce(new Error('Care action is unavailable.'));
  fireEvent.click(screen.getAllByRole('button',{name:'Mark complete'})[0]);
  expect(await screen.findByRole('alert')).toHaveTextContent('Care action is unavailable.');
  expect(screen.queryByText('Task completed.')).not.toBeInTheDocument();
 });
 it('displays a helpful empty state with no pet profiles',async()=>{
  mockApi.mockResolvedValueOnce([]);
  render(<CareWorkspace/>);
  expect(await screen.findByText('Add a pet first')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Create care task'})).not.toBeInTheDocument();
 });
 it('retries initial pet-list errors',async()=>{
  mockApi.mockRejectedValueOnce(new Error('API is offline')).mockResolvedValueOnce([pet]).mockResolvedValueOnce([]);
  render(<CareWorkspace/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('API is offline');
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  expect(await screen.findByText('No care tasks yet')).toBeInTheDocument();
 });
});

describe('Delivered care reminder display',()=>{
 it('loads only actual care notifications, not appointments, and shows read state',async()=>{
  setupApi();
  // The notifications endpoint is loaded on demand, not during the care task fetch.
  mockApi.mockImplementation((async path=>{
   if(path==='/pets')return [pet];
   if(path==='/pets/17/tasks')return [];
   if(path==='/notifications')return [
    {id:7,kind:'CARE_REMINDER',title:'Pet care reminder',body:'A task is due.',readAt:null,createdAt:'2030-01-01T10:00:00Z'},
    {id:8,kind:'APPOINTMENT_REMINDER',title:'Vet visit',readAt:null},
    {id:9,kind:'CARE_REMINDER',title:'Pet care reminder',body:'Another task',readAt:'2030-01-01T12:00:00Z',createdAt:'2030-01-01T11:00:00Z'},
   ];
   return {};
  }) as typeof api);
  render(<CareWorkspace/>);
  await screen.findByText('No care tasks yet');
  expect(mockApi).not.toHaveBeenCalledWith('/notifications');
  fireEvent.click(screen.getByRole('button',{name:'Load reminders'}));
  expect(await screen.findByText('1 unread in the 2 most recent care reminders shown.')).toBeInTheDocument();
  expect(screen.queryByText('Vet visit')).not.toBeInTheDocument();
  expect(screen.getByText('A task is due.')).toBeInTheDocument();
 });
 it('reports a notifications endpoint failure independently of task loading',async()=>{
  setupApi();
  mockApi.mockImplementation((async path=>{
   if(path==='/pets')return [pet];
   if(path==='/pets/17/tasks')return [];
   if(path==='/notifications')throw new Error('Reminder service unavailable');
   return {};
  }) as typeof api);
  render(<CareWorkspace/>);await screen.findByText('No care tasks yet');
  fireEvent.click(screen.getByRole('button',{name:'Load reminders'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reminder service unavailable');
  expect(screen.getByText('No care tasks yet')).toBeInTheDocument();
 });
});
