import {field,str,type Row} from '@/lib/types/domain';

export class AdminValidationError extends Error {constructor(message:string){super(message);this.name='AdminValidationError';}}
export const REVIEW_TYPES=['ADOPTION','PET_SALE','LOST_FOUND','DONATION','FOOD_PRODUCT'] as const;
export const CAPABILITIES=['APPROVED_SELLER','STORE_OPERATOR','VERIFIED_BENEFICIARY'] as const;
export type ReviewType=(typeof REVIEW_TYPES)[number];
export type Capability=(typeof CAPABILITIES)[number];

export function adminId(value:unknown):string {
 if(typeof value!=='string'&&typeof value!=='number')return '';
 const raw=String(value).trim();
 if(!/^\d+$/.test(raw))return '';
 const id=Number(raw);
 return Number.isSafeInteger(id)&&id>0?String(id):'';
}
export function adminReason(raw:string):string {
 const value=raw.trim();
 if(!value)throw new AdminValidationError('Enter an audit reason before continuing.');
 if(new TextEncoder().encode(value).length>80)throw new AdminValidationError('Audit reason must be at most 80 UTF-8 bytes.');
 return value;
}
function member(value:string,options:readonly string[],label:string):string {
 const item=value.trim().toUpperCase();
 if(!options.includes(item))throw new AdminValidationError(`Choose a valid ${label}.`);
 return item;
}
function positive(value:unknown,label:string):number {
 const id=adminId(value);
 if(!id)throw new AdminValidationError(`Enter a safe positive ${label}.`);
 return Number(id);
}
export function isPendingOwner(user:Row):boolean {
 return adminId(field(user,'id'))!==''&&str(user,'role').toUpperCase()==='OWNER'&&str(user,'status').toUpperCase()==='PENDING_VERIFICATION';
}
export function isActiveUser(user:Row):boolean {
 return adminId(field(user,'id'))!==''&&str(user,'status').toUpperCase()==='ACTIVE';
}
export function activationPayload(user:Row,identityReviewed:boolean,reason:string) {
 if(!isPendingOwner(user))throw new AdminValidationError('Only pending owner accounts can be activated.');
 if(identityReviewed!==true)throw new AdminValidationError('Complete identity review before activation.');
 return {identityReviewed:true,reasonCode:adminReason(reason)};
}
export function grantPayload(user:Row,capability:string,evidenceFileId:unknown,reason:string){
 if(!isActiveUser(user))throw new AdminValidationError('Choose an active user from the directory.');
 return {capability:member(capability,CAPABILITIES,'capability') as Capability,
  evidenceFileId:positive(evidenceFileId,'reviewer-approved evidence file ID'),reasonCode:adminReason(reason)};
}
export function revokePayload(capabilityId:unknown,reason:string){
 return {id:positive(capabilityId,'capability grant ID'),body:{reasonCode:adminReason(reason)}};
}
export function claimVerifyPayload(claimId:unknown,reason:string){
 return {id:positive(claimId,'reunion claim ID'),body:{reasonCode:adminReason(reason)}};
}
export function decisionPayload(entityType:string,entityId:unknown,approve:boolean,reason:string){
 if(typeof approve!=='boolean')throw new AdminValidationError('Choose approve or reject.');
 return {entityType:member(entityType,REVIEW_TYPES,'listing type') as ReviewType,
  entityId:positive(entityId,'listing ID'),approve,reasonCode:adminReason(reason)};
}
export function validReport(row:Row):boolean {
 return !!adminId(field(row,'id'))&&!!adminId(field(row,'entityId'))&&
  REVIEW_TYPES.includes(str(row,'entityType').toUpperCase() as ReviewType)&&
  ['OPEN','IN_REVIEW'].includes(str(row,'status').toUpperCase());
}
export function filterReports(list:Row[],term:string,type:string='ALL'):Row[] {
 const q=term.trim().toLowerCase();
 return list.filter(validReport).filter(r=>(type==='ALL'||str(r,'entityType').toUpperCase()===type)&&
  (!q||[str(r,'id'),str(r,'entityType'),str(r,'entityId'),str(r,'reasonCode'),str(r,'status')].some(v=>v.toLowerCase().includes(q))));
}
export function filterUsers(list:Row[],term:string,status:string='ALL'):Row[] {
 const q=term.trim().toLowerCase();
 return list.filter(r=>!!adminId(field(r,'id'))).filter(r=>(status==='ALL'||str(r,'status').toUpperCase()===status)&&
  (!q||[str(r,'id'),str(r,'email'),str(r,'role'),str(r,'status')].some(v=>v.toLowerCase().includes(q))));
}
export function adminMessage(error:unknown,fallback:string):string{return error instanceof Error?error.message:fallback;}
