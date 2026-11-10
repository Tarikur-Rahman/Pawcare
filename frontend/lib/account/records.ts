import {field,str,type Row} from '@/lib/types/domain';

export type ProfileFields={displayName:string;timeZone:string;locale:string;phone:string};
export type AddressFields={recipientName:string;line1:string;city:string;countryCode:string;scope:string};
export type ProfilePayload={displayName:string;timeZone:string;locale:string;phone:string|null};
export type AddressPayload={recipientName:string;line1:string;city:string;countryCode:string;scope:'SHIPPING'|'BILLING'};

export class AccountInputError extends Error {
 constructor(public readonly fieldName:string,message:string){super(message);this.name='AccountInputError';}
}
function required(value:string,key:string,label:string,max:number):string {
 const trimmed=value.trim();
 if(!trimmed)throw new AccountInputError(key,`${label} is required.`);
 if(new TextEncoder().encode(trimmed).length>max)throw new AccountInputError(key,`${label} must be ${max} UTF-8 bytes or fewer.`);
 return trimmed;
}

export function profileToFields(row:Row):ProfileFields {
 return {displayName:str(row,'displayName'),timeZone:str(row,'timeZone')||'Asia/Dhaka',
  locale:str(row,'locale')||'en-BD',phone:str(row,'phone')};
}
export function profilePayload(fields:ProfileFields):ProfilePayload {
 const displayName=required(fields.displayName,'displayName','Display name',120);
 const timeZone=required(fields.timeZone,'timeZone','Time zone',64);
 try {new Intl.DateTimeFormat('en-US',{timeZone}).format(new Date('2026-01-01T00:00:00Z'));}
 catch {throw new AccountInputError('timeZone','Enter a valid IANA time zone, such as Asia/Dhaka.');}
 const locale=required(fields.locale,'locale','Locale',16);
 try {if(Intl.getCanonicalLocales(locale).length!==1)throw Error('Invalid');}
 catch {throw new AccountInputError('locale','Enter a valid language tag, such as en-BD or bn-BD.');}
 const phone=fields.phone.trim();
 if(phone.length>20)throw new AccountInputError('phone','Phone number must be 20 characters or fewer.');
 if(phone&&!/^\+[1-9][0-9]{6,14}$/.test(phone))
  throw new AccountInputError('phone','Use an international number such as +8801712345678 (E.164).');
 return {displayName,timeZone,locale,phone:phone||null};
}

export function addressPayload(fields:AddressFields):AddressPayload {
 const recipientName=required(fields.recipientName,'recipientName','Recipient name',160);
 const line1=required(fields.line1,'line1','Address line',200);
 const city=required(fields.city,'city','City',100);
 const countryCode=required(fields.countryCode,'countryCode','Country code',2).toUpperCase();
 if(!/^[A-Z]{2}$/.test(countryCode))throw new AccountInputError('countryCode','Use a two-letter country code, such as BD.');
 const scope=fields.scope.trim().toUpperCase();
 if(scope!=='SHIPPING'&&scope!=='BILLING')throw new AccountInputError('scope','Choose Shipping or Billing.');
 return {recipientName,line1,city,countryCode,scope};
}

export function addressId(row:Row):string {
 const value=field(row,'id');
 if(typeof value!=='string'&&typeof value!=='number')return '';
 const text=String(value);
 const n=Number(text);
 return /^\d+$/.test(text)&&Number.isSafeInteger(n)&&n>0?text:'';
}
export function addressScope(row:Row):'SHIPPING'|'BILLING'|'OTHER' {
 const scope=str(row,'scope').trim().toUpperCase();
 return scope==='SHIPPING'||scope==='BILLING'?scope:'OTHER';
}
export function isDefaultAddress(row:Row):boolean {
 const value=field(row,'isDefault');
 return value===true||value===1||value==='1'||value==='Y';
}
export function visibleAddresses(value:Row[],filter:'ALL'|'SHIPPING'|'BILLING',search:string):Row[] {
 const needle=search.trim().toLocaleLowerCase();
 return value.filter(row=>(filter==='ALL'||addressScope(row)===filter)&&
  (!needle||['recipientName','line1','line2','city','region','postalCode','countryCode'].some(k=>str(row,k).toLocaleLowerCase().includes(needle))));
}
