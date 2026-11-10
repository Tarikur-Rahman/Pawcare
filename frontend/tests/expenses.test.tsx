// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {api} from '@/lib/api/client';
import {ApiError} from '@/lib/api/errors';
import {
 amountToMinor,minorToAmount,expenseInstant,expensePayload,expenseId,expenseToForm,
 filterExpenses,petCurrencyTotals,ExpenseFormError,
} from '@/lib/expenses/records';
import {ExpenseEntryForm} from '@/components/expenses/ExpenseEntryForm';
import {ExpensesWorkspace} from '@/components/features/ExpensesWorkspace';

vi.mock('@/lib/api/client',()=>({api:vi.fn()}));
const mockApi=vi.mocked(api);
const pet={id:17,name:'Milo',status:'ACTIVE'};
const archived={id:18,name:'Archived Pet',status:'ARCHIVED'};
const food={id:71,category:'FOOD',amountMinor:12550,currency:'BDT',description:'Fresh kibble',occurredAt:'2026-11-07T08:30:00Z'};
const vet={id:72,category:'VET',amountMinor:90000,currency:'BDT',description:'Annual checkup',occurredAt:'2026-11-06T11:20:00Z'};
const usd={id:73,category:'TOYS',amountMinor:1500,currency:'USD',description:'Chew toy',occurredAt:'2026-11-05T10:00:00Z'};
const values={amount:'125.50',currency:'BDT',category:'FOOD',occurredAt:'2026-11-07T14:30',description:'  Kibble for Milo  '};
function change(label:string,value:string){fireEvent.change(screen.getByLabelText(label,{exact:false}),{target:{value}});}
function setupApi(){
 mockApi.mockImplementation((async path=>{
  if(path==='/pets')return [pet,archived];
  if(path==='/pets/17/expenses')return [food,vet,usd];
  if(path==='/reports/expenses')return [{currency:'BDT',totalMinor:102550,count:2},{currency:'USD',totalMinor:1500,count:1}];
  return {id:99};
 }) as typeof api);
}
beforeEach(()=>{vi.resetAllMocks();window.history.replaceState({},'','/');});
afterEach(()=>cleanup());

