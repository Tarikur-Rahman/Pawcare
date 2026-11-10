export function formatMoney(minor: number | string | null | undefined, currency='BDT'): string {
  const value=Number(minor ?? 0);
  const code=/^[A-Z]{3}$/.test(currency)?currency:'BDT';
  if(!Number.isFinite(value))return '—';
  return new Intl.NumberFormat('en-BD',{style:'currency',currency:code}).format(value/100);
}
export function formatDate(value:unknown):string {
 if(typeof value!=='string'||!value)return '—';
 const time=new Date(value);return Number.isNaN(time.getTime())?'—':new Intl.DateTimeFormat('en-BD',{dateStyle:'medium',timeZone:'Asia/Dhaka'}).format(time);
}
