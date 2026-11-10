// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {createPetPayload,dateInputValue,editPetPayload,PetFormError} from '@/lib/pets/payloads';
import {PetManagementWorkspace} from '@/components/features/PetManagementWorkspace';
import {PetProfileForm} from '@/components/pets/PetProfileForm';
import {ArchivePet} from '@/components/pets/ArchivePet';
import {api} from '@/lib/api/client';

const replace=vi.fn(),refresh=vi.fn();
vi.mock('next/navigation',()=>({useRouter:()=>({replace,refresh})}));
vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const samplePet={id:17,name:'Milo',species:'Cat',breed:'Domestic shorthair',sex:'MALE',status:'ACTIVE',dateOfBirth:'2022-08-14T00:00:00Z',attributesJson:'{"color":"black"}'};

beforeEach(()=>{vi.resetAllMocks();});
afterEach(()=>cleanup());

describe('PetCreate and PetEdit contracts',()=>{
 it('sends every required create field with backend-compatible sex and nullable birthday',()=>{
  expect(createPetPayload({name:'  Luna  ',species:' Cat ',breed:' ',sex:'FEMALE',dateOfBirth:''}))
   .toEqual({name:'Luna',species:'Cat',breed:null,sex:'FEMALE',dateOfBirth:null,attributesJson:null});
 });
 it('preserves birthday as UTC midnight without changing the date',()=>{
  const payload=createPetPayload({name:'Milo',species:'Cat',breed:'',sex:'UNKNOWN',dateOfBirth:'2022-08-14'});
  expect(payload.dateOfBirth).toBe('2022-08-14T00:00:00.000Z');
  expect(dateInputValue('2022-08-14T23:30:00+06:00')).toBe('2022-08-14');
 });
 it('preserves attributes that backend PATCH would otherwise clear',()=>{
  expect(editPetPayload({name:' Milo ',breed:'Domestic shorthair',dateOfBirth:'2022-08-14'},samplePet.attributesJson))
   .toEqual({name:'Milo',breed:'Domestic shorthair',dateOfBirth:'2022-08-14T00:00:00.000Z',attributesJson:'{"color":"black"}'});
 });
 it('rejects invalid dates and future dates',()=>{
  expect(()=>createPetPayload({name:'Milo',species:'Cat',breed:'',sex:'MALE',dateOfBirth:'2025-02-30'})).toThrow(PetFormError);
  expect(()=>createPetPayload({name:'Milo',species:'Cat',breed:'',sex:'MALE',dateOfBirth:'2999-01-01'})).toThrow('future');
 });
 it('rejects Oracle byte-size overflows and unexpected sex values',()=>{
  expect(()=>createPetPayload({name:'🐈'.repeat(31),species:'Cat',breed:'',sex:'FEMALE',dateOfBirth:''})).toThrow('UTF-8 bytes');
  expect(()=>createPetPayload({name:'Milo',species:'Cat',breed:'',sex:'CUSTOM',dateOfBirth:''})).toThrow('valid sex');
  expect(()=>createPetPayload({name:' ',species:'Cat',breed:'',sex:'MALE',dateOfBirth:''})).toThrow('required');
 });
});

describe('pet directory',()=>{
 it('lists active pets and filters by breed without making another request',()=>{
  render(<PetManagementWorkspace initialPets={[samplePet,{id:22,name:'Buddy',species:'Dog',breed:'Golden retriever'}]}/>);
  expect(screen.getByRole('heading',{name:'My pets'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:/Milo/})).toHaveAttribute('href','/pets/17');
  fireEvent.change(screen.getByRole('searchbox',{name:'Search pets'}),{target:{value:'retriever'}});
  expect(screen.getByText('Buddy')).toBeInTheDocument();
  expect(screen.queryByText('Milo')).not.toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('renders a helpful empty state',()=>{
  render(<PetManagementWorkspace initialPets={[]}/>);
  expect(screen.getByText('No pet profiles yet')).toBeInTheDocument();
 });
 it('creates a pet with the exact contract, then reloads the list',async()=>{
  mockApi.mockResolvedValueOnce({id:29,status:'ACTIVE'}).mockResolvedValueOnce([{id:29,name:'Luna',species:'Cat',sex:'FEMALE'}]);
  render(<PetManagementWorkspace initialPets={[]}/>);
  fireEvent.click(screen.getByRole('button',{name:/Add a pet/}));
  fireEvent.change(screen.getByLabelText(/Pet name/),{target:{value:' Luna '}});
  fireEvent.change(screen.getByLabelText(/Species/),{target:{value:'Cat'}});
  fireEvent.change(screen.getByLabelText(/^Sex/),{target:{value:'FEMALE'}});
  fireEvent.submit(screen.getByRole('button',{name:/^Add pet$/}).closest('form')!);
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/pets',{method:'POST',body:{name:'Luna',species:'Cat',breed:null,sex:'FEMALE',dateOfBirth:null,attributesJson:null}}));
  await waitFor(()=>expect(screen.getByText('Luna')).toBeInTheDocument());
  expect(refresh).toHaveBeenCalled();
 });
 it('shows a load error and retries the existing list endpoint',async()=>{
  mockApi.mockResolvedValueOnce([samplePet]);
  render(<PetManagementWorkspace initialPets={[]} initialError="PawCare API is unavailable."/>);
  expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  await waitFor(()=>expect(screen.getByText('Milo')).toBeInTheDocument());
 });
});

describe('pet profile editor',()=>{
 it('PATCHes only editable fields while retaining existing attributes and date',async()=>{
  mockApi.mockResolvedValue(undefined);
  const onSaved=vi.fn();
  render(<PetProfileForm mode="edit" pet={samplePet} onSaved={onSaved}/>);
  expect(screen.getByText('Species cannot be changed after registration.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Breed/),{target:{value:'Tuxedo'}});
  fireEvent.submit(screen.getByRole('button',{name:'Save changes'}).closest('form')!);
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/pets/17',{method:'PATCH',body:{name:'Milo',breed:'Tuxedo',dateOfBirth:'2022-08-14T00:00:00.000Z',attributesJson:'{"color":"black"}'}}));
  await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());
 });
 it('shows API errors instead of reporting a false save',async()=>{
  mockApi.mockRejectedValue(new Error('Unable to save pet.'));
  render(<PetProfileForm mode="edit" pet={samplePet}/>);
  fireEvent.submit(screen.getByRole('button',{name:'Save changes'}).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save pet');
 });
});

describe('safe archive',()=>{
 it('requires name confirmation before calling DELETE and then returns to the list',async()=>{
  mockApi.mockResolvedValue(undefined);
  render(<ArchivePet id="17" name="Milo"/>);
  fireEvent.click(screen.getByRole('button',{name:'Archive pet'}));
  const confirm=screen.getByRole('button',{name:'Confirm archive'});
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Type/),{target:{value:'milo'}});
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Type/),{target:{value:'Milo'}});
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/pets/17',{method:'DELETE'}));
  await waitFor(()=>expect(replace).toHaveBeenCalledWith('/pets'));
 });
 it('keeps the page open and shows active-listing conflicts',async()=>{
  mockApi.mockRejectedValue(new Error('Pet associated with an active listing.'));
  render(<ArchivePet id="17" name="Milo"/>);
  fireEvent.click(screen.getByRole('button',{name:'Archive pet'}));
  fireEvent.change(screen.getByLabelText(/Type/),{target:{value:'Milo'}});
  fireEvent.click(screen.getByRole('button',{name:'Confirm archive'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('active listing');
  expect(replace).not.toHaveBeenCalled();
 });
});
