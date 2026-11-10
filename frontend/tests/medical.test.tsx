// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {
 filterMedical,medicalCounts,medicalKind,medicationPayload,vaccinePayload,MedicalFormError,
} from '@/lib/medical/records';
import {MedicalRecordsWorkspace} from '@/components/pets/MedicalRecordsWorkspace';
import {MedicalRecordForm} from '@/components/pets/MedicalRecordForm';
import {HealthTimeline} from '@/components/pets/HealthTimeline';
import {ApiError} from '@/lib/api/errors';
import {api} from '@/lib/api/client';

const refresh=vi.fn();
vi.mock('next/navigation',()=>({useRouter:()=>({refresh})}));
vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const events=[
 {type:'VACCINE',id:3,title:'Rabies',occurredAt:'2024-01-15T08:00:00Z',nextDueAt:'2025-01-15T08:00:00Z'},
 {type:'MEDICATION',id:3,title:'Prescribed therapy',occurredAt:'2024-05-01T08:00:00Z',dosageText:'As written on the prescription',endAt:'2024-05-20T08:00:00Z'},
 {type:'APPOINTMENT',id:4,title:'Annual vet visit',occurredAt:'2024-06-10T08:00:00Z'},
];
beforeEach(()=>vi.resetAllMocks());
afterEach(()=>cleanup());

function setValue(label:RegExp|string,value:string){fireEvent.change(screen.getByLabelText(label,{exact:false}),{target:{value}});}

describe('MedicalService request contracts and local date validation',()=>{
 it('builds vaccine POST body with correct ISO instants and nullable due date',()=>{
  expect(vaccinePayload({vaccineName:' Rabies ',administeredAt:'2024-01-15T14:30',nextDueAt:''},new Date('2024-12-31')))
   .toEqual({vaccineName:'Rabies',administeredAt:new Date('2024-01-15T14:30').toISOString(),nextDueAt:null});
 });
 it('requires a strictly later next dose date',()=>{
  expect(()=>vaccinePayload({vaccineName:'Rabies',administeredAt:'2024-01-15T14:30',nextDueAt:'2024-01-15T14:30'},new Date('2025-01-01')))
   .toThrow('after the administered');
 });
 it('rejects a future administered date',()=>{
  expect(()=>vaccinePayload({vaccineName:'Rabies',administeredAt:'2099-01-15T10:00',nextDueAt:''},new Date('2024-01-01')))
   .toThrow('future');
 });
 it('rejects malformed or normalized dates and missing vaccine names',()=>{
  expect(()=>vaccinePayload({vaccineName:'Rabies',administeredAt:'2024-02-30T08:00',nextDueAt:''})).toThrow(MedicalFormError);
  expect(()=>vaccinePayload({vaccineName:'  ',administeredAt:'2024-01-10T08:00',nextDueAt:''})).toThrow('required');
 });
 it('enforces Oracle byte-width rather than codepoint length',()=>{
  expect(()=>vaccinePayload({vaccineName:'💉'.repeat(41),administeredAt:'2024-01-10T08:00',nextDueAt:''})).toThrow('160-byte');
  expect(()=>medicationPayload({medicationName:'Valid',dosageText:'💊'.repeat(76),startAt:'2024-01-10T08:00',endAt:''})).toThrow('300-byte');
 });
 it('builds medication POST body from user-prescribed text',()=>{
  expect(medicationPayload({medicationName:' Medication ',dosageText:' Follow the vet label ',startAt:'2024-05-01T10:00',endAt:'2024-05-12T10:00'}))
   .toEqual({medicationName:'Medication',dosageText:'Follow the vet label',startAt:new Date('2024-05-01T10:00').toISOString(),endAt:new Date('2024-05-12T10:00').toISOString()});
 });
 it('rejects medication end-before-start and accepts equal dates per backend contract',()=>{
  expect(()=>medicationPayload({medicationName:'Medicine',dosageText:'Label',startAt:'2024-05-02T10:00',endAt:'2024-05-01T10:00'})).toThrow('precede');
  expect(medicationPayload({medicationName:'Medicine',dosageText:'Label',startAt:'2024-05-02T10:00',endAt:'2024-05-02T10:00'}).endAt).not.toBeNull();
 });
 it('counts and filters event types without mixing duplicate record IDs',()=>{
  expect(medicalCounts(events)).toEqual({ALL:3,VACCINE:1,MEDICATION:1,APPOINTMENT:1});
  expect(medicalKind({type:'UNKNOWN'})).toBeNull();
  expect(filterMedical(events,'VACCINE','rAb')).toEqual([events[0]]);
  expect(filterMedical(events,'MEDICATION','prescription')).toEqual([events[1]]);
  expect(filterMedical(events,'ALL','nonexistent')).toEqual([]);
 });
});

