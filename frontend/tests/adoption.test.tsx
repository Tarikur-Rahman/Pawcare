// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {api} from '@/lib/api/client';
import {AdoptionCatalog} from '@/components/adoption/AdoptionCatalog';
import {ApplicationForm} from '@/components/adoption/ApplicationForm';
import {AdoptionDraftWorkspace} from '@/components/adoption/AdoptionDraftWorkspace';
import {AdoptionManagement} from '@/components/features/AdoptionManagement';
import {
 adoptionId,adoptionText,utf8Bytes,validateAdoptionText,eligiblePet,filterAdoptions,canDecideApplication,adoptionApplicationStatus,newHandoverKey,
} from '@/lib/adoption/records';
import type {Row} from '@/lib/types/domain';

vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const listings:Row[]=[
 {id:101,title:'Meet Luna',species:'CAT',description:'Calm home-loving cat',generalArea:'Dhanmondi'},
 {id:102,title:'Meet Bruno',species:'DOG',description:'Active and friendly',generalArea:'Uttara'},
 {id:103,title:'Meet Kiwi',species:'BIRD',description:'Gentle bird',generalArea:'Mirpur'},
];
function defaultApi(){
 mockApi.mockImplementation((async(path:string)=>{
  if(path==='/pets')return [{id:5,name:'Luna',species:'CAT',status:'ACTIVE'},{id:6,name:'Old profile',status:'ARCHIVED'}];
  if(path==='/adoptions')return {id:201,status:'DRAFT'};
  if(path==='/adoptions/201/submit')return undefined;
  if(path==='/adoptions/101/applications')return [{id:77,applicantId:9,status:'SUBMITTED'},{id:78,applicantId:10,status:'REJECTED'}];
  if(path==='/adoptions/101/applications/77/decision')return {handoverId:900,status:'MATCHED'};
  if(path==='/adoptions/101/handover')return {status:'AWAITING_OTHER_PARTY'};
  return undefined;
 }) as typeof api);
}
beforeEach(()=>{vi.resetAllMocks();defaultApi();});
afterEach(()=>cleanup());

const fillDraft=async()=>{
 await screen.findByRole('option',{name:'Luna (CAT)'});
 fireEvent.change(screen.getByRole('combobox',{name:/Your active pet/}),{target:{value:'5'}});
 fireEvent.change(screen.getByRole('textbox',{name:/Listing headline/}),{target:{value:'Adopt sweet Luna'}});
 fireEvent.change(screen.getByRole('textbox',{name:/Pet story and care needs/}),{target:{value:'Luna needs a patient and caring forever family.'}});
 fireEvent.change(screen.getByRole('textbox',{name:/General area/}),{target:{value:'Dhanmondi'}});
};

