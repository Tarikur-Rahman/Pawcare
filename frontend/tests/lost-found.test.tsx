// @vitest-environment jsdom
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {api} from '@/lib/api/client';
import {LostFoundCatalog} from '@/components/lost-found/LostFoundCatalog';
import {SightingForm} from '@/components/lost-found/SightingForm';
import {ReunionClaimForm} from '@/components/lost-found/ReunionClaimForm';
import {LostFoundDraftWorkspace} from '@/components/lost-found/LostFoundDraftWorkspace';
import {LostFoundManagement} from '@/components/features/LostFoundManagement';
import {lostId,lostCategory,lostDate,filterLostReports,lostText,observedInstant,lostDraftPayload,sightingPayload,proofAssetId,LostFormError} from '@/lib/lost-found/reports';
import type {Row} from '@/lib/types/domain';

vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const reports:Row[]=[
 {id:101,category:'LOST',species:'CAT',generalArea:'Dhanmondi',observedAt:'2026-11-05T08:00:00Z'},
 {id:102,category:'FOUND',species:'DOG',generalArea:'Uttara',observedAt:'2026-11-06T08:00:00Z'},
 {id:103,category:'LOST',species:'BIRD',generalArea:'Mirpur',observedAt:'2026-11-07T08:00:00Z'},
];
function localDateTime(date:Date):string {
 const n=(v:number)=>String(v).padStart(2,'0');
 return `${date.getFullYear()}-${n(date.getMonth()+1)}-${n(date.getDate())}T${n(date.getHours())}:${n(date.getMinutes())}`;
}
const pastTime=()=>localDateTime(new Date(Date.now()-60*60*1000));
function defaultApi(){
 mockApi.mockImplementation((async(path:string)=>{
  if(path==='/lost-found')return {id:301,status:'DRAFT'};
  if(path==='/lost-found/101/sightings')return [{id:801,approximateArea:'Dhanmondi',observedAt:'2026-11-05T08:00:00Z',description:'Near the park',status:'SUBMITTED'}];
  if(path==='/lost-found/102/sightings')return [];
  if(path==='/lost-found/101/claims')return {id:901,status:'SUBMITTED'};
  if(path==='/lost-found/101/claims/901/confirm-reunion')return {status:'AWAITING_OTHER_PARTY'};
  return {id:55,status:'SUBMITTED'};
 }) as typeof api);
}
beforeEach(()=>{vi.resetAllMocks();defaultApi();});
afterEach(()=>cleanup());

function fillSighting(){
 fireEvent.change(screen.getByRole('textbox',{name:/Approximate area/}),{target:{value:'Uttara sector'} });
 fireEvent.change(screen.getByLabelText(/When did you see the pet\?/i),{target:{value:pastTime()}});
 fireEvent.change(screen.getByRole('textbox',{name:/What did you see/}),{target:{value:'Small brown dog with blue collar.'}});
}
function fillDraft(){
 fireEvent.change(screen.getByRole('combobox',{name:/Report type/}),{target:{value:'LOST'}});
 fireEvent.change(screen.getByRole('textbox',{name:/Species/}),{target:{value:'Cat'}});
 fireEvent.change(screen.getByRole('textbox',{name:/General area/}),{target:{value:'Mirpur'}});
 fireEvent.change(screen.getByLabelText(/Last observed at/i),{target:{value:pastTime()}});
 fireEvent.change(screen.getByRole('textbox',{name:/Description/}),{target:{value:'Small grey cat with a blue collar.'}});
}