describe('Medical record entry',()=>{
 it('submits an exact vaccination request and refreshes on success',async()=>{
  mockApi.mockResolvedValueOnce({id:12});
  const saved=vi.fn();
  render(<MedicalRecordForm petId="17" kind="VACCINE" onSaved={saved}/>);
  setValue('Vaccine name','Rabies');
  setValue('Administered date and time','2024-01-15T14:30');
  setValue(/Next dose due/,'2025-01-15T14:30');
  fireEvent.submit(screen.getByRole('button',{name:'Save vaccination'}).closest('form')!);
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/pets/17/medical/vaccinations',{method:'POST',body:{
   vaccineName:'Rabies',administeredAt:new Date('2024-01-15T14:30').toISOString(),nextDueAt:new Date('2025-01-15T14:30').toISOString(),
  }}));
  await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
  expect(screen.getByRole('status')).toHaveTextContent('Vaccination saved.');
 });
 it('blocks invalid vaccine dates without touching the API',async()=>{
  render(<MedicalRecordForm petId="17" kind="VACCINE" onSaved={vi.fn()}/>);
  setValue('Vaccine name','Rabies');
  setValue('Administered date and time','2024-01-15T14:30');
  setValue(/Next dose due/,'2024-01-15T14:00');
  fireEvent.submit(screen.getByRole('button',{name:'Save vaccination'}).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('after the administered');
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('sends prescribed medication and nullable end date',async()=>{
  mockApi.mockResolvedValueOnce({id:11});
  render(<MedicalRecordForm petId="17" kind="MEDICATION" onSaved={vi.fn()}/>);
  setValue('Medication name','Prescription');
  setValue('Prescribed dosage / instructions','As prescribed by a vet');
  setValue('Start date and time','2024-06-01T09:00');
  fireEvent.submit(screen.getByRole('button',{name:'Save medication'}).closest('form')!);
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/pets/17/medical/medications',{method:'POST',body:{
   medicationName:'Prescription',dosageText:'As prescribed by a vet',startAt:new Date('2024-06-01T09:00').toISOString(),endAt:null,
  }}));
 });
 it('shows backend permission failures and preserves entered values',async()=>{
  mockApi.mockRejectedValueOnce(new ApiError(403,'FORBIDDEN','Not authorized for this pet.'));
  render(<MedicalRecordForm petId="17" kind="VACCINE" onSaved={vi.fn()}/>);
  setValue('Vaccine name','Rabies');
  setValue('Administered date and time','2024-01-15T14:30');
  fireEvent.submit(screen.getByRole('button',{name:'Save vaccination'}).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('Not authorized');
  expect(screen.getByLabelText(/Vaccine name/)).toHaveValue('Rabies');
 });
 it('maps server field errors to the relevant input',async()=>{
  mockApi.mockRejectedValueOnce(new ApiError(400,'VALIDATION','Invalid values',undefined,{vaccineName:['Duplicate record']}));
  render(<MedicalRecordForm petId="17" kind="VACCINE" onSaved={vi.fn()}/>);
  setValue('Vaccine name','Rabies');
  setValue('Administered date and time','2024-01-15T14:30');
  fireEvent.submit(screen.getByRole('button',{name:'Save vaccination'}).closest('form')!);
  expect(await screen.findByText('Duplicate record')).toBeInTheDocument();
  expect(screen.getByLabelText(/Vaccine name/)).toHaveAttribute('aria-invalid','true');
 });
});

describe('Medical timeline and patient workspace',()=>{
 it('displays recorded dosage/due dates and uniquely keys shared numeric IDs',()=>{
  const {container}=render(<HealthTimeline items={events}/>);
  expect(screen.getByText('Next dose:')).toBeInTheDocument();
  expect(screen.getByText('As written on the prescription')).toBeInTheDocument();
  expect(screen.getByText('Annual vet visit')).toBeInTheDocument();
  expect(container.querySelectorAll('ol > li')).toHaveLength(3);
 });
 it('filters history while preserving the original record count',()=>{
  render(<MedicalRecordsWorkspace petId="17" initialRecords={events}/>);
  fireEvent.click(screen.getByRole('button',{name:/^Vaccinations 1$/}));
  expect(screen.getByText('Rabies')).toBeInTheDocument();
  expect(screen.queryByText('Prescribed therapy')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/^All records 3$/}));
  fireEvent.change(screen.getByRole('searchbox',{name:'Search health records'}),{target:{value:'visit'}});
  expect(screen.getByText('Annual vet visit')).toBeInTheDocument();
  expect(screen.queryByText('Rabies')).not.toBeInTheDocument();
 });
 it('blocks new entries on an archived pet',()=>{
  render(<MedicalRecordsWorkspace petId="17" initialRecords={events} editable={false}/>);
  expect(screen.getByText(/This pet is archived/)).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Save vaccination'})).not.toBeInTheDocument();
  expect(screen.getByText('Rabies')).toBeInTheDocument();
 });
 it('reloads history after a successful create without changing the other entry type',async()=>{
  mockApi.mockResolvedValueOnce({id:15}).mockResolvedValueOnce([...events,{type:'VACCINE',id:15,title:'Bordetella',occurredAt:'2024-09-01T08:00:00Z'}]);
  render(<MedicalRecordsWorkspace petId="17" initialRecords={events}/>);
  setValue('Vaccine name','Bordetella');
  setValue('Administered date and time','2024-09-01T08:00');
  fireEvent.submit(screen.getByRole('button',{name:'Save vaccination'}).closest('form')!);
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/pets/17/medical'));
  await waitFor(()=>expect(screen.getByText('Bordetella')).toBeInTheDocument());
  expect(refresh).toHaveBeenCalled();
 });
 it('supports retry after initial medical load failure',async()=>{
  mockApi.mockResolvedValueOnce(events);
  render(<MedicalRecordsWorkspace petId="17" initialRecords={[]} initialError="Medical API temporarily unavailable."/>);
  expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable');
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  await waitFor(()=>expect(screen.getByText('Rabies')).toBeInTheDocument());
 });
});
