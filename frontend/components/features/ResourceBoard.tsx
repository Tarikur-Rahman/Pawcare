 'use client';
import {useEffect,useCallback,useState} from 'react';
import {api} from '@/lib/api/client';
import {rows,type Row,str,field} from '@/lib/types/domain';
import {ErrorState} from '@/components/ui/ErrorState';
import {EmptyState} from '@/components/ui/EmptyState';
import {DataTable,type Column} from '@/components/ui/DataTable';
import {ActionForm,type FieldSpec} from './ActionForm';
import {StatusBadge} from '@/components/ui/StatusBadge';
export type BoardProps={title:string;subtitle:string;path:string;columns:Column[];form?:{title:string;path:string;fields:FieldSpec[];submitLabel?:string;transform?:(values:Record<string,string>)=>unknown};empty?:string;extra?:React.ReactNode};
export function ResourceBoard({title,subtitle,path,columns,form,empty='No records yet',extra}:BoardProps){
 const [items,setItems]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[open,setOpen]=useState(false);
 const load=useCallback(async()=>{setLoading(true);setError('');try{setItems(rows(await api(path)));}catch(e){setError(e instanceof Error?e.message:'Unable to fetch records.');}finally{setLoading(false);}},[path]);
 useEffect(()=>{void load();const handler=()=>void load();window.addEventListener('pawcare:refresh',handler);return()=>window.removeEventListener('pawcare:refresh',handler);},[load]);
 return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">PAWCARE WORKSPACE</span><h1>{title}</h1><p>{subtitle}</p></div>{form&&<button className="btn btn-primary" onClick={()=>setOpen(!open)} aria-expanded={open}>{open?'Close form':`+ ${form.title}`}</button>}</div>{form&&open&&<div className="panel raised"><ActionForm title={form.title} path={form.path} fields={form.fields} submitLabel={form.submitLabel} transform={form.transform} onSuccess={()=>{setOpen(false);void load();}}/></div>}{extra}{loading?<div className="loading-card" role="status">Loading information…</div>:error?<ErrorState message={error} onRetry={()=>void load()}/>:items.length?<DataTable rows={items} columns={columns}/>:<EmptyState title={empty} description="Your records will appear here once available."/>}</section>;
}
export const columnsFrom=(pairs:[string,string][]):Column[]=>pairs.map(([key,label])=>({key,label,render:key==='status'?(r)=><StatusBadge status={field(r,'status')}/>:undefined}));
