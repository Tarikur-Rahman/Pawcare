// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {api} from '@/lib/api/client';
import {FavoritesWorkspace} from '@/components/features/FavoritesWorkspace';
import {FavoriteButton} from '@/components/features/FavoriteButton';
import {ReportListing} from '@/components/features/ReportListing';
import {
 contentId,favoriteLink,favoriteLabel,filterFavorites,validFavorite,favoritePayload,reportPayload,
 ContentFormError,REPORT_REASONS,FAVORITE_TYPES
} from '@/lib/content/moderation';
import type {Row} from '@/lib/types/domain';

vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const saved:Row[]=[
 {id:11,entityType:'ADOPTION',entityId:101},
 {id:12,entityType:'PET_SALE',entityId:202},
 {id:13,entityType:'LOST_FOUND',entityId:303},
 {id:14,entityType:'FOOD_PRODUCT',entityId:404},
];
const mockSaved=()=>{mockApi.mockImplementation(async (path)=>path==='/favorites'?saved:undefined as never);};

beforeEach(()=>{mockApi.mockReset();});
afterEach(()=>cleanup());

describe('Content IDs and favorites contract',()=>{
 it('accepts only safe, positive Oracle identifiers',()=>{
  expect(contentId(12)).toBe('12');expect(contentId(' 007 ')).toBe('7');expect(contentId('9007199254740991')).toBe('9007199254740991');
 });
 it('rejects injection, decimals, overflow, zero and empty identifiers',()=>{
  for(const value of ['../1','1/submit','1.3','-7','0','','Infinity','1e3','9007199254740993',null])expect(contentId(value)).toBe('');
 });
 it('makes safe deep links for all four supported listing kinds',()=>{
  expect(saved.map(favoriteLink)).toEqual(['/adopt/101','/marketplace/202','/lost-found/303','/shop/404']);
  expect(saved.map(favoriteLabel)).toEqual(['Adoption','Pet marketplace','Lost & found','Food product']);
 });
 it('never emits unsupported or unsafe saved URLs',()=>{
  expect(favoriteLink({id:10,entityType:'DONATION',entityId:1})).toBe('');
  expect(favoriteLink({id:10,entityType:'PET_SALE',entityId:'../../42'})).toBe('');
 });
 it('requires both a valid favorite row ID and public listing ID',()=>{
  expect(validFavorite(saved[0])).toBe(true);
  expect(validFavorite({entityType:'ADOPTION',entityId:101})).toBe(false);
  expect(validFavorite({id:11,entityType:'ADOPTION',entityId:0})).toBe(false);
 });
 it('filters by type and ID without changing original records',()=>{
  const original=[...saved];expect(filterFavorites(saved,'', 'ADOPTION')).toEqual([saved[0]]);
  expect(filterFavorites(saved,'202','ALL')).toEqual([saved[1]]);
  expect(filterFavorites(saved,'food','ALL')).toEqual([saved[3]]);
  expect(saved).toEqual(original);
 });
 it('builds the exact favorite POST body',()=>{
  expect(favoritePayload(' pet_sale ','00202')).toEqual({entityType:'PET_SALE',entityId:202});
 });
 it('rejects unsupported favorite types and dangerous IDs',()=>{
  expect(()=>favoritePayload('DONATION','12')).toThrow(ContentFormError);
  expect(()=>favoritePayload('ADOPTION','12/delete')).toThrow(/identifier/);
 });
 it('lists only supported and unique report reasons',()=>{
  expect(FAVORITE_TYPES).toHaveLength(4);expect(new Set(REPORT_REASONS).size).toBe(7);
 });
});

describe('Private content report contract',()=>{
 it('builds an exact private report body',()=>{
  expect(reportPayload(' adoption ','101','privacy',' Nearby owner detail ')).toEqual({entityType:'ADOPTION',entityId:101,reasonCode:'PRIVACY',details:'Nearby owner detail'});
 });
 it('allows optional details without submitting an empty string',()=>{
  expect(reportPayload('FOOD_PRODUCT','4','SPAM','   ')).toEqual({entityType:'FOOD_PRODUCT',entityId:4,reasonCode:'SPAM',details:null});
 });
 it('allows reporting a donation but not adding it to favorites',()=>{
  expect(reportPayload('DONATION','4','OTHER','').entityType).toBe('DONATION');
  expect(()=>favoritePayload('DONATION','4')).toThrow();
 });
 it('rejects unsupported report types, unsafe IDs and unknown reasons',()=>{
  expect(()=>reportPayload('USER','4','FRAUD','')).toThrow(ContentFormError);
  expect(()=>reportPayload('ADOPTION','x/2','FRAUD','')).toThrow(/identifier/);
  expect(()=>reportPayload('ADOPTION','42','HACK','')).toThrow(/reason/);
 });
 it('uses UTF-8 bytes for the backend private details limit',()=>{
  expect(reportPayload('ADOPTION','1','OTHER','🐾'.repeat(750)).details).toHaveLength(1500);
  expect(()=>reportPayload('ADOPTION','1','OTHER','🐾'.repeat(751))).toThrow(/3000 UTF-8/);
 });
});