describe('Adoption contract validation and safety',()=>{
 it('accepts safe positive Oracle identifiers',()=>{expect(adoptionId('101')).toBe('101');expect(adoptionId(23)).toBe('23');expect(adoptionId(' 00023 ')).toBe('');});
 it('rejects unsafe and injection-like identifiers',()=>{for(const value of [null,undefined,'../1','1/submit','0','-2','1.5','9007199254740993',3.5,'1?x=1'])expect(adoptionId(value)).toBe('');});
 it('trims text without changing original input',()=>{const text='  Friendly cat  ';expect(adoptionText(text)).toBe('Friendly cat');expect(text).toBe('  Friendly cat  ');});
 it('counts multibyte UTF-8 input accurately',()=>{expect(utf8Bytes('hello')).toBe(5);expect(utf8Bytes('🐾')).toBe(4);expect(utf8Bytes('বাংলা')).toBeGreaterThan(5);});
 it('matches server headline bounds and minimum text',()=>{expect(validateAdoptionText('Fido','Headline',1,180)).toBe('');expect(validateAdoptionText(' ','Headline',1,180)).toMatch(/at least 1/);expect(validateAdoptionText('x'.repeat(181),'Headline',1,180)).toMatch(/180 UTF-8/);});
 it('enforces description and application byte limits',()=>{expect(validateAdoptionText('nice','Care story',20,4000)).toMatch(/20/);expect(validateAdoptionText('x'.repeat(20),'Care story',20,4000)).toBe('');expect(validateAdoptionText('🐾'.repeat(1001),'Adoption plan',10,4000)).toMatch(/4000 UTF-8/);});
 it('admits active pets only, never archived pets',()=>{expect(eligiblePet({id:5,status:'ACTIVE'})).toBe(true);expect(eligiblePet({id:6,status:'ARCHIVED'})).toBe(false);expect(eligiblePet({id:'../../bad',status:'ACTIVE'})).toBe(false);});
 it('filters published listing data by structured fields',()=>{expect(filterAdoptions(listings,'luna','ALL').map(x=>x.id)).toEqual([101]);expect(filterAdoptions(listings,'uttara','DOG').map(x=>x.id)).toEqual([102]);expect(filterAdoptions(listings,'','BIRD').map(x=>x.id)).toEqual([103]);});
 it('rejects malformed IDs from a public list without mutating data',()=>{expect(filterAdoptions([...listings,{id:'../bad',title:'Unsafe'}],'','ALL')).toHaveLength(3);expect(listings).toHaveLength(3);});
 it('allows only submitted application decisions',()=>{expect(canDecideApplication({id:4,status:'SUBMITTED'})).toBe(true);expect(canDecideApplication({id:4,status:'ACCEPTED'})).toBe(false);expect(canDecideApplication({id:4,status:'REJECTED'})).toBe(false);expect(canDecideApplication({id:'../4',status:'SUBMITTED'})).toBe(false);});
 it('normalizes Oracle application statuses',()=>{expect(adoptionApplicationStatus({STATUS:' submitted '})).toBe('SUBMITTED');});
 it('generates a valid random idempotency token',()=>{expect(newHandoverKey()).toMatch(/^[0-9a-f]{32}$/);});
 it('routes adoption catalog separately from detail and loads approved public listings only',()=>{
  const route=readFileSync(join(process.cwd(),'app/(public)/adopt/page.tsx'),'utf8');
  expect(route).toContain("safePublic('/adoptions')");expect(route).toContain('<AdoptionCatalog');expect(route).not.toContain('await params');
 });
});

