// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {
 BookingFormError,appointmentId,appointmentStatus,allowedAppointmentActions,appointmentSummary,
 bookingInstant,bookingPayload,filterAppointments,formatAppointmentTime,
} from '@/lib/appointments/booking';
import {AppointmentBookingForm} from '@/components/appointments/AppointmentBookingForm';
import {BookingWorkspace} from '@/components/features/BookingWorkspace';
import {ApiError} from '@/lib/api/errors';
import {api} from '@/lib/api/client';

vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const pet={id:17,name:'Milo',status:'ACTIVE'};
const inactivePet={id:18,name:'Retired',status:'ARCHIVED'};
const vetUser={id:41,displayName:'Dr. Green'};
const requested={id:91,petId:17,vetId:41,startsAt:'2099-01-02T10:00:00Z',endsAt:'2099-01-02T10:30:00Z',status:'REQUESTED',reason:'Annual checkup'};
const confirmed={...requested,id:92,status:'CONFIRMED'};
const completed={...requested,id:93,status:'COMPLETED'};
const cancelled={...requested,id:94,status:'CANCELLED'};
const now=new Date('2098-12-31T00:00:00Z');
const values={petId:'17',vetId:'41',startsAt:'2099-01-02T10:00',endsAt:'2099-01-02T11:00',reason:' Regular checkup '};

function change(label:string,value:string){
 fireEvent.change(screen.getByLabelText(label,{exact:false}),{target:{value}});
}
function setupOwner(){
 mockApi.mockImplementation((async path=>{
  if(path==='/appointments')return [requested,confirmed,completed,cancelled];
  if(path==='/pets')return [pet,inactivePet];
  if(path==='/vets')return [vetUser];
  return {};
 }) as typeof api);
}
function setupVet(){
 mockApi.mockImplementation((async path=>path==='/appointments'?[requested,confirmed,completed]:{}) as typeof api);
}
beforeEach(()=>{vi.resetAllMocks();window.history.replaceState({},'','/');});
afterEach(()=>cleanup());

describe('Booking request and Oracle-backed status contract',()=>{
 it('produces backend-compatible UTC payloads with normalized reason',()=>{
  expect(bookingPayload(values,now)).toEqual({petId:17,vetId:41,startsAt:new Date(values.startsAt).toISOString(),endsAt:new Date(values.endsAt).toISOString(),reason:'Regular checkup'});
 });
 it('produces null for blank reasons',()=>{
  expect(bookingPayload({...values,reason:' '},now).reason).toBeNull();
 });
 it('rejects invalid ids including fractions, negatives and unsafe integers',()=>{
  for(const id of ['0','-1','2.5','9007199254740993','abc'])expect(()=>bookingPayload({...values,petId:id},now)).toThrow(BookingFormError);
  expect(()=>bookingPayload({...values,vetId:'0'},now)).toThrow('veterinarian');
 });
 it('rejects non-existent local dates and malformed times',()=>{
  for(const date of ['2099-02-30T10:00','2099-01-02T25:00','2099-01-02','2099-13-02T10:00'])expect(()=>bookingInstant(date,'startsAt')).toThrow(BookingFormError);
 });
 it('requires the appointment to start in the future',()=>{
  expect(()=>bookingPayload({...values,startsAt:'2098-12-30T10:00'},now)).toThrow('future');
 });
 it('requires positive duration and caps the visit at 8 hours',()=>{
  expect(()=>bookingPayload({...values,endsAt:values.startsAt},now)).toThrow('after');
  expect(()=>bookingPayload({...values,endsAt:'2099-01-02T18:01'},now)).toThrow('8 hours');
  expect(bookingPayload({...values,endsAt:'2099-01-02T18:00'},now).endsAt).toBe(new Date('2099-01-02T18:00').toISOString());
 });
 it('enforces reason length and UTF-8 byte limits',()=>{
  expect(()=>bookingPayload({...values,reason:'🐾'.repeat(251)},now)).toThrow('UTF-8 bytes');
  expect(()=>bookingPayload({...values,reason:'a'.repeat(1001)},now)).toThrow('1,000');
 });
 it('restricts owner actions to cancel, and vet actions to allowed status transitions',()=>{
  expect(allowedAppointmentActions(requested,'OWNER')).toEqual(['cancel']);
  expect(allowedAppointmentActions(confirmed,'OWNER')).toEqual(['cancel']);
  expect(allowedAppointmentActions(completed,'OWNER')).toEqual([]);
  expect(allowedAppointmentActions(requested,'VET')).toEqual(['confirm','reject']);
  expect(allowedAppointmentActions(confirmed,'VET')).toEqual(['complete','no-show']);
  expect(allowedAppointmentActions(cancelled,'VET')).toEqual([]);
  expect(allowedAppointmentActions({...requested,id:'bad'},'VET')).toEqual([]);
 });
 it('normalizes status, rejects untrusted IDs and handles missing timestamps',()=>{
  expect(appointmentStatus({...requested,status:'requested'})).toBe('REQUESTED');
  expect(appointmentId({...requested,id:'99/confirm'})).toBe('');
  expect(formatAppointmentTime('not-a-date')).toBe('Date unavailable');
 });
 it('counts and filters visits with upcoming chronological ordering',()=>{
  expect(appointmentSummary([requested,confirmed,completed,cancelled],now)).toEqual({requested:1,confirmed:1,upcoming:2,completed:1});
  const petNames=new Map([['17','Milo']]);const vetNames=new Map([['41','Dr. Green']]);
  expect(filterAppointments([completed,requested,confirmed],'UPCOMING','',petNames,vetNames,now).map(a=>a.id)).toEqual([91,92]);
  expect(filterAppointments([completed,requested],'COMPLETED','',petNames,vetNames,now).map(a=>a.id)).toEqual([93]);
  expect(filterAppointments([requested],'ALL','green',petNames,vetNames,now)).toHaveLength(1);
  expect(filterAppointments([requested],'ALL','unknown',petNames,vetNames,now)).toHaveLength(0);
 });
});

