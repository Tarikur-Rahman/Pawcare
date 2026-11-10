'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Pencil,RefreshCw,Search} from 'lucide-react';
import {api} from '@/lib/api/client';
import {rows,str,field,type Row} from '@/lib/types/domain';
import {formatDate,formatMoney} from '@/lib/utils/currency';
import {EXPENSE_CATEGORIES,expenseId,filterExpenses,petCurrencyTotals} from '@/lib/expenses/records';
import {ExpenseEntryForm} from '@/components/expenses/ExpenseEntryForm';
import {Button} from '@/components/ui/Button';
import {EmptyState} from '@/components/ui/EmptyState';
import {ErrorState} from '@/components/ui/ErrorState';

export function ExpensesWorkspace(){
 const [pets,setPets]=useState<Row[]>([]);const [petId,setPetId]=useState('');
 const [petsLoading,setPetsLoading]=useState(true);const [petsError,setPetsError]=useState('');const [petsReload,setPetsReload]=useState(0);
 const [items,setItems]=useState<Row[]>([]);const [itemsLoading,setItemsLoading]=useState(false);const [itemsError,setItemsError]=useState('');const [reload,setReload]=useState(0);
 const [totals,setTotals]=useState<Row[]>([]);const [totalsError,setTotalsError]=useState('');const [totalsReload,setTotalsReload]=useState(0);
 const [category,setCategory]=useState('');const [search,setSearch]=useState('');
 const [editing,setEditing]=useState<Row|null>(null);const [notice,setNotice]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setPetsLoading(true);setPetsError('');
  api('/pets',{signal:controller.signal}).then(response=>{
   if(controller.signal.aborted)return;
   const active=rows(response).filter(p=>(str(p,'status')||'ACTIVE').toUpperCase()==='ACTIVE');
   setPets(active);
   const requested=new URLSearchParams(window.location.search).get('petId');
   setPetId(current=>active.some(p=>str(p,'id')===current)?current:str(active.find(p=>str(p,'id')===requested),'id')||str(active[0],'id'));
  }).catch(caught=>{if(!controller.signal.aborted)setPetsError(caught instanceof Error?caught.message:'Unable to load pets.');})
   .finally(()=>{if(!controller.signal.aborted)setPetsLoading(false);});
  return ()=>controller.abort();
 },[petsReload]);
 useEffect(()=>{
  if(!petId){setItems([]);setItemsLoading(false);setItemsError('');return;}
  const controller=new AbortController();setItemsLoading(true);setItemsError('');setItems([]);
  api(`/pets/${petId}/expenses`,{signal:controller.signal}).then(response=>{
   if(!controller.signal.aborted)setItems(rows(response));
  }).catch(caught=>{if(!controller.signal.aborted)setItemsError(caught instanceof Error?caught.message:'Unable to load expenses.');})
   .finally(()=>{if(!controller.signal.aborted)setItemsLoading(false);});
  return ()=>controller.abort();
 },[petId,reload]);
 useEffect(()=>{
  const controller=new AbortController();setTotalsError('');
  api('/reports/expenses',{signal:controller.signal}).then(response=>{if(!controller.signal.aborted)setTotals(rows(response));})
   .catch(caught=>{if(!controller.signal.aborted)setTotalsError(caught instanceof Error?caught.message:'Unable to load totals.');});
  return ()=>controller.abort();
 },[totalsReload]);
 const selected=pets.find(p=>str(p,'id')===petId);
 const visible=filterExpenses(items,category,search);
 const petTotals=petCurrencyTotals(items);
 function saved(message:string){setNotice(message);setEditing(null);setReload(n=>n+1);setTotalsReload(n=>n+1);}
 function choosePet(value:string){setPetId(value);setEditing(null);setCategory('');setSearch('');setNotice('');}
 return <section className="page-section">
  <div className="page-heading"><div><span className="eyebrow">TRACK WHAT MATTERS</span><h1>Expenses</h1>
   <p>Keep accurate private records of the costs of caring for your companions.</p></div></div>
  <div className="panel expense-pet-picker">
   <div><h2>Choose a companion</h2><p className="hint">Track spending on each active pet. All amounts are stored in minor units.</p></div>
   <div className="expense-pet-controls"><label className="form-field" htmlFor="expense-pet-id">Pet
    <select id="expense-pet-id" className="form-input" value={petId} disabled={petsLoading} onChange={e=>choosePet(e.target.value)}>
     {!pets.length&&<option value="">{petsLoading?'Loading pets…':'No active pets'}</option>}
     {pets.map(p=><option key={str(p,'id')} value={str(p,'id')}>{str(p,'name')}</option>)}
    </select></label><Button variant="secondary" disabled={petsLoading} onClick={()=>setPetsReload(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/>Refresh pets</Button></div>
  </div>
  {petsError&&<ErrorState message={petsError} onRetry={()=>setPetsReload(n=>n+1)}/>}
  {petsLoading&&<p className="hint" role="status">Loading your pets…</p>}
  {!petsLoading&&!petsError&&!pets.length&&<EmptyState title="Add a pet to get started" description="You need an active pet profile before you can record expenses." href="/pets" action="Manage pets"/>}
  {selected&&<>
   {notice&&<p role="status" className="success-message expense-notice">{notice}</p>}
   <div className="expense-stats" aria-label="Expense overview">
    <div><strong>{items.length}</strong><span>Recent records (max 100)</span></div>
    {petTotals.length?petTotals.map(t=><div key={t.currency}><strong>{formatMoney(t.totalMinor,t.currency)}</strong><span>{t.count} {t.currency} records in the latest 100</span></div>)
     :<div><strong>—</strong><span>Pet spending</span></div>}
   </div>
   <div className="dashboard-lower expense-layout"><div className="panel expense-records-panel">
    <div className="medical-section-header"><div><h2>{str(selected,'name')}'s expenses</h2><p>Latest 100 entries. Edit an entry to correct its details.</p></div>
     <Button variant="secondary" disabled={itemsLoading} onClick={()=>setReload(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/>{itemsLoading?'Loading':'Refresh'}</Button></div>
    <div className="expense-toolbar"><label className="form-field" htmlFor="expense-category-filter">Filter by category
     <select id="expense-category-filter" className="form-input" value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{EXPENSE_CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
     <label className="expense-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Search expenses</span>
      <input className="form-input" aria-label="Search expenses" type="search" placeholder="Search notes" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    {itemsError&&<ErrorState message={itemsError} onRetry={()=>setReload(n=>n+1)}/>}
    {itemsLoading?<p role="status" className="hint">Loading expenses…</p>
     :itemsError&&!items.length?null
     :!items.length?<EmptyState title="No expenses yet" description="Use the form to record your pet's first expense."/>
     :!visible.length?<EmptyState title="No matching expenses" description="Try another category or search term."/>
     :<ul className="expense-entry-list">{visible.map((item,index)=>{
      const id=expenseId(item);const isEditing=id!==''&&id===expenseId(editing??{});
      const name=EXPENSE_CATEGORIES.find(c=>c.value===str(item,'category'))?.label||str(item,'category');
      return <li className={`expense-entry-row${isEditing?' expense-editing':''}`} key={id||`unknown-${index}`}>
       <div className="expense-entry-detail"><div className="expense-entry-heading"><strong>{name}</strong><span>{formatMoney(field(item,'amountMinor') as number,str(item,'currency').trim()||'BDT')}</span></div>
        <p>{formatDate(str(item,'occurredAt'))} · {str(item,'currency').trim()}</p>{str(item,'description')&&<p className="expense-entry-notes">{str(item,'description')}</p>}
       </div>{id&&<Button type="button" variant="secondary" className="btn-small" onClick={()=>{setEditing(item);setNotice('');}}><Pencil size={14} aria-hidden="true"/>{isEditing?'Editing':'Edit'}</Button>}
      </li>;
     })}</ul>}
   </div><div className="panel expense-create-panel"><ExpenseEntryForm key={`${petId}:${editing?expenseId(editing):'new'}`} petId={petId} editing={editing} onSaved={saved} onCancel={()=>setEditing(null)}/>
    <p className="expense-help hint">PawCare records expenses but does not process payments. Deletion is not available in the current expense API.</p>
   </div></div>
  </>}
  <div className="panel expense-all-totals"><div className="medical-section-header"><div><h2>All-pet spending by currency</h2><p>Lifetime totals across pets, kept separate by currency—no misleading mixed-currency sum.</p></div>
   <Button variant="secondary" onClick={()=>setTotalsReload(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/>Refresh totals</Button></div>
   {totalsError&&<ErrorState message={totalsError} onRetry={()=>setTotalsReload(n=>n+1)}/>}
   {!totalsError&&(!totals.length?<p className="hint">No spending totals yet.</p>
    :<ul className="expense-total-list">{totals.map((row,index)=>{
     const currency=str(row,'currency').trim();const count=Number(field(row,'count'))||0;
     return <li key={`${currency}-${index}`}><strong>{formatMoney(field(row,'totalMinor') as number,currency)}</strong><span>{currency} · {count} records</span></li>;
    })}</ul>)}
  </div>
  <p className="hint expense-footer"><Link href="/pets">Manage pets</Link> · Expense records are visible only to their owner.</p>
 </section>;
}