describe('Public adoption browser',()=>{
 it('renders published adoption cards with safe detail paths',()=>{
  render(<AdoptionCatalog items={listings} error={null}/>);
  expect(screen.getByRole('heading',{name:'Adopt a companion'})).toBeInTheDocument();
  expect(screen.getAllByRole('link',{name:/Meet this pet/})[0]).toHaveAttribute('href','/adopt/101');
 });
 it('filters by search and species without additional API calls',()=>{
  render(<AdoptionCatalog items={listings} error={null}/>);
  fireEvent.change(screen.getByRole('searchbox',{name:'Search adoption listings'}),{target:{value:'Uttara'}});
  expect(screen.getByText('Meet Bruno')).toBeInTheDocument();expect(screen.queryByText('Meet Luna')).not.toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('provides species filter and no-match message',()=>{
  render(<AdoptionCatalog items={listings} error={null}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Filter by species'}),{target:{value:'CAT'}});
  expect(screen.getByText('Meet Luna')).toBeInTheDocument();expect(screen.queryByText('Meet Bruno')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox',{name:'Search adoption listings'}),{target:{value:'no match'}});
  expect(screen.getByText('No matching adoption listings')).toBeInTheDocument();
 });
 it('distinguishes empty published listings from unavailable service',()=>{
  const {rerender}=render(<AdoptionCatalog items={[]} error={null}/>);
  expect(screen.getByText('No published adoption listings')).toBeInTheDocument();
  rerender(<AdoptionCatalog items={[]} error="Service unavailable"/>);
  expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
  expect(screen.queryByText('No published adoption listings')).not.toBeInTheDocument();
 });
});

describe('Adoption application',()=>{
 it('posts the private answers only and does not claim approval',async()=>{
  render(<ApplicationForm id="101"/>);
  fireEvent.change(screen.getByRole('textbox',{name:/Your adoption plan/}),{target:{value:'I have cared for rescue cats before.'}});
  fireEvent.click(screen.getByRole('button',{name:'Submit application'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/adoptions/101/applications',{method:'POST',body:{answers:'I have cared for rescue cats before.'}}));
  expect(await screen.findByText(/Application submitted\. The current caretaker/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Application submitted'})).toBeDisabled();
 });
 it('rejects answers below backend minimum without POST',async()=>{
  render(<ApplicationForm id="101"/>);
  fireEvent.change(screen.getByRole('textbox',{name:/Your adoption plan/}),{target:{value:'short'}});
  fireEvent.click(screen.getByRole('button',{name:'Submit application'}));
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('rejects oversize UTF-8 answers before POST',async()=>{
  render(<ApplicationForm id="101"/>);
  fireEvent.change(screen.getByRole('textbox',{name:/Your adoption plan/}),{target:{value:'🐾'.repeat(1001)}});
  fireEvent.click(screen.getByRole('button',{name:'Submit application'}));
  expect(mockApi).not.toHaveBeenCalled();
  expect(screen.getByText(/4000 UTF-8 bytes/)).toBeInTheDocument();
 });
 it('does not clear answers or claim submission when API rejects the request',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Already applied'));
  render(<ApplicationForm id="101"/>);
  fireEvent.change(screen.getByRole('textbox',{name:/Your adoption plan/}),{target:{value:'I can provide daily exercise and veterinary care.'}});
  fireEvent.click(screen.getByRole('button',{name:'Submit application'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Already applied');
  expect(screen.getByRole('textbox',{name:/Your adoption plan/})).toHaveValue('I can provide daily exercise and veterinary care.');
 });
 it('never calls an unsafe adoption application URL',()=>{render(<ApplicationForm id="../bad"/>);expect(screen.getByRole('button',{name:'Submit application'})).toBeDisabled();});
});

describe('Owner adoption drafts',()=>{
 it('loads only active pets and excludes archived pets',async()=>{
  render(<AdoptionDraftWorkspace/>);
  expect(await screen.findByRole('option',{name:'Luna (CAT)'})).toBeInTheDocument();
  expect(screen.queryByRole('option',{name:/Old profile/})).not.toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledWith('/pets',{signal:expect.any(AbortSignal)});
 });
 it('creates draft with exact backend contract then allows explicit submission',async()=>{
  render(<AdoptionDraftWorkspace/>);await fillDraft();
  fireEvent.click(screen.getByRole('button',{name:'Save adoption draft'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/adoptions',{method:'POST',body:{petId:5,title:'Adopt sweet Luna',description:'Luna needs a patient and caring forever family.',generalArea:'Dhanmondi'}}));
  expect(await screen.findByText(/Draft #201 saved/)).toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalledWith('/adoptions/201/submit',expect.anything());
  fireEvent.click(screen.getByRole('button',{name:'Submit draft for review'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/adoptions/201/submit',{method:'POST'}));
  expect(await screen.findByText(/Listing #201 submitted for staff review/)).toBeInTheDocument();
 });
 it('blocks short care stories without create POST',async()=>{
  render(<AdoptionDraftWorkspace/>);await fillDraft();
  fireEvent.change(screen.getByRole('textbox',{name:/Pet story and care needs/}),{target:{value:'Too short'}});
  fireEvent.click(screen.getByRole('button',{name:'Save adoption draft'}));
  expect(mockApi).not.toHaveBeenCalledWith('/adoptions',expect.anything());
  expect(screen.getByText(/Care story must contain/)).toBeInTheDocument();
 });
 it('surfaces draft creation API errors without dropping fields',async()=>{
  mockApi.mockImplementation((async(path:string)=>{
   if(path==='/pets')return [{id:5,name:'Luna',species:'CAT',status:'ACTIVE'}];
   if(path==='/adoptions')throw new Error('Pet already has an active listing.');
  }) as typeof api);
  render(<AdoptionDraftWorkspace/>);await fillDraft();
  fireEvent.click(screen.getByRole('button',{name:'Save adoption draft'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Pet already has an active listing.');
  expect(screen.getByRole('textbox',{name:/Listing headline/})).toHaveValue('Adopt sweet Luna');
 });
 it('shows a retryable pet loading failure instead of an empty-pets message',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Pet endpoint unreachable'));
  render(<AdoptionDraftWorkspace/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Pet endpoint unreachable');
  expect(screen.queryByText('You have no active pet profiles available for an adoption listing.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  expect(await screen.findByRole('option',{name:'Luna (CAT)'})).toBeInTheDocument();
 });
});

describe('Application review and dual handover',()=>{
 it('requires a positive listing ID before accessing owner applications',()=>{render(<AdoptionManagement/>);
  expect(screen.getByRole('button',{name:'View applications (owner)'})).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox',{name:'Adoption listing ID'}),{target:{value:'../bad'}});
  expect(screen.getByRole('button',{name:'View applications (owner)'})).toBeDisabled();
 });
 it('loads owner applications and never offers decisions for rejected ones',async()=>{
  render(<AdoptionManagement/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Adoption listing ID'}),{target:{value:'101'}});
  fireEvent.click(screen.getByRole('button',{name:'View applications (owner)'}));
  expect(await screen.findByText('Application #77')).toBeInTheDocument();
  expect(screen.getByText('Application #78')).toBeInTheDocument();
  expect(screen.getAllByRole('button',{name:'Accept'})).toHaveLength(1);
 });
 it('requires explicit confirmation for an accepting decision',async()=>{
  render(<AdoptionManagement/>);fireEvent.change(screen.getByRole('textbox',{name:'Adoption listing ID'}),{target:{value:'101'}});
  fireEvent.click(screen.getByRole('button',{name:'View applications (owner)'}));
  await screen.findByText('Application #77');
  fireEvent.click(screen.getByRole('button',{name:'Accept'}));
  expect(screen.getByRole('button',{name:'Confirm acceptance'})).toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalledWith('/adoptions/101/applications/77/decision',expect.anything());
  fireEvent.click(screen.getByRole('button',{name:'Confirm acceptance'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/adoptions/101/applications/77/decision',{method:'POST',body:{accept:true}}));
  expect(await screen.findByText(/Ownership does not change until both parties confirm/)).toBeInTheDocument();
 });
 it('keeps the application unchanged when the owner cancels confirmation',async()=>{
  render(<AdoptionManagement/>);fireEvent.change(screen.getByRole('textbox',{name:'Adoption listing ID'}),{target:{value:'101'}});
  fireEvent.click(screen.getByRole('button',{name:'View applications (owner)'}));
  await screen.findByText('Application #77');fireEvent.click(screen.getByRole('button',{name:'Reject'}));
  fireEvent.click(screen.getByRole('button',{name:'Keep undecided'}));
  expect(mockApi).not.toHaveBeenCalledWith('/adoptions/101/applications/77/decision',expect.anything());
 });
 it('requests dual handover confirmation without a fabricated API body',async()=>{
  render(<AdoptionManagement/>);fireEvent.change(screen.getByRole('textbox',{name:'Adoption listing ID'}),{target:{value:'101'}});
  fireEvent.click(screen.getByRole('button',{name:'Review handover confirmation'}));
  expect(mockApi).not.toHaveBeenCalledWith('/adoptions/101/handover',expect.anything());
  fireEvent.click(screen.getByRole('button',{name:'Confirm my handover'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/adoptions/101/handover',{method:'POST',idempotencyKey:expect.any(String)}));
  expect(await screen.findByText(/Ownership remains unchanged until the other party confirms/)).toBeInTheDocument();
 });
 it('handles an unauthorized applicant-list response without leaking a stale list',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Forbidden'));
  render(<AdoptionManagement/>);fireEvent.change(screen.getByRole('textbox',{name:'Adoption listing ID'}),{target:{value:'101'}});
  fireEvent.click(screen.getByRole('button',{name:'View applications (owner)'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  expect(screen.queryByText('Application #77')).not.toBeInTheDocument();
 });
 it('does not claim successful handover on backend errors',async()=>{
  mockApi.mockImplementation((async()=>{throw new Error('Handover has not been matched');}) as typeof api);
  render(<AdoptionManagement/>);fireEvent.change(screen.getByRole('textbox',{name:'Adoption listing ID'}),{target:{value:'101'}});
  fireEvent.click(screen.getByRole('button',{name:'Review handover confirmation'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm my handover'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Handover has not been matched');
  expect(screen.queryByText(/both parties confirmed.*transferred/i)).not.toBeInTheDocument();
 });
});
