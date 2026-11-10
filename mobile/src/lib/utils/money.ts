export function formatMoney(amountMinor:number,currency:string){
 const safeCurrency=/^[A-Z]{3}$/.test(currency)?currency:'USD';
 try{return new Intl.NumberFormat('en-US',{style:'currency',currency:safeCurrency}).format(amountMinor/100);}catch{return `${safeCurrency} ${(amountMinor/100).toFixed(2)}`;}
}
export function toMinorUnits(value:string){const normalized=value.trim();if(!/^\d{1,9}(\.\d{1,2})?$/.test(normalized))throw new Error('Enter a valid positive amount (up to two decimals).');const [whole,fraction='']=normalized.split('.');const total=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(total)||total<=0)throw new Error('Amount must be greater than zero.');return total;}
