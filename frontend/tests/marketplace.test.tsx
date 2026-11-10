// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Row} from '@/lib/types/domain';
import {api} from '@/lib/api/client';
import {MarketplaceCatalog} from '@/components/marketplace/MarketplaceCatalog';
import {SaleListingCard} from '@/components/marketplace/SaleListingCard';
import {InquiryPanel} from '@/components/marketplace/InquiryPanel';
import {SaleDraftWorkspace} from '@/components/marketplace/SaleDraftWorkspace';
import {MarketplaceInquiries} from '@/components/features/MarketplaceInquiries';
import {marketId,marketCurrency,marketPrice,marketSpecies,filterMarket,marketText,saleDraftPayload,
 eligibleMarketPet,inquiryPayload,filterInquiries,marketDate,MarketFormError,type SaleDraftFields} from '@/lib/marketplace/listings';

vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const listings:Row[]=[
 {id:101,title:'Gentle Luna',species:'CAT',description:'Loves quiet homes',generalArea:'Mirpur',askingMinor:125000,currency:'BDT',postedAt:'2026-11-07T08:00:00Z'},
 {id:102,title:'Friendly Bruno',species:'DOG',description:'Needs outdoor play',generalArea:'Uttara',askingMinor:50000,currency:'BDT',postedAt:'2026-11-06T08:00:00Z'},
 {id:103,title:'Rescue Kiwi',species:'BIRD',description:'Small companion',generalArea:'Dhanmondi',askingMinor:30000,currency:'USD',postedAt:'2026-11-05T08:00:00Z'},
];
const activePets:Row[]=[{id:5,name:'Luna',species:'CAT',status:'ACTIVE'},{id:6,name:'Archived',species:'DOG',status:'ARCHIVED'}];
const inquiryRows:Row[]=[
 {id:11,listingId:101,buyerId:9,message:'Can Luna live with children?',status:'OPEN',createdAt:'2026-11-07T12:00:00Z'},
 {id:12,listingId:102,buyerId:10,message:'I want to know the daily care requirements.',status:'CLOSED',createdAt:'2026-11-06T12:00:00Z'},
];
const values:SaleDraftFields={petId:'5',title:'Lovely companion Luna',description:'Healthy friendly cat needing a stable home.',generalArea:'Mirpur',askingMinor:'125000',currency:'BDT',welfareEvidenceFileId:'77'};
function defaultApi(){
 mockApi.mockImplementation((async(path:string)=>{
  if(path==='/pets')return activePets;
  if(path==='/marketplace/pets')return {id:201,status:'DRAFT'};
  if(path==='/marketplace/pets/201/submit')return undefined;
  if(path==='/marketplace/inquiries')return inquiryRows;
  return undefined;
 }) as typeof api);
}
beforeEach(()=>{vi.resetAllMocks();defaultApi();});
afterEach(()=>cleanup());
async function fillSale(){
 await screen.findByRole('option',{name:'Luna (CAT)'});
 fireEvent.change(screen.getByRole('combobox',{name:/Your active pet/}),{target:{value:'5'}});
 fireEvent.change(screen.getByRole('textbox',{name:/Listing headline/}),{target:{value:values.title}});
 fireEvent.change(screen.getByRole('textbox',{name:/Pet description and welfare details/}),{target:{value:values.description}});
 fireEvent.change(screen.getByRole('textbox',{name:/General area/}),{target:{value:values.generalArea}});
 fireEvent.change(screen.getByRole('spinbutton',{name:/Asking price/}),{target:{value:values.askingMinor}});
 fireEvent.change(screen.getByRole('textbox',{name:/Currency/}),{target:{value:'BDT'}});
 fireEvent.change(screen.getByRole('spinbutton',{name:/Private welfare evidence file ID/}),{target:{value:'77'}});
}

