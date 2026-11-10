// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {ProfileWorkspace} from '@/components/features/ProfileWorkspace';
import {ProfileEditor} from '@/components/account/ProfileEditor';
import {AddressCreator} from '@/components/account/AddressCreator';
import {
 profilePayload,addressPayload,profileToFields,addressId,addressScope,isDefaultAddress,visibleAddresses,AccountInputError,
 type ProfileFields,type AddressFields,
} from '@/lib/account/records';

vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const profile={id:12,email:'owner@pawcare.test',role:'OWNER',status:'ACTIVE',displayName:'Nadia Rahman',phone:'+8801712345678',timeZone:'Asia/Dhaka',locale:'en-BD'};
const addresses=[
 {id:19,recipientName:'Nadia Rahman',line1:'Road 12',city:'Dhaka',countryCode:'BD',scope:'SHIPPING',isDefault:1},
 {id:20,recipientName:'Lab Accounts',line1:'Main Street',city:'Chattogram',countryCode:'BD',scope:'BILLING',isDefault:0},
];
const profileFields:ProfileFields={displayName:'  Nadia Rahman  ',timeZone:'Asia/Dhaka',locale:'en-BD',phone:' +8801712345678 '};
const addressFields:AddressFields={recipientName:'  Nadia Rahman ',line1:'  Road 12 ',city:' Dhaka ',countryCode:' bd ',scope:'shipping'};
function change(label:string,value:string){fireEvent.change(screen.getByLabelText(label,{exact:false}),{target:{value}});}
function defaultApi(){
 mockApi.mockImplementation((async (path:string,opts?:{method?:string;body?:unknown})=>{
  if(path==='/users/me'&&opts?.method==='PATCH')return {...profile,...opts.body as object};
  if(path==='/users/me')return profile;
  if(path==='/users/me/addresses'&&opts?.method==='POST')return {id:21,scope:'SHIPPING'};
  if(path==='/users/me/addresses')return addresses;
  throw new Error('Unexpected API route');
 }) as typeof api);
}
beforeEach(()=>{vi.resetAllMocks();defaultApi();window.history.replaceState({},'','/profile');});
afterEach(()=>cleanup());

describe('Account payload rules match the ASP.NET Users API',()=>{
 it('normalizes profile fields and sends only supported properties',()=>{
  expect(profilePayload(profileFields)).toEqual({displayName:'Nadia Rahman',timeZone:'Asia/Dhaka',locale:'en-BD',phone:'+8801712345678'});
 });
 it('sends null to explicitly remove an optional phone',()=>{
  expect(profilePayload({...profileFields,phone:'   '}).phone).toBeNull();
 });
 it('rejects an empty display name',()=>{
  expect(()=>profilePayload({...profileFields,displayName:'  '})).toThrow(AccountInputError);
 });
 it('rejects a display name over the backend limit',()=>{
  expect(()=>profilePayload({...profileFields,displayName:'X'.repeat(121)})).toThrow('120 UTF-8 bytes');
 });
 it('enforces UTF-8 byte limits for multilingual names, not just JavaScript characters',()=>{
  expect(()=>profilePayload({...profileFields,displayName:'🐾'.repeat(31)})).toThrow('120 UTF-8 bytes');
  expect(()=>addressPayload({...addressFields,recipientName:'🐾'.repeat(41)})).toThrow('160 UTF-8 bytes');
 });
 it('rejects an invalid IANA time zone',()=>{
  expect(()=>profilePayload({...profileFields,timeZone:'Asia/Imaginary'})).toThrow('IANA time zone');
 });
 it('rejects invalid language tags and overlong locale strings',()=>{
  expect(()=>profilePayload({...profileFields,locale:'bad_locale_@@'})).toThrow('language tag');
  expect(()=>profilePayload({...profileFields,locale:'a'.repeat(17)})).toThrow('16 UTF-8 bytes');
 });
 it('requires optional phones, if supplied, to use E.164 notation',()=>{
  for(const phone of ['01712345678','+01234567890','+880 1712345678','+1234'])
   expect(()=>profilePayload({...profileFields,phone})).toThrow('international number');
 });
 it('accepts supported IANA time zones and locale codes',()=>{
  expect(profilePayload({...profileFields,timeZone:'UTC',locale:'bn-BD'})).toMatchObject({timeZone:'UTC',locale:'bn-BD'});
 });
 it('hydrates profile fields from case-varied records, with safe defaults',()=>{
  expect(profileToFields({DISPLAYNAME:'Ayesha',TIMEZONE:'',LOCALE:'',PHONE:null})).toEqual({displayName:'Ayesha',timeZone:'Asia/Dhaka',locale:'en-BD',phone:''});
 });
 it('trims and normalizes a shipping address to the exact create contract',()=>{
  expect(addressPayload(addressFields)).toEqual({recipientName:'Nadia Rahman',line1:'Road 12',city:'Dhaka',countryCode:'BD',scope:'SHIPPING'});
 });
 it('rejects missing recipient, line1 and city',()=>{
  for(const key of ['recipientName','line1','city'] as const)
   expect(()=>addressPayload({...addressFields,[key]:'  '})).toThrow('required');
 });
 it('requires an alphabetic two-letter country code',()=>{
  for(const countryCode of ['B','BGD','B1','1D',''])expect(()=>addressPayload({...addressFields,countryCode})).toThrow(AccountInputError);
 });
 it('rejects unsupported address scopes',()=>{
  expect(()=>addressPayload({...addressFields,scope:'DEFAULT'})).toThrow('Shipping or Billing');
 });
 it('enforces exact address lengths from the backend',()=>{
  expect(()=>addressPayload({...addressFields,recipientName:'a'.repeat(161)})).toThrow('160 UTF-8 bytes');
  expect(()=>addressPayload({...addressFields,line1:'a'.repeat(201)})).toThrow('200 UTF-8 bytes');
  expect(()=>addressPayload({...addressFields,city:'a'.repeat(101)})).toThrow('100 UTF-8 bytes');
 });
 it('accepts only safe positive address identifiers',()=>{
  expect(addressId(addresses[0])).toBe('19');
  for(const id of ['-5','0','3.2','3/a','9007199254740993',null])expect(addressId({id})).toBe('');
 });
 it('recognizes default addresses without treating Oracle zero as true',()=>{
  expect(isDefaultAddress(addresses[0])).toBe(true);
  expect(isDefaultAddress(addresses[1])).toBe(false);
  expect(isDefaultAddress({isDefault:'Y'})).toBe(true);
 });
 it('categorizes unknown address scope safely',()=>{
  expect(addressScope(addresses[0])).toBe('SHIPPING');
  expect(addressScope({scope:'OTHER'})).toBe('OTHER');
 });
 it('filters by type, name, street and city without mutating the order',()=>{
  expect(visibleAddresses(addresses,'SHIPPING','')).toEqual([addresses[0]]);
  expect(visibleAddresses(addresses,'ALL','main street')).toEqual([addresses[1]]);
  expect(visibleAddresses(addresses,'BILLING','DHAKA')).toEqual([]);
  expect(visibleAddresses(addresses,'ALL','')).toEqual(addresses);
  expect(addresses[0].id).toBe(19);
 });
});