describe('Exact expense payloads and currency boundaries',()=>{
 it('converts two-decimal amounts to integer minor units without floating point drift',()=>{
  expect(amountToMinor('0')).toBe(0);
  expect(amountToMinor('0.01')).toBe(1);
  expect(amountToMinor('125.50')).toBe(12550);
  expect(amountToMinor('10000000000.00')).toBe(1_000_000_000_000);
  expect(minorToAmount(12550)).toBe('125.50');
  expect(minorToAmount(1)).toBe('0.01');
 });
 it('rejects negative, fractional minor units, localized comma amounts, exponent notation and overflow',()=>{
  for(const amount of ['-1','1.001','1,000','1e5','1.','01.25','10000000000.01','Infinity',''])
   expect(()=>amountToMinor(amount)).toThrow(ExpenseFormError);
 });
 it('creates an exact Oracle-backed request with normalized notes',()=>{
  expect(expensePayload(values)).toEqual({amountMinor:12550,currency:'BDT',category:'FOOD',occurredAt:new Date(values.occurredAt).toISOString(),description:'Kibble for Milo'});
  expect(expensePayload({...values,description:'   '}).description).toBeNull();
 });
 it('rejects unsupported currencies and categories',()=>{
  expect(()=>expensePayload({...values,currency:'JPY'})).toThrow('two-decimal');
  expect(()=>expensePayload({...values,currency:'BTC'})).toThrow('two-decimal');
  expect(()=>expensePayload({...values,category:'UNKNOWN'})).toThrow('valid category');
 });
 it('rejects invalid calendar dates, invalid times and malformed local timestamps',()=>{
  for(const at of ['2026-02-30T12:00','2026-13-01T12:00','2026-11-07T25:00','2026-11-07','0000-01-01T00:00'])
   expect(()=>expenseInstant(at)).toThrow(ExpenseFormError);
 });
 it('validates the UTF-8 byte boundary for description',()=>{
  expect(expensePayload({...values,description:'a'.repeat(2000)}).description).toHaveLength(2000);
  expect(()=>expensePayload({...values,description:'🐾'.repeat(501)})).toThrow('2,000 UTF-8 bytes');
 });
 it('converts valid server records to editor values while preserving the description',()=>{
  const converted=expenseToForm(food);
  expect(converted).toMatchObject({amount:'125.50',currency:'BDT',category:'FOOD',description:'Fresh kibble'});
  expect(expenseInstant(converted.occurredAt)).toBe(new Date(converted.occurredAt).toISOString());
 });
 it('allows only safe positive numeric IDs',()=>{
  expect(expenseId(food)).toBe('71');
  for(const id of ['0','-1','1/patch','9007199254740993','3.5','abc'])expect(expenseId({...food,id})).toBe('');
 });
 it('filters notes and category without changing the original order',()=>{
  const original=[vet,usd,food];
  expect(filterExpenses(original,'FOOD','')).toEqual([food]);
  expect(filterExpenses(original,'','annual')).toEqual([vet]);
  expect(filterExpenses(original,'','not a match')).toEqual([]);
  expect(filterExpenses(original,'','').map(x=>x.id)).toEqual([71,72,73]);
  expect(original[0].id).toBe(72);
 });
 it('separates totals by currency and ignores invalid amounts',()=>{
  expect(petCurrencyTotals([food,vet,usd,{currency:'BDT',amountMinor:'invalid'}])).toEqual([
   {currency:'BDT',totalMinor:102550,count:2},{currency:'USD',totalMinor:1500,count:1},
  ]);
 });
});