describe('Marketplace API contract and safety',()=>{
 it('accepts safely representable positive Oracle IDs',()=>{expect(marketId(5)).toBe('5');expect(marketId(' 201 ')).toBe('201');});
 it('rejects injection routes, zero, decimals and unsafe integers',()=>{
  for(const item of ['../12','1/pets','12?x=1','0','-1','1.5','001',NaN,1.25,'9007199254740993',null,undefined])expect(marketId(item)).toBe('');
 });
 it('normalizes published species and currency',()=>{
  expect(marketSpecies({SPECIES:' cat '})).toBe('CAT');expect(marketCurrency({CURRENCY:' bdt '})).toBe('BDT');expect(marketCurrency({currency:'../../a'})).toBe('');
 });
 it('does not fabricate missing or invalid asking prices',()=>{
  expect(marketPrice({askingMinor:125000})).toBe(125000);expect(marketPrice({})).toBeNull();expect(marketPrice({askingMinor:0})).toBeNull();expect(marketPrice({askingMinor:'x'})).toBeNull();
 });
 it('filters approved listings by public fields without mutation',()=>{
  expect(filterMarket(listings,'Mirpur','CAT','NEWEST').map(x=>x.id)).toEqual([101]);expect(listings).toHaveLength(3);
 });
 it('rejects malformed listing IDs returned by an API',()=>{
  expect(filterMarket([...listings,{id:'../bad',title:'Unsafe'}],'','ALL','NEWEST')).toHaveLength(3);
 });
 it('sorts prices only within currency groups, preserving the original order by default',()=>{
  expect(filterMarket(listings,'','ALL','NEWEST').map(x=>x.id)).toEqual([101,102,103]);
  expect(filterMarket(listings,'','ALL','PRICE_ASC').map(x=>x.id)).toEqual([102,101,103]);
  expect(filterMarket(listings,'','ALL','PRICE_DESC').map(x=>x.id)).toEqual([101,102,103]);
 });
 it('validates UTF-8 byte lengths rather than ASCII length only',()=>{
  expect(marketText('  Rescue cat  ','title','Headline',1,180)).toBe('Rescue cat');
  expect(()=>marketText('🐾'.repeat(1001),'description','Pet description',20,4000)).toThrow(/4000 UTF-8/);
 });
 it('excludes archived pets and invalid identifiers from eligible seller choices',()=>{
  expect(eligibleMarketPet(activePets[0])).toBe(true);expect(eligibleMarketPet(activePets[1])).toBe(false);expect(eligibleMarketPet({id:'../x',status:'ACTIVE'})).toBe(false);
 });
 it('builds the exact seller draft payload in minor units',()=>{
  expect(saleDraftPayload(values,activePets)).toEqual({petId:5,title:values.title,description:values.description,
   generalArea:'Mirpur',askingMinor:125000,currency:'BDT',welfareEvidenceFileId:77});
 });
 it('rejects a pet not in the authenticated active pet list',()=>{
  expect(()=>saleDraftPayload({...values,petId:'6'},activePets)).toThrow(MarketFormError);
  expect(()=>saleDraftPayload({...values,petId:'999'},activePets)).toThrow(/active pet/);
 });
 it('rejects invalid prices, currencies and reviewer-only file IDs',()=>{
  for(const askingMinor of ['0','-1','1.2','1e3','9007199254740993'])expect(()=>saleDraftPayload({...values,askingMinor},activePets)).toThrow(/minor/);
  expect(()=>saleDraftPayload({...values,currency:'BDTX'},activePets)).toThrow(/three-letter/);
  expect(()=>saleDraftPayload({...values,welfareEvidenceFileId:'../77'},activePets)).toThrow(/file ID/);
 });
 it('rejects too-short or oversized drafts before network calls',()=>{
  expect(()=>saleDraftPayload({...values,description:'tiny'},activePets)).toThrow(/at least 20/);
  expect(()=>saleDraftPayload({...values,title:'x'.repeat(181)},activePets)).toThrow(/180 UTF-8/);
 });
 it('accepts only a positive listing ID with a private inquiry message',()=>{
  expect(inquiryPayload('101','  Is this cat comfortable with children? ')).toEqual({listingId:101,message:'Is this cat comfortable with children?'});
  expect(()=>inquiryPayload('101/submit','Is the pet healthy?')).toThrow(/listing ID/);
 });
 it('blocks short and oversized inquiry messages',()=>{
  expect(()=>inquiryPayload('101','hi')).toThrow(/at least 5/);
  expect(()=>inquiryPayload('101','🐾'.repeat(501))).toThrow(/2000 UTF-8/);
 });
 it('filters only safe authorized inquiry rows by status and text',()=>{
  expect(filterInquiries(inquiryRows,'children','OPEN').map(r=>r.id)).toEqual([11]);
  expect(filterInquiries([...inquiryRows,{id:'../bad',listingId:101,message:'x',status:'OPEN'}],'','ALL')).toHaveLength(2);
 });
 it('formats valid dates and does not show invalid dates as now',()=>{
  expect(marketDate('2026-11-05T12:00:00Z')).not.toBe('Date unavailable');expect(marketDate('no date')).toBe('Date unavailable');
 });
 it('uses catalog and detail routes separately, never a checkout action',()=>{
  const catalog=readFileSync(join(process.cwd(),'app/(public)/marketplace/page.tsx'),'utf8');
  const detail=readFileSync(join(process.cwd(),'app/(public)/marketplace/[id]/page.tsx'),'utf8');
  expect(catalog).toContain("safePublic('/marketplace/pets')");expect(catalog).toContain('<MarketplaceCatalog');expect(catalog).not.toContain('await params');
  expect(detail).toContain('marketId(raw)');expect(detail).toContain('InquiryPanel');expect(detail).not.toContain('checkout');
 });
});

