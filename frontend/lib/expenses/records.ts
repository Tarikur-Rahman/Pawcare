import {field,str,type Row} from '@/lib/types/domain';

// The expense editor intentionally offers two-decimal currencies only: the API stores minor units.
export const EXPENSE_CURRENCIES=[{value:'BDT',label:'BDT — Bangladeshi taka'},{value:'USD',label:'USD — US dollar'},{value:'EUR',label:'EUR — Euro'}] as const;
export const EXPENSE_CATEGORIES=[
 {value:'FOOD',label:'Food'}, {value:'VET',label:'Veterinary care'},
 {value:'MEDICATION',label:'Medication'}, {value:'GROOMING',label:'Grooming'},
 {value:'TOYS',label:'Toys'}, {value:'SUPPLIES',label:'Supplies'},
 {value:'OTHER',label:'Other'},
] as const;
export type ExpenseFormValues={amount:string;currency:string;category:string;occurredAt:string;description:string};
export const INITIAL_EXPENSE_FORM:ExpenseFormValues={amount:'',currency:'BDT',category:'FOOD',occurredAt:'',description:''};
export class ExpenseFormError extends Error{
 constructor(public field:keyof ExpenseFormValues,message:string){super(message);this.name='ExpenseFormError';}
}
export function expenseId(row:Row):string{
 const id=str(row,'id','expenseId');
 if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))return '';
 return id;
}
export function amountToMinor(amount:string):number{
 const value=amount.trim();
 if(!/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/.test(value))throw new ExpenseFormError('amount','Enter a valid non-negative amount with up to two decimals.');
 const [whole,decimals='']=value.split('.');
 const minor=Number(whole)*100+Number(decimals.padEnd(2,'0'));
 if(!Number.isSafeInteger(minor)||minor>1_000_000_000_000)throw new ExpenseFormError('amount','Amount exceeds the supported maximum.');
 return minor;
}
export function minorToAmount(value:unknown):string{
 const minor=Number(value);
 if(!Number.isSafeInteger(minor)||minor<0||minor>1_000_000_000_000)return '';
 return `${Math.floor(minor/100)}.${String(minor%100).padStart(2,'0')}`;
}
export function expenseInstant(local:string):string{
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
 if(!match)throw new ExpenseFormError('occurredAt','Enter a valid date and time.');
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),hour=Number(match[4]),minute=Number(match[5]);
 const date=new Date(year,month-1,day,hour,minute);
 if(year<100||date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day||date.getHours()!==hour||date.getMinutes()!==minute)
  throw new ExpenseFormError('occurredAt','Enter a real local date and time.');
 return date.toISOString();
}
export function expensePayload(values:ExpenseFormValues){
 const currency=values.currency.trim().toUpperCase();
 if(!EXPENSE_CURRENCIES.some(c=>c.value===currency))throw new ExpenseFormError('currency','Choose a supported two-decimal currency.');
 const category=values.category.trim().toUpperCase();
 if(!EXPENSE_CATEGORIES.some(c=>c.value===category))throw new ExpenseFormError('category','Choose a valid category.');
 const amountMinor=amountToMinor(values.amount);
 const occurredAt=expenseInstant(values.occurredAt);
 const description=values.description.trim();
 if(new TextEncoder().encode(description).length>2000)throw new ExpenseFormError('description','Notes must be at most 2,000 UTF-8 bytes.');
 return {amountMinor,currency,category,occurredAt,description:description||null};
}
export function expenseToForm(row:Row):ExpenseFormValues{
 const occurredAt=str(row,'occurredAt');const date=new Date(occurredAt);
 const pad=(n:number)=>String(n).padStart(2,'0');
 const local=Number.isNaN(date.getTime())?'':`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
 return {amount:minorToAmount(field(row,'amountMinor')),currency:str(row,'currency').trim(),category:str(row,'category'),occurredAt:local,description:str(row,'description')};
}
export function filterExpenses(items:Row[],category:string,search:string):Row[]{
 const needle=search.trim().toLocaleLowerCase();
 return items.filter(row=>(!category||str(row,'category').toUpperCase()===category)&&
  (!needle||[str(row,'category'),str(row,'description'),str(row,'currency'),str(row,'occurredAt')].some(v=>v.toLocaleLowerCase().includes(needle))))
  .sort((a,b)=>Date.parse(str(b,'occurredAt'))-Date.parse(str(a,'occurredAt')));
}
export function petCurrencyTotals(items:Row[]):{currency:string;totalMinor:number;count:number}[]{
 const result=new Map<string,{currency:string;totalMinor:number;count:number}>();
 for(const row of items){
  const currency=str(row,'currency').trim().toUpperCase();const minor=Number(field(row,'amountMinor'));
  if(!/^[A-Z]{3}$/.test(currency)||!Number.isSafeInteger(minor)||minor<0)continue;
  const existing=result.get(currency)??{currency,totalMinor:0,count:0};
  existing.totalMinor+=minor;existing.count++;result.set(currency,existing);
 }
 return [...result.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}