describe('Expense entry form',()=>{
 it('posts a precise amount-minor-unit body and clears inputs after success',async()=>{
  mockApi.mockResolvedValue({id:99});const saved=vi.fn();
  render(<ExpenseEntryForm petId="17" onSaved={saved} onCancel={vi.fn()}/>);
  change('Amount','125.50');change('Currency','BDT');change('Category','FOOD');change('Date and time',values.occurredAt);change('Notes','  Kibble for Milo  ');
  fireEvent.click(screen.getByRole('button',{name:'Add expense'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/pets/17/expenses',{method:'POST',body:expensePayload(values)}));
  await waitFor(()=>expect(saved).toHaveBeenCalledWith('Expense recorded.'));
  expect(screen.getByLabelText('Amount',{exact:false})).toHaveValue('');
 });
 it('blocks invalid amounts before making a request',async()=>{
  render(<ExpenseEntryForm petId="17" onSaved={vi.fn()} onCancel={vi.fn()}/>);
  change('Amount','0.001');change('Date and time',values.occurredAt);
  fireEvent.click(screen.getByRole('button',{name:'Add expense'}));
  expect(await screen.findByText(/up to two decimals/i)).toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('edits using PATCH while retaining the existing category, amount, date and notes',async()=>{
  mockApi.mockResolvedValue(undefined);const saved=vi.fn();
  render(<ExpenseEntryForm petId="17" editing={food} onSaved={saved} onCancel={vi.fn()}/>);
  expect(screen.getByLabelText('Amount',{exact:false})).toHaveValue('125.50');
  expect(screen.getByLabelText('Notes (optional)')).toHaveValue('Fresh kibble');
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(mockApi).toHaveBeenCalledWith('/expenses/71',{method:'PATCH',body:expect.objectContaining({amountMinor:12550,currency:'BDT',category:'FOOD',description:'Fresh kibble'})}));
  expect(saved).toHaveBeenCalledWith('Expense updated.');
 });
 it('prevents edits when the record ID is unsafe',async()=>{
  render(<ExpenseEntryForm petId="17" editing={{...food,id:'bad'}} onSaved={vi.fn()} onCancel={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('identifier is invalid');
  expect(mockApi).not.toHaveBeenCalled();
 });
 it('keeps draft values and displays server errors without false success',async()=>{
  mockApi.mockRejectedValueOnce(new ApiError(409,'CONFLICT','Please review this expense.'));
  render(<ExpenseEntryForm petId="17" onSaved={vi.fn()} onCancel={vi.fn()}/>);
  change('Amount','125.50');change('Date and time',values.occurredAt);
  fireEvent.click(screen.getByRole('button',{name:'Add expense'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('review this expense');
  expect(screen.getByLabelText('Amount',{exact:false})).toHaveValue('125.50');
 });
 it('renders backend field validation for amountMinor as amount field feedback',async()=>{
  mockApi.mockRejectedValueOnce(new ApiError(400,'VALIDATION','Invalid amount',undefined,{amountMinor:['Amount too large']}));
  render(<ExpenseEntryForm petId="17" onSaved={vi.fn()} onCancel={vi.fn()}/>);
  change('Amount','125.50');change('Date and time',values.occurredAt);
  fireEvent.click(screen.getByRole('button',{name:'Add expense'}));
  expect(await screen.findByText('Amount too large')).toBeInTheDocument();
 });
});

describe('Owner expense dashboard',()=>{
 it('lists only active pets and shows separate BDT and USD totals',async()=>{
  setupApi();render(<ExpensesWorkspace/>);
  expect(await screen.findByText('Fresh kibble')).toBeInTheDocument();
  expect(screen.getByRole('option',{name:'Milo'})).toBeInTheDocument();
  expect(screen.queryByRole('option',{name:'Archived Pet'})).not.toBeInTheDocument();
  expect(screen.getByText(/USD · 1 records/)).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledWith('/reports/expenses',expect.objectContaining({signal:expect.any(AbortSignal)}));
 });
 it('filters categories and searches notes without an extra request',async()=>{
  setupApi();render(<ExpensesWorkspace/>);
  await screen.findByText('Fresh kibble');const before=mockApi.mock.calls.length;
  change('Filter by category','VET');
  expect(screen.getByText('Annual checkup')).toBeInTheDocument();
  expect(screen.queryByText('Fresh kibble')).not.toBeInTheDocument();
  change('Search expenses','not found');
  expect(screen.getByText('No matching expenses')).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledTimes(before);
 });
 it('loads the selected expense into its edit form and allows cancelling the edit',async()=>{
  setupApi();render(<ExpensesWorkspace/>);
  await screen.findByText('Fresh kibble');
  fireEvent.click(screen.getAllByRole('button',{name:'Edit'})[0]);
  expect(screen.getByRole('button',{name:'Save changes'})).toBeInTheDocument();
  expect(screen.getByLabelText('Notes (optional)')).toHaveValue('Fresh kibble');
  fireEvent.click(screen.getByRole('button',{name:'Cancel editing'}));
  expect(screen.getByRole('button',{name:'Add expense'})).toBeInTheDocument();
 });
 it('shows a retryable error if the pet expense endpoint is unavailable',async()=>{
  mockApi.mockImplementation((async path=>{
   if(path==='/pets')return [pet];
   if(path==='/pets/17/expenses')throw new Error('Expense service is offline.');
   if(path==='/reports/expenses')return [];
   return {};
  }) as typeof api);
  render(<ExpensesWorkspace/>);
  expect(await screen.findByText('Expense service is offline.')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Retry'})).toBeInTheDocument();
 });
 it('shows a pet-management empty state when no active pets exist',async()=>{
  mockApi.mockImplementation((async path=>path==='/pets'?[archived]:[]) as typeof api);
  render(<ExpensesWorkspace/>);
  expect(await screen.findByText('Add a pet to get started')).toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalledWith('/pets/18/expenses',expect.anything());
 });
});