describe('Lost & found API contract helpers',()=>{
 it('accepts safe positive Oracle IDs',()=>{expect(lostId(101)).toBe('101');expect(lostId(' 101 ')).toBe('101');expect(lostId('001')).toBe('');});
 it('rejects unsafe URL fragments and non-integer keys',()=>{for(const item of ['../12','12/sightings','12?x=1','0','-1','1.5','9007199254740993',3.14,null,undefined])expect(lostId(item)).toBe('');});
 it('normalizes Oracle category values',()=>{expect(lostCategory({CATEGORY:' lost '})).toBe('LOST');expect(lostCategory({category:'FOUND'})).toBe('FOUND');});
 it('formats a valid observedAt and guards missing dates',()=>{expect(lostDate('2026-11-05T12:00:00Z')).not.toBe('Date unavailable');expect(lostDate('invalid')).toBe('Date unavailable');});
 it('searches public fields without exposing private description',()=>{expect(filterLostReports(reports,'dhan','ALL','ALL').map(r=>r.id)).toEqual([101]);expect(filterLostReports(reports,'101','ALL','ALL')).toHaveLength(1);});
 it('filters lost/found categories and species independently',()=>{expect(filterLostReports(reports,'','FOUND','DOG').map(r=>r.id)).toEqual([102]);expect(filterLostReports(reports,'','LOST','CAT').map(r=>r.id)).toEqual([101]);});
 it('rejects unsafe public IDs even if returned by API',()=>{expect(filterLostReports([...reports,{id:'../../bad',category:'LOST',species:'CAT'}],'','ALL','ALL')).toHaveLength(3);});
 it('enforces trimmed character minimum and UTF-8 byte maximum',()=>{expect(lostText('  CAT  ','species','Species',1,80)).toBe('CAT');expect(()=>lostText('🐾'.repeat(1001),'description','Description',10,4000)).toThrow(/4000 UTF-8/);});
 it('accepts past local observation times and serializes UTC',()=>{const now=new Date(2026,10,8,12,0);const past=localDateTime(new Date(2026,10,8,11,30));expect(observedInstant(past,now)).toBe(new Date(2026,10,8,11,30).toISOString());});
 it('rejects non-existent dates and future dates over ten minutes',()=>{const now=new Date(2026,10,8,12,0);expect(()=>observedInstant('2026-02-31T10:00',now)).toThrow(LostFormError);expect(()=>observedInstant(localDateTime(new Date(2026,10,8,12,11)),now)).toThrow(/10 minutes/);});
 it('requires valid category and server field lengths in report drafts',()=>{
  const base={category:'LOST',species:'Cat',description:'Small grey tabby',generalArea:'Dhanmondi',observedAt:localDateTime(new Date(2026,10,8,11,30))};
  expect(lostDraftPayload(base,new Date(2026,10,8,12,0))).toEqual({...base,observedAt:new Date(2026,10,8,11,30).toISOString()});
  expect(()=>lostDraftPayload({...base,category:'OPEN'},new Date(2026,10,8,12,0))).toThrow(/Lost or Found/);
  expect(()=>lostDraftPayload({...base,description:'tiny'},new Date(2026,10,8,12,0))).toThrow(/at least 10/);
 });
 it('validates sightings using private fields and no other keys',()=>{
  const observedAt=localDateTime(new Date(2026,10,8,11,30));
  expect(sightingPayload({approximateArea:'Uttara',description:'Blue collar',observedAt},new Date(2026,10,8,12,0))).toEqual({approximateArea:'Uttara',description:'Blue collar',observedAt:new Date(2026,10,8,11,30).toISOString()});
 });
 it('rejects oversized sighting text and invalid proof IDs',()=>{
  expect(()=>sightingPayload({approximateArea:'Near park',description:'🐾'.repeat(501),observedAt:pastTime()})).toThrow(/2000 UTF-8/);
  expect(proofAssetId('23')).toBe(23);expect(()=>proofAssetId('23?x=1')).toThrow(/evidence file ID/);
 });
 it('routes public catalog separately from detail without unsafe params',()=>{
  const route=readFileSync(join(process.cwd(),'app/(public)/lost-found/page.tsx'),'utf8');
  expect(route).toContain("safePublic('/lost-found')");expect(route).toContain('<LostFoundCatalog');expect(route).not.toContain('await params');
 });
 it('only renders public report metadata in details route',()=>{
  const route=readFileSync(join(process.cwd(),'app/(public)/lost-found/[id]/page.tsx'),'utf8');
  expect(route).toContain('lostId(raw)');expect(route).toContain('SightingForm');expect(route).not.toContain("str(item,'description')");
 });
});