describe('Favorites management screen',()=>{
 it('loads only private /favorites and shows safe listing links',async()=>{
  mockSaved();render(<FavoritesWorkspace/>);
  expect((await screen.findAllByRole('link',{name:'View listing'})).length).toBe(4);
 });
 it('renders four listing links from authenticated favorites',async()=>{
  mockSaved();render(<FavoritesWorkspace/>);
  const links=await screen.findAllByRole('link',{name:'View listing'});
  expect(links.map(a=>a.getAttribute('href'))).toEqual(['/adopt/101','/marketplace/202','/lost-found/303','/shop/404']);
  expect(mockApi).toHaveBeenCalledWith('/favorites',{signal:expect.any(AbortSignal)});
 });
 it('filters saved items locally without a second API call',async()=>{
  mockSaved();render(<FavoritesWorkspace/>);
  await screen.findAllByRole('link',{name:'View listing'});
  fireEvent.change(screen.getByRole('combobox',{name:'Filter saved favorites by type'}),{target:{value:'PET_SALE'}});
  expect(screen.getAllByRole('link',{name:'View listing'})).toHaveLength(1);
  fireEvent.change(screen.getByRole('searchbox',{name:'Search saved favorites'}),{target:{value:'none'}});
  expect(screen.getByText('No matching favorites')).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledTimes(1);
 });
 it('does not delete until explicit confirmation',async()=>{
  mockSaved();render(<FavoritesWorkspace/>);
  await screen.findAllByRole('link',{name:'View listing'});
  fireEvent.click(screen.getAllByRole('button',{name:'Remove favorite'})[0]);
  expect(mockApi).not.toHaveBeenCalledWith('/favorites/11',{method:'DELETE'});
  fireEvent.click(screen.getByRole('button',{name:'Keep'}));
  expect(mockApi).not.toHaveBeenCalledWith('/favorites/11',{method:'DELETE'});
 });
 it('removes a saved item only after server-confirmed DELETE',async()=>{
  mockSaved();render(<FavoritesWorkspace/>);
  await screen.findAllByRole('link',{name:'View listing'});
  fireEvent.click(screen.getAllByRole('button',{name:'Remove favorite'})[0]);
  fireEvent.click(screen.getByRole('button',{name:'Confirm removal'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/favorites/11',{method:'DELETE'}));
  await waitFor(()=>expect(screen.getAllByRole('link',{name:'View listing'})).toHaveLength(3));
 });
 it('keeps saved rows intact when DELETE is denied',async()=>{
  mockApi.mockImplementation(async(path,opts)=>{if(path==='/favorites')return saved;if(opts?.method==='DELETE')throw new Error('Not authorized');return undefined as never;});
  render(<FavoritesWorkspace/>);await screen.findAllByRole('link',{name:'View listing'});
  fireEvent.click(screen.getAllByRole('button',{name:'Remove favorite'})[0]);fireEvent.click(screen.getByRole('button',{name:'Confirm removal'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Not authorized');
  expect(screen.getAllByRole('link',{name:'View listing'})).toHaveLength(4);
 });
 it('shows a retryable outage instead of pretending there are no favorites',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Service offline')).mockResolvedValue(saved as never);
  render(<FavoritesWorkspace/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Service offline');
  expect(screen.queryByText('No saved favorites yet')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  expect(await screen.findAllByRole('link',{name:'View listing'})).toHaveLength(4);
 });
 it('reports a genuinely empty private favorites list',async()=>{
  mockApi.mockResolvedValue([] as never);render(<FavoritesWorkspace/>);
  expect(await screen.findByText('No saved favorites yet')).toBeInTheDocument();
 });
 it('ignores unsafe favorite records from the backend response',async()=>{
  mockApi.mockResolvedValue([...saved,{id:18,entityType:'ADOPTION',entityId:'../../bad'}] as never);
  render(<FavoritesWorkspace/>);expect(await screen.findAllByRole('link',{name:'View listing'})).toHaveLength(4);
 });
});

describe('Save and unsave on public listing details',()=>{
 it('checks existing saved state and does not POST duplicates',async()=>{
  mockSaved();render(<FavoriteButton entityType="ADOPTION" entityId="101"/>);
  const button=await screen.findByRole('button',{name:/Remove saved listing/});
  expect(button).toBeEnabled();expect(mockApi).not.toHaveBeenCalledWith('/favorites',expect.objectContaining({method:'POST'}));
 });
 it('posts exact favorite body then reconciles its server-assigned ID',async()=>{
  mockApi.mockResolvedValueOnce([] as never).mockResolvedValueOnce({alreadySaved:false} as never).mockResolvedValueOnce(saved as never);
  render(<FavoriteButton entityType="ADOPTION" entityId="101"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Save listing'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/favorites',{method:'POST',body:{entityType:'ADOPTION',entityId:101}}));
  expect(await screen.findByRole('button',{name:/Remove saved listing/})).toBeInTheDocument();
 });
 it('un-saves using favorite_id, not a listing ID',async()=>{
  mockSaved();render(<FavoriteButton entityType="PET_SALE" entityId="202"/>);
  fireEvent.click(await screen.findByRole('button',{name:/Remove saved listing/}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/favorites/12',{method:'DELETE'}));
  expect(await screen.findByText('Removed from favorites.')).toBeInTheDocument();
 });
 it('does not show success when a POST is rejected',async()=>{
  mockApi.mockResolvedValueOnce([] as never).mockRejectedValueOnce(new Error('Sign in required'));
  render(<FavoriteButton entityType="ADOPTION" entityId="101"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Save listing'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sign in required');
  expect(screen.queryByText('Saved to favorites.')).not.toBeInTheDocument();
 });
 it('blocks unsafe listing IDs without a network call',()=>{
  render(<FavoriteButton entityType="ADOPTION" entityId="101/delete"/>);
  expect(screen.getByRole('button')).toBeDisabled();expect(mockApi).not.toHaveBeenCalled();
 });
});

describe('Private listing concern submission',()=>{
 function fill(){fireEvent.click(screen.getByRole('button',{name:/Report this listing/}));
  fireEvent.change(screen.getByRole('combobox',{name:/Reason/}),{target:{value:'PRIVACY'}});
  fireEvent.change(screen.getByRole('textbox',{name:/Additional private details/}),{target:{value:'Contact number in listing'}});
 }
 it('submits the precise private API body and does not claim a moderation decision',async()=>{
  mockApi.mockResolvedValue({id:77,status:'OPEN'} as never);render(<ReportListing entityType="ADOPTION" entityId="101"/>);fill();
  fireEvent.click(screen.getByRole('button',{name:'Send private report'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/reports/listings',{method:'POST',body:{entityType:'ADOPTION',entityId:101,reasonCode:'PRIVACY',details:'Contact number in listing'}}));
  expect(await screen.findByText(/report #77/)).toHaveTextContent('Review is pending');
 });
 it('rejects multibyte oversized private text before POST',()=>{
  render(<ReportListing entityType="PET_SALE" entityId="202"/>);fill();
  fireEvent.change(screen.getByRole('textbox',{name:/Additional private details/}),{target:{value:'🐾'.repeat(751)}});
  fireEvent.click(screen.getByRole('button',{name:'Send private report'}));
  expect(mockApi).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('3000 UTF-8 bytes');
 });
 it('preserves the private draft and displays server rejection',async()=>{
  mockApi.mockRejectedValueOnce(new Error('Review queue unavailable'));
  render(<ReportListing entityType="LOST_FOUND" entityId="303"/>);fill();
  fireEvent.click(screen.getByRole('button',{name:'Send private report'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Review queue unavailable');
  expect(screen.getByRole('textbox',{name:/Additional private details/})).toHaveValue('Contact number in listing');
  expect(screen.queryByText(/Review is pending/)).not.toBeInTheDocument();
 });
 it('does not permit report submission for unsafe IDs',()=>{
  render(<ReportListing entityType="ADOPTION" entityId="1/delete"/>);
  expect(screen.getByRole('button',{name:/Report this listing/})).toBeDisabled();
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('does not make an API call when a reason is missing',()=>{
  render(<ReportListing entityType="ADOPTION" entityId="101"/>);
  fireEvent.click(screen.getByRole('button',{name:/Report this listing/}));
  fireEvent.click(screen.getByRole('button',{name:'Send private report'}));
  expect(mockApi).not.toHaveBeenCalled();
 });
});
