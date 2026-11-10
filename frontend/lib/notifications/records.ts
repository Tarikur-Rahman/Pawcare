import {field,str,type Row} from '@/lib/types/domain';

export type NotificationFilter='ALL'|'UNREAD'|'READ';

export function notificationId(item:Row):string{
 const id=String(field(item,'id')??'');
 return /^[1-9]\d*$/.test(id)?id:'';
}

export function isUnread(item:Row):boolean{
 const readAt=field(item,'readAt');
 return readAt===null||readAt===undefined||readAt==='';
}

export function notificationSummary(items:Row[]){
 const unread=items.filter(isUnread).length;
 return {total:items.length,unread,read:items.length-unread};
}

export function filterNotifications(items:Row[],filter:NotificationFilter,search:string):Row[]{
 const query=search.trim().toLocaleLowerCase();
 return items.filter(item=>{
  if(filter==='UNREAD'&&!isUnread(item)||filter==='READ'&&isUnread(item))return false;
  return !query||[str(item,'title'),str(item,'body','message'),str(item,'kind')]
   .some(value=>value.toLocaleLowerCase().includes(query));
 }).sort((a,b)=>{
  const left=Date.parse(str(a,'createdAt'));const right=Date.parse(str(b,'createdAt'));
  return (Number.isFinite(right)?right:0)-(Number.isFinite(left)?left:0);
 });
}

export function notificationTime(value:unknown):string{
 const timestamp=Date.parse(typeof value==='string'?value:'');
 return Number.isFinite(timestamp)?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(timestamp)):'Time unavailable';
}