describe('Public lost & found catalog',()=>{
 it('renders safe public cards and detail routes',()=>{render(<LostFoundCatalog items={reports} error={null}/>);expect(screen.getByRole('heading',{name:'Lost & found pets'})).toBeInTheDocument();expect(screen.getAllByRole('link',{name:/View report/})[0]).toHaveAttribute('href','/lost-found/101');});
 it('filters category and search without refetching',()=>{
  render(<LostFoundCatalog items={reports} error={null}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Filter by report type'}),{target:{value:'FOUND'}});
  expect(screen.getByText('DOG')).toBeInTheDocument();expect(screen.queryByText('CAT')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox',{name:'Search lost and found reports'}),{target:{value:'Mirpur'}});
  expect(screen.getByText('No matching reports')).toBeInTheDocument();expect(mockApi).not.toHaveBeenCalled();
 });
 it('filters species and shows no-match guidance',()=>{render(<LostFoundCatalog items={reports} error={null}/>);fireEvent.change(screen.getByRole('combobox',{name:'Filter by species'}),{target:{value:'CAT'}});expect(screen.getByText('CAT')).toBeInTheDocument();expect(screen.queryByText('DOG')).not.toBeInTheDocument();});
 it('distinguishes empty catalog from failed fetch',()=>{const {rerender}=render(<LostFoundCatalog items={[]} error={null}/>);expect(screen.getByText('No open public reports')).toBeInTheDocument();rerender(<LostFoundCatalog items={[]} error="API unavailable"/>);expect(screen.getByRole('alert')).toHaveTextContent('API unavailable');expect(screen.queryByText('No open public reports')).not.toBeInTheDocument();});
});

describe('Private sighting submission',()=>{
 it('submits the exact private API body and no false reunion status',async()=>{
  render(<SightingForm id="101"/>);fillSighting();fireEvent.click(screen.getByRole('button',{name:'Submit sighting privately'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/lost-found/101/sightings',{method:'POST',body:{approximateArea:'Uttara sector',observedAt:expect.any(String),description:'Small brown dog with blue collar.'}}));
  expect(await screen.findByText(/Sighting submitted privately/)).toBeInTheDocument();expect(screen.getByRole('textbox',{name:/What did you see/})).toHaveValue('');
 });
 it('rejects blank details without POST',()=>{render(<SightingForm id="101"/>);fireEvent.submit(screen.getByRole('button',{name:'Submit sighting privately'}).closest('form')!);expect(mockApi).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('Approximate area');});
 it('rejects invalid report IDs before network calls',()=>{render(<SightingForm id="../101"/>);expect(screen.getByRole('button',{name:'Submit sighting privately'})).toBeDisabled();expect(mockApi).not.toHaveBeenCalled();});
 it('preserves inputs and reports errors when POST fails',async()=>{
  mockApi.mockRejectedValue(new Error('Not allowed to report on this case'));
  render(<SightingForm id="101"/>);fillSighting();fireEvent.click(screen.getByRole('button',{name:'Submit sighting privately'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed');expect(screen.getByRole('textbox',{name:/What did you see/})).toHaveValue('Small brown dog with blue collar.');expect(screen.queryByText(/Sighting submitted privately/)).not.toBeInTheDocument();
 });
});

describe('Private ownership claims',()=>{
 it('rejects malformed evidence IDs without any API call',()=>{render(<ReunionClaimForm id="101"/>);fireEvent.change(screen.getByRole('spinbutton',{name:/Private evidence file ID/}),{target:{value:'0'}});fireEvent.submit(screen.getByRole('button',{name:'Submit private claim'}).closest('form')!);expect(mockApi).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('valid private evidence');});
 it('submits only proofAssetId and does not claim verified reunion',async()=>{
  render(<ReunionClaimForm id="101"/>);fireEvent.change(screen.getByRole('spinbutton',{name:/Private evidence file ID/}),{target:{value:'221'}});fireEvent.click(screen.getByRole('button',{name:'Submit private claim'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/lost-found/101/claims',{method:'POST',body:{proofAssetId:221}}));
  expect(await screen.findByText(/Ownership claim submitted/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Claim submitted'})).toBeDisabled();
 });
 it('retains evidence ID and displays backend rejection',async()=>{mockApi.mockRejectedValue(new Error('Proof scan pending'));render(<ReunionClaimForm id="101"/>);fireEvent.change(screen.getByRole('spinbutton',{name:/Private evidence file ID/}),{target:{value:'11'}});fireEvent.click(screen.getByRole('button',{name:'Submit private claim'}));expect(await screen.findByRole('alert')).toHaveTextContent('Proof scan pending');expect(screen.getByRole('spinbutton',{name:/Private evidence file ID/})).toHaveValue(11);});
});

describe('Owner lost/found draft',()=>{
 it('creates an exact LOST report draft and records its private ID',async()=>{
  render(<LostFoundDraftWorkspace/>);fillDraft();fireEvent.click(screen.getByRole('button',{name:'Save private report draft'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/lost-found',{method:'POST',body:{category:'LOST',species:'Cat',description:'Small grey cat with a blue collar.',generalArea:'Mirpur',observedAt:expect.any(String)}}));
  expect(await screen.findByText(/Private draft #301 saved/)).toBeInTheDocument();expect(screen.getByText(/does not provide a submit endpoint/)).toBeInTheDocument();
 });
 it('rejects short description without creating a report',()=>{render(<LostFoundDraftWorkspace/>);fillDraft();fireEvent.change(screen.getByRole('textbox',{name:/Description/}),{target:{value:'tiny'}});fireEvent.submit(screen.getByRole('button',{name:'Save private report draft'}).closest('form')!);expect(mockApi).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('at least 10');});
 it('rejects a future observation time without creating a report',()=>{render(<LostFoundDraftWorkspace/>);fillDraft();fireEvent.change(screen.getByLabelText(/Last observed at/i),{target:{value:localDateTime(new Date(Date.now()+60*60*1000))}});fireEvent.submit(screen.getByRole('button',{name:'Save private report draft'}).closest('form')!);expect(mockApi).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('10 minutes');});
 it('keeps draft fields and shows error on backend failure',async()=>{
  mockApi.mockRejectedValue(new Error('Moderation unavailable'));render(<LostFoundDraftWorkspace/>);fillDraft();fireEvent.click(screen.getByRole('button',{name:'Save private report draft'}));expect(await screen.findByRole('alert')).toHaveTextContent('Moderation unavailable');expect(screen.getByRole('textbox',{name:/Description/})).toHaveValue('Small grey cat with a blue collar.');
 });
 it('resets draft form only on deliberate create-another action',async()=>{
  render(<LostFoundDraftWorkspace/>);fillDraft();fireEvent.click(screen.getByRole('button',{name:'Save private report draft'}));await screen.findByRole('button',{name:'Create another draft'});
  fireEvent.click(screen.getByRole('button',{name:'Create another draft'}));expect(screen.getByRole('textbox',{name:/Description/})).toHaveValue('');expect(screen.getByRole('button',{name:'Save private report draft'})).toBeEnabled();
 });
});

describe('Owner-only sightings and verified reunions',()=>{
 it('blocks unsafe report IDs and never queries them',()=>{render(<LostFoundManagement/>);fireEvent.change(screen.getByRole('textbox',{name:/Lost\/found report ID/}),{target:{value:'1/claims'}});expect(screen.getByRole('button',{name:'View private sightings (owner)'})).toBeDisabled();expect(mockApi).not.toHaveBeenCalled();});
 it('loads private sightings by owner-only endpoint',async()=>{
  render(<LostFoundManagement/>);fireEvent.change(screen.getByRole('textbox',{name:/Lost\/found report ID/}),{target:{value:'101'}});fireEvent.click(screen.getByRole('button',{name:'View private sightings (owner)'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/lost-found/101/sightings'));expect(await screen.findByText(/Near the park/)).toBeInTheDocument();
 });
 it('does not leak previous sightings after switching reports',async()=>{
  render(<LostFoundManagement/>);fireEvent.change(screen.getByRole('textbox',{name:/Lost\/found report ID/}),{target:{value:'101'}});fireEvent.click(screen.getByRole('button',{name:'View private sightings (owner)'}));await screen.findByText(/Near the park/);
  fireEvent.change(screen.getByRole('textbox',{name:/Lost\/found report ID/}),{target:{value:'102'}});expect(screen.queryByText(/Near the park/)).not.toBeInTheDocument();
 });
 it('requires explicit confirmation and never fabricates reunion',async()=>{
  render(<LostFoundManagement/>);fireEvent.change(screen.getByRole('textbox',{name:/Lost\/found report ID/}),{target:{value:'101'}});
  fireEvent.change(screen.getByRole('textbox',{name:/Verified claim ID/}),{target:{value:'901'}});
  fireEvent.click(screen.getByRole('button',{name:'Review reunion confirmation'}));expect(mockApi).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Confirm my reunion'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/lost-found/101/claims/901/confirm-reunion',{method:'POST'}));
  expect(await screen.findByText(/other party must still confirm/)).toBeInTheDocument();
 });
 it('lets the user decline confirmation with no request',()=>{render(<LostFoundManagement/>);fireEvent.change(screen.getByRole('textbox',{name:/Lost\/found report ID/}),{target:{value:'101'}});fireEvent.change(screen.getByRole('textbox',{name:/Verified claim ID/}),{target:{value:'901'}});fireEvent.click(screen.getByRole('button',{name:'Review reunion confirmation'}));fireEvent.click(screen.getByRole('button',{name:'Not yet'}));expect(mockApi).not.toHaveBeenCalled();});
 it('fails closed on owner-only sighting lookup errors',async()=>{mockApi.mockRejectedValue(new Error('Forbidden'));render(<LostFoundManagement/>);fireEvent.change(screen.getByRole('textbox',{name:/Lost\/found report ID/}),{target:{value:'101'}});fireEvent.click(screen.getByRole('button',{name:'View private sightings (owner)'}));expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');expect(screen.queryByText('Private sightings for report #101')).not.toBeInTheDocument();});
});
