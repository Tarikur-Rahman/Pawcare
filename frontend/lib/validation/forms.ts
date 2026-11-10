export function required(value:string,label:string,min=1,max=500):string|null {
 const v=value.trim();return v.length<min?`${label} must have at least ${min} characters.`:v.length>max?`${label} is too long.`:null;
}
export function emailValid(value:string):boolean{return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254;}
export function positiveInt(value:string):boolean{return /^\d+$/.test(value)&&Number(value)>0&&Number.isSafeInteger(Number(value));}
export function toUtc(input:string):string {const d=new Date(input);if(Number.isNaN(d.getTime()))throw new Error('Please enter a valid date and time.');return d.toISOString();}