describe('Approved public pet marketplace',()=>{
 it('displays safe listing links and prices, not a purchase button',()=>{
  render(<MarketplaceCatalog items={listings} error={null}/>);
  expect(screen.getByRole('heading',{name:'Pet marketplace'})).toBeInTheDocument();
  expect(screen.getAllByRole('link',{name:/View listing/})[0]).toHaveAttribute('href','/marketplace/101');
  expect(screen.queryByRole('button',{name:/buy now|checkout/i})).not.toBeInTheDocument();
 });
 it('filters listings by species and keyword without fetching again',()=>{
  render(<MarketplaceCatalog items={listings} error={null}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Filter by species'}),{target:{value:'DOG'}});
  expect(screen.getByText('Friendly Bruno')).toBeInTheDocument();expect(screen.queryByText('Gentle Luna')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox',{name:'Search pet listings'}),{target:{value:'nothing nearby'}});
  expect(screen.getByText('No matching pet listings')).toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('sorts published cards by price without contacting an API',()=>{
  render(<MarketplaceCatalog items={listings} error={null}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Sort listings'}),{target:{value:'PRICE_ASC'}});
  const cards=screen.getAllByRole('link',{name:/View listing/});
  expect(cards[0]).toHaveAttribute('href','/marketplace/102');expect(mockApi).not.toHaveBeenCalled();
 });
 it('shows honest empty and outage states',()=>{
  const {rerender}=render(<MarketplaceCatalog items={[]} error={null}/>);
  expect(screen.getByText('No approved marketplace listings')).toBeInTheDocument();
  rerender(<MarketplaceCatalog items={[]} error="Service unavailable"/>);
  expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
  expect(screen.queryByText('No approved marketplace listings')).not.toBeInTheDocument();
 });
 it('hides cards with unsafe listing IDs and missing prices',()=>{
  const {container}=render(<SaleListingCard item={{id:'../../bad',title:'Unsafe'}}/>);
  expect(container).toBeEmptyDOMElement();
  const {unmount}=render(<SaleListingCard item={{id:112,title:'Missing price'}}/>);
  expect(screen.getByText('Price unavailable')).toBeInTheDocument();unmount();
 });
});

describe('Private marketplace inquiry submission',()=>{
 it('posts the exact private body and states that no sale occurred',async()=>{
  render(<InquiryPanel id="101"/>);
  fireEvent.change(screen.getByRole('textbox',{name:/Your question/}),{target:{value:'Can Luna stay indoors safely?'}});
  fireEvent.click(screen.getByRole('button',{name:'Send inquiry'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/marketplace/inquiries',{method:'POST',body:{listingId:101,message:'Can Luna stay indoors safely?'}}));
  expect(await screen.findByText(/Private inquiry sent/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Inquiry sent'})).toBeDisabled();
 });
 it('rejects invalid listing IDs before any request',()=>{
  render(<InquiryPanel id="101/submit"/>);
  expect(screen.getByRole('button',{name:'Send inquiry'})).toBeDisabled();expect(mockApi).not.toHaveBeenCalled();
 });
 it('rejects short and UTF-8 oversized messages before POST',()=>{
  render(<InquiryPanel id="101"/>);
  fireEvent.change(screen.getByRole('textbox',{name:/Your question/}),{target:{value:'hi'}});
  fireEvent.click(screen.getByRole('button',{name:'Send inquiry'}));
  expect(mockApi).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox',{name:/Your question/}),{target:{value:'🐾'.repeat(501)}});
  fireEvent.click(screen.getByRole('button',{name:'Send inquiry'}));
  expect(mockApi).not.toHaveBeenCalled();
  expect(screen.getByText(/2000 UTF-8 bytes/)).toBeInTheDocument();
 });
 it('preserves the text and displays API failures without claiming success',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Seller unavailable'));
  render(<InquiryPanel id="101"/>);
  fireEvent.change(screen.getByRole('textbox',{name:/Your question/}),{target:{value:'Is the cat vaccinated already?'}});
  fireEvent.click(screen.getByRole('button',{name:'Send inquiry'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Seller unavailable');
  expect(screen.getByRole('textbox',{name:/Your question/})).toHaveValue('Is the cat vaccinated already?');
  expect(screen.getByRole('button',{name:'Send inquiry'})).toBeEnabled();
 });
});

describe('Seller-only private draft and moderation submission',()=>{
 it('loads only active pets as options',async()=>{
  render(<SaleDraftWorkspace/>);
  expect(await screen.findByRole('option',{name:'Luna (CAT)'})).toBeInTheDocument();
  expect(screen.queryByRole('option',{name:/Archived/})).not.toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledWith('/pets',{signal:expect.any(AbortSignal)});
 });
 it('creates exact draft, keeps the ID and submits separately for review',async()=>{
  render(<SaleDraftWorkspace/>);await fillSale();
  fireEvent.click(screen.getByRole('button',{name:'Save seller draft'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/marketplace/pets',{method:'POST',body:{
   petId:5,title:values.title,description:values.description,generalArea:'Mirpur',askingMinor:125000,currency:'BDT',welfareEvidenceFileId:77}}));
  expect(await screen.findByText(/Private sale draft #201 saved/)).toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalledWith('/marketplace/pets/201/submit',expect.anything());
  fireEvent.click(screen.getByRole('button',{name:'Submit draft for review'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/marketplace/pets/201/submit',{method:'POST'}));
  expect(await screen.findByText(/Listing #201 submitted for moderator review/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Submitted for review'})).toBeDisabled();
 });
 it('blocks short description without calling the draft API',async()=>{
  render(<SaleDraftWorkspace/>);await fillSale();
  fireEvent.change(screen.getByRole('textbox',{name:/Pet description and welfare details/}),{target:{value:'Tiny'}});
  fireEvent.click(screen.getByRole('button',{name:'Save seller draft'}));
  expect(mockApi).not.toHaveBeenCalledWith('/marketplace/pets',expect.anything());
 });
 it('blocks invalid minor-unit prices and evidence IDs without network calls',async()=>{
  render(<SaleDraftWorkspace/>);await fillSale();
  fireEvent.change(screen.getByRole('spinbutton',{name:/Asking price/}),{target:{value:'0'}});
  fireEvent.click(screen.getByRole('button',{name:'Save seller draft'}));
  expect(mockApi).not.toHaveBeenCalledWith('/marketplace/pets',expect.anything());
  fireEvent.change(screen.getByRole('spinbutton',{name:/Asking price/}),{target:{value:'10000'}});
  fireEvent.change(screen.getByRole('spinbutton',{name:/Private welfare evidence file ID/}),{target:{value:'0'}});
  fireEvent.click(screen.getByRole('button',{name:'Save seller draft'}));
  expect(mockApi).not.toHaveBeenCalledWith('/marketplace/pets',expect.anything());
 });
 it('does not show success or clear fields if seller verification fails',async()=>{
  mockApi.mockImplementation((async(path:string)=>{
   if(path==='/pets')return activePets;
   if(path==='/marketplace/pets')throw new Error('Approved seller capability required');
   return undefined;
  }) as typeof api);
  render(<SaleDraftWorkspace/>);await fillSale();
  fireEvent.click(screen.getByRole('button',{name:'Save seller draft'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Approved seller capability required');
  expect(screen.getByRole('textbox',{name:/Listing headline/})).toHaveValue(values.title);
 });
 it('shows a retryable pet list error instead of a no-pets success state',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Pet service unavailable'));
  render(<SaleDraftWorkspace/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Pet service unavailable');
  expect(screen.getByRole('button',{name:'Save seller draft'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  expect(await screen.findByRole('option',{name:'Luna (CAT)'})).toBeInTheDocument();
 });
 it('does not claim published after a failed moderation submission',async()=>{
  mockApi.mockImplementation((async(path:string)=>{
   if(path==='/pets')return activePets;
   if(path==='/marketplace/pets')return {id:201,status:'DRAFT'};
   if(path==='/marketplace/pets/201/submit')throw new Error('Review submission rejected');
   return undefined;
  }) as typeof api);
  render(<SaleDraftWorkspace/>);await fillSale();fireEvent.click(screen.getByRole('button',{name:'Save seller draft'}));
  await screen.findByText(/Private sale draft #201 saved/);
  fireEvent.click(screen.getByRole('button',{name:'Submit draft for review'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Review submission rejected');
  expect(screen.getByRole('button',{name:'Submit draft for review'})).toBeEnabled();
 });
 it('requires deliberate create-another action to clear a saved draft',async()=>{
  render(<SaleDraftWorkspace/>);await fillSale();fireEvent.click(screen.getByRole('button',{name:'Save seller draft'}));
  await screen.findByText(/Private sale draft #201 saved/);
  expect(screen.getByRole('textbox',{name:/Listing headline/})).toHaveValue(values.title);
  fireEvent.click(screen.getByRole('button',{name:'Create another listing'}));
  expect(screen.getByRole('textbox',{name:/Listing headline/})).toHaveValue('');
 });
});

describe('Authorized inquiry history',()=>{
 it('loads only private /marketplace/inquiries and displays status',async()=>{
  render(<MarketplaceInquiries/>);
  expect(await screen.findByText('Can Luna live with children?')).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledWith('/marketplace/inquiries',{signal:expect.any(AbortSignal)});
  expect(screen.getByText(/^CLOSED\s*·/)).toBeInTheDocument();
 });
 it('filters search and statuses locally',async()=>{
  render(<MarketplaceInquiries/>);await screen.findByText('Can Luna live with children?');
  fireEvent.change(screen.getByRole('combobox',{name:'Filter inquiries by status'}),{target:{value:'CLOSED'}});
  expect(screen.queryByText('Can Luna live with children?')).not.toBeInTheDocument();
  expect(screen.getByText('I want to know the daily care requirements.')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox',{name:'Search private inquiries'}),{target:{value:'not found'}});
  expect(screen.getByText('No matching inquiries')).toBeInTheDocument();
 });
 it('distinguishes no inquiries from unauthorized/private API failure',async()=>{
  mockApi.mockResolvedValueOnce([] as never);
  const {unmount}=render(<MarketplaceInquiries/>);
  expect(await screen.findByText('No private inquiries yet')).toBeInTheDocument();unmount();
  mockApi.mockRejectedValueOnce(new Error('Access denied'));
  render(<MarketplaceInquiries/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
  expect(screen.queryByText('No private inquiries yet')).not.toBeInTheDocument();
 });
 it('allows refreshing a private inquiry list',async()=>{
  render(<MarketplaceInquiries/>);await screen.findByText('Can Luna live with children?');
  fireEvent.click(screen.getByRole('button',{name:'Refresh inquiries'}));
  await waitFor(()=>expect(mockApi.mock.calls.filter(([path])=>path==='/marketplace/inquiries')).toHaveLength(2));
 });
});