describe('Profile edit form',()=>{
 it('saves only the profile contract through PATCH and reports success',async()=>{
  const saved=vi.fn();render(<ProfileEditor profile={profile} onSaved={saved}/>);
  change('Display name','  Nadia New  ');
  fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/users/me',{method:'PATCH',body:{displayName:'Nadia New',phone:'+8801712345678',timeZone:'Asia/Dhaka',locale:'en-BD'}}));
  expect(await screen.findByText('Profile saved successfully.')).toBeInTheDocument();
  expect(saved).toHaveBeenCalledTimes(1);
 });
 it('blocks invalid international phone before submitting',async()=>{
  render(<ProfileEditor profile={profile} onSaved={vi.fn()}/>);
  change('Phone','invalid-number');
  fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
  expect(await screen.findByText(/international number/i)).toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('can remove a previously saved phone number',async()=>{
  render(<ProfileEditor profile={profile} onSaved={vi.fn()}/>);
  change('Phone',' ');fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/users/me',{method:'PATCH',body:expect.objectContaining({phone:null})}));
 });
 it('displays backend field errors without losing user-entered text',async()=>{
  mockApi.mockRejectedValueOnce(new ApiError(422,'VALIDATION_ERROR','Incorrect profile',undefined,{displayName:['Please choose another name.']}));
  render(<ProfileEditor profile={profile} onSaved={vi.fn()}/>);
  change('Display name','New Name');fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
  expect(await screen.findByText('Please choose another name.')).toBeInTheDocument();
  expect(screen.getByLabelText('Display name',{exact:false})).toHaveValue('New Name');
  expect(screen.queryByText('Profile saved successfully.')).not.toBeInTheDocument();
 });
 it('does not claim save success when PATCH fails',async()=>{
  mockApi.mockRejectedValueOnce(new Error('The profile service is unavailable.'));
  const saved=vi.fn();render(<ProfileEditor profile={profile} onSaved={saved}/>);
  fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
  expect(await screen.findByText('The profile service is unavailable.')).toBeInTheDocument();
  expect(saved).not.toHaveBeenCalled();
 });
});

describe('Shipping and billing address creation',()=>{
 it('POSTs only supported properties, refreshes list and clears form after success',async()=>{
  const added=vi.fn();render(<AddressCreator onAdded={added}/>);
  change('Recipient name','Nadia Rahman');change('Street / area','Road 12');change('City','Dhaka');
  change('Country code','bd');change('Address type','BILLING');
  fireEvent.click(screen.getByRole('button',{name:'Add address'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/users/me/addresses',{method:'POST',body:{recipientName:'Nadia Rahman',line1:'Road 12',city:'Dhaka',countryCode:'BD',scope:'BILLING'}}));
  expect(await screen.findByText('Address added successfully.')).toBeInTheDocument();
  expect(added).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Recipient name',{exact:false})).toHaveValue('');
 });
 it('prevents invalid country codes from reaching the API',async()=>{
  render(<AddressCreator onAdded={vi.fn()}/>);
  change('Recipient name','Nadia');change('Street / area','Road 12');change('City','Dhaka');change('Country code','1D');
  fireEvent.click(screen.getByRole('button',{name:'Add address'}));
  expect(await screen.findByText(/two-letter country code/i)).toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('preserves the address draft on POST failure',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Cannot create address.'));
  render(<AddressCreator onAdded={vi.fn()}/>);
  change('Recipient name','Nadia');change('Street / area','Road 12');change('City','Dhaka');
  fireEvent.click(screen.getByRole('button',{name:'Add address'}));
  expect(await screen.findByText('Cannot create address.')).toBeInTheDocument();
  expect(screen.getByLabelText('Recipient name',{exact:false})).toHaveValue('Nadia');
  expect(screen.queryByText('Address added successfully.')).not.toBeInTheDocument();
 });
 it('maps server-side address errors to the corresponding field',async()=>{
  mockApi.mockRejectedValueOnce(new ApiError(422,'VALIDATION_ERROR','Invalid address',undefined,{line1:['Location is required.']}));
  render(<AddressCreator onAdded={vi.fn()}/>);
  change('Recipient name','Nadia');change('Street / area','Road 12');change('City','Dhaka');
  fireEvent.click(screen.getByRole('button',{name:'Add address'}));
  expect(await screen.findByText('Location is required.')).toBeInTheDocument();
 });
});

describe('Private account workspace',()=>{
 it('loads own identity and saved addresses independently',async()=>{
  render(<ProfileWorkspace/>);
  expect(await screen.findByText('owner@pawcare.test')).toBeInTheDocument();
  expect(await screen.findByText('Road 12, Dhaka, BD')).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledWith('/users/me',expect.objectContaining({signal:expect.any(AbortSignal)}));
  expect(mockApi).toHaveBeenCalledWith('/users/me/addresses',expect.objectContaining({signal:expect.any(AbortSignal)}));
  expect(screen.getByText('Account security')).toBeInTheDocument();
 });
 it('filters saved addresses by type and keyword',async()=>{
  render(<ProfileWorkspace/>);await screen.findByText('Road 12, Dhaka, BD');
  fireEvent.click(screen.getByRole('button',{name:'Billing'}));
  expect(screen.queryByText('Road 12, Dhaka, BD')).not.toBeInTheDocument();
  expect(screen.getByText('Main Street, Chattogram, BD')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'All'}));
  fireEvent.change(screen.getByRole('searchbox',{name:'Search addresses'}),{target:{value:'Chattogram'}});
  expect(screen.queryByText('Road 12, Dhaka, BD')).not.toBeInTheDocument();
 });
 it('does not show a false empty state when addresses cannot load',async()=>{
  mockApi.mockImplementation((async path=>{
   if(path==='/users/me')return profile;
   throw new Error('Address database unavailable');
  }) as typeof api);
  render(<ProfileWorkspace/>);
  expect(await screen.findByText('Address database unavailable')).toBeInTheDocument();
  expect(screen.queryByText('No addresses saved')).not.toBeInTheDocument();
  expect(screen.getByText('owner@pawcare.test')).toBeInTheDocument();
 });
 it('shows separate profile load failure without hiding the address list',async()=>{
  mockApi.mockImplementation((async path=>{
   if(path==='/users/me/addresses')return addresses;
   throw new Error('Profile database unavailable');
  }) as typeof api);
  render(<ProfileWorkspace/>);
  expect(await screen.findByText('Profile database unavailable')).toBeInTheDocument();
  expect(await screen.findByText('Road 12, Dhaka, BD')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Save profile'})).not.toBeInTheDocument();
 });
 it('shows truthful empty state for an actually empty address response',async()=>{
  mockApi.mockImplementation((async path=>path==='/users/me'?profile:[]) as typeof api);
  render(<ProfileWorkspace/>);
  expect(await screen.findByText('No addresses saved')).toBeInTheDocument();
 });
 it('refreshes the saved address list after adding a new address',async()=>{
  let addressGets=0;
  mockApi.mockImplementation((async (path:string,opts?:{method?:string})=>{
   if(path==='/users/me')return profile;
   if(path==='/users/me/addresses'&&opts?.method==='POST')return {id:21};
   if(path==='/users/me/addresses'){
    addressGets++;
    return addressGets===1?addresses:[...addresses,{id:21,recipientName:'Rina',line1:'House 24',city:'Dhaka',countryCode:'BD',scope:'SHIPPING'}];
   }
   throw new Error('Unexpected route');
  }) as typeof api);
  render(<ProfileWorkspace/>);await screen.findByText('Road 12, Dhaka, BD');
  change('Recipient name','Rina');change('Street / area','House 24');change('City','Dhaka');
  fireEvent.click(screen.getByRole('button',{name:'Add address'}));
  expect(await screen.findByText('House 24, Dhaka, BD')).toBeInTheDocument();
  expect(addressGets).toBe(2);
 });
});
