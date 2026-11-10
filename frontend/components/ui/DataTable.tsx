 'use client';
import {useMemo,useState} from 'react';
import type {Row} from '@/lib/types/domain';
import {field} from '@/lib/types/domain';
import {EmptyState} from './EmptyState';
export type Column={key:string;label:string;render?:(row:Row)=>React.ReactNode};
export function DataTable({rows,columns,empty='No records found'}:{rows:Row[];columns:Column[];empty?:string}){
 const [filter,setFilter]=useState(''),[sort,setSort]=useState('');
 const visible=useMemo(()=>{const filtered=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()));return sort?filtered.sort((a,b)=>String(field(a,sort)??'').localeCompare(String(field(b,sort)??''))):filtered;},[rows,filter,sort]);
 if(!rows.length)return <EmptyState title={empty} description="Once records are available, they'll appear in this list."/>;
 return <div className="table-card"><label className="sr-only" htmlFor="table-filter">Filter records</label><input id="table-filter" className="form-input table-filter" placeholder="Search records…" value={filter} onChange={e=>setFilter(e.target.value)}/><div className="table-overflow"><table><thead><tr>{columns.map(c=><th key={c.key} scope="col"><button type="button" onClick={()=>setSort(sort===c.key?'':c.key)} aria-label={`Sort by ${c.label}`}>{c.label} {sort===c.key?'↑':''}</button></th>)}</tr></thead><tbody>{visible.map((r,i)=><tr key={String(field(r,'id','petId','orderId')??i)}>{columns.map(c=><td key={c.key}>{c.render?c.render(r):String(field(r,c.key)??'—')}</td>)}</tr>)}</tbody></table></div><div className="table-count">Showing {visible.length} of {rows.length} records</div></div>;
}