describe('Owner appointment booking form',()=>{
 it('POSTs an exact body and shows requested-not-confirmed feedback',async()=>{
  mockApi.mockResolvedValueOnce({id:99,status:'REQUESTED'});
  const saved=vi.fn();render(<AppointmentBookingForm pets={[pet]} vets={[vetUser]} onBooked={saved}/>);
  change('Pet','17');change('Veterinarian','41');change('Start date and time','2099-01-02T10:00');change('End date and time','2099-01-02T11:00');change('Reason for visit',' Annual checkup ');
  fireEvent.submit(screen.getByRole('button',{name:'Request appointment'}).closest('form')!);
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/appointments',{method:'POST',body:{petId:17,vetId:41,startsAt:new Date('2099-01-02T10:00').toISOString(),endsAt:new Date('2099-01-02T11:00').toISOString(),reason:'Annual checkup'}}));
  await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
  expect(screen.getByRole('status')).toHaveTextContent('veterinarian must confirm');
  expect(screen.getByLabelText('Reason for visit (optional)')).toHaveValue('');
 });
 it('blocks a reversed date range and does not call API',async()=>{
  render(<AppointmentBookingForm pets={[pet]} vets={[vetUser]} onBooked={vi.fn()}/>);
  change('Pet','17');change('Veterinarian','41');change('Start date and time','2099-01-02T10:00');change('End date and time','2099-01-02T09:00');
  fireEvent.submit(screen.getByRole('button',{name:'Request appointment'}).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('end after');expect(mockApi).not.toHaveBeenCalled();
 });
 it('preserves fields and shows a backend scheduling conflict',async()=>{
  mockApi.mockRejectedValueOnce(new ApiError(409,'CONFLICT','This veterinarian has an overlapping appointment.'));
  render(<AppointmentBookingForm pets={[pet]} vets={[vetUser]} onBooked={vi.fn()}/>);
  change('Pet','17');change('Veterinarian','41');change('Start date and time','2099-01-02T10:00');change('End date and time','2099-01-02T11:00');
  fireEvent.submit(screen.getByRole('button',{name:'Request appointment'}).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('overlapping appointment');
  expect(screen.getByLabelText('Pet',{exact:false})).toHaveValue('17');
 });
 it('displays server-side field validation errors',async()=>{
  mockApi.mockRejectedValueOnce(new ApiError(400,'VALIDATION','Bad request',undefined,{startsAt:['Start time unavailable']}));
  render(<AppointmentBookingForm pets={[pet]} vets={[vetUser]} onBooked={vi.fn()}/>);
  change('Pet','17');change('Veterinarian','41');change('Start date and time','2099-01-02T10:00');change('End date and time','2099-01-02T11:00');
  fireEvent.submit(screen.getByRole('button',{name:'Request appointment'}).closest('form')!);
  expect(await screen.findByText('Start time unavailable')).toBeInTheDocument();
 });
 it('disables booking when no active pets or veterinarians are supplied',()=>{
  render(<AppointmentBookingForm pets={[]} vets={[]} onBooked={vi.fn()}/>);
  expect(screen.getByRole('button',{name:'Request appointment'})).toBeDisabled();
 });
});

describe('Appointments dashboard role controls',()=>{
 it('renders owner queue, filters, and excludes archived pets from booking',async()=>{
  setupOwner();render(<BookingWorkspace/>);
  expect((await screen.findAllByText('Reason: Annual checkup')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('Milo').length).toBeGreaterThan(0);
  expect(screen.getByRole('option',{name:'Milo'})).toBeInTheDocument();
  expect(screen.queryByRole('option',{name:'Retired'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Completed'}));
  expect(screen.getByText('Booking #93')).toBeInTheDocument();
  expect(screen.queryByText('Booking #91')).not.toBeInTheDocument();
 });
 it('requires explicit confirmation before cancelling a requested appointment',async()=>{
  setupOwner();render(<BookingWorkspace/>);
  await screen.findByText('Booking #91');
  fireEvent.click(screen.getAllByRole('button',{name:'Cancel appointment'})[0]);
  expect(mockApi).not.toHaveBeenCalledWith('/appointments/91/cancel',{method:'POST'});
  fireEvent.click(screen.getByRole('button',{name:'Keep appointment'}));
  expect(screen.queryByRole('button',{name:'Confirm cancel'})).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button',{name:'Cancel appointment'})[0]);
  fireEvent.click(screen.getByRole('button',{name:'Confirm cancel'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/appointments/91/cancel',{method:'POST'}));
 });
 it('shows a retryable error if the appointment endpoint is unavailable',async()=>{
  mockApi.mockImplementation((async path=>{
   if(path==='/appointments')throw new Error('Appointment service offline');
   if(path==='/pets')return [pet];if(path==='/vets')return [vetUser];return {};
  }) as typeof api);
  render(<BookingWorkspace/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Appointment service offline');
  expect(screen.getByRole('button',{name:'Retry'})).toBeInTheDocument();
 });
 it('does not show a false success when cancelling fails',async()=>{
  setupOwner();render(<BookingWorkspace/>);
  await screen.findByText('Booking #91');
  mockApi.mockImplementation((async (path)=>{
   if(path==='/appointments/91/cancel')throw new Error('Appointment already closed');
   if(path==='/appointments')return [requested,confirmed];
   if(path==='/pets')return [pet];if(path==='/vets')return [vetUser];return {};
  }) as typeof api);
  fireEvent.click(screen.getAllByRole('button',{name:'Cancel appointment'})[0]);
  fireEvent.click(screen.getByRole('button',{name:'Confirm cancel'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Appointment already closed');
  expect(screen.queryByText('Appointment cancelled.')).not.toBeInTheDocument();
 });
 it('only exposes authorized vet actions and never fetches owner pets',async()=>{
  setupVet();render(<BookingWorkspace vet/>);
  await screen.findByText('Booking #91');
  expect(screen.getByRole('button',{name:'Confirm visit'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Reject request'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Complete visit'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Mark no-show'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Cancel appointment'})).not.toBeInTheDocument();
  expect(mockApi.mock.calls.some(([path])=>path==='/pets')).toBe(false);
  expect(screen.queryByRole('button',{name:'Request appointment'})).not.toBeInTheDocument();
 });
 it('confirms a request directly but requires confirmation before a no-show',async()=>{
  setupVet();render(<BookingWorkspace vet/>);
  await screen.findByText('Booking #91');
  fireEvent.click(screen.getByRole('button',{name:'Confirm visit'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/appointments/91/confirm',{method:'POST'}));
  // Confirmation starts an asynchronous list refresh. Wait for the new queue
  // instead of clicking controls from the previous render during loading.
  await waitFor(()=>expect(mockApi.mock.calls.filter(([path])=>path==='/appointments')).toHaveLength(2));
  fireEvent.click(await screen.findByRole('button',{name:'Mark no-show'}));
  expect(mockApi).not.toHaveBeenCalledWith('/appointments/92/no-show',{method:'POST'});
  fireEvent.click(await screen.findByRole('button',{name:'Confirm no-show'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/appointments/92/no-show',{method:'POST'}));
 });
 it('does not display vet transition controls for completed visits',async()=>{
  setupVet();render(<BookingWorkspace vet/>);
  await screen.findByText('Booking #91');
  fireEvent.click(screen.getByRole('button',{name:'Completed'}));
  expect(screen.getByText('Booking #93')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Complete visit'})).not.toBeInTheDocument();
  expect(screen.getByText('No actions available')).toBeInTheDocument();
 });
});
