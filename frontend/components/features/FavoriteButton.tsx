'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Heart} from 'lucide-react';
import {api} from '@/lib/api/client';
import {field,rows,type Row} from '@/lib/types/domain';
import {contentError,contentId,favoritePayload,favoriteType} from '@/lib/content/moderation';

function savedFavorite(list:Row[],type:string,id:string):string{
 const match=list.find(item=>favoriteType(field(item,'entityType'))===type&&contentId(field(item,'entityId'))===id);
 return match?contentId(field(match,'id','favoriteId')):'';
}
export function FavoriteButton({entityType,entityId}:{entityType:string;entityId:string}){
 const [savedId,setSavedId]=useState(''),[busy,setBusy]=useState(false),[checking,setChecking]=useState(true);
 const [feedback,setFeedback]=useState(''),[error,setError]=useState('');
 const id=contentId(entityId),type=favoriteType(entityType);
 useEffect(()=>{
  const controller=new AbortController();setSavedId('');setChecking(true);setError('');setFeedback('');
  if(!id||!type){setChecking(false);return ()=>controller.abort();}
  api('/favorites',{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setSavedId(savedFavorite(rows(value),type,id));})
   .catch(()=>{if(!controller.signal.aborted)setError('Sign in to manage your favorites.');})
   .finally(()=>{if(!controller.signal.aborted)setChecking(false);});
  return ()=>controller.abort();
 },[id,type]);
 async function toggle(){
  if(!id||!type||checking||busy)return;
  setBusy(true);setFeedback('');setError('');
  try{
   if(savedId){await api(`/favorites/${savedId}`,{method:'DELETE'});setSavedId('');setFeedback('Removed from favorites.');}
   else {await api('/favorites',{method:'POST',body:favoritePayload(type,id)});
    setFeedback('Saved to favorites.');
    try {const updated=rows(await api('/favorites'));setSavedId(savedFavorite(updated,type,id));}
    catch {setFeedback('Saved to favorites. Reload to manage this item.');}
   }
  }catch(e){setError(contentError(e,'Unable to update favorites.'));}
  finally{setBusy(false);}
 }
 return <div><button type="button" className="btn btn-secondary" disabled={!id||!type||checking||busy} onClick={()=>void toggle()}>
  <Heart size={16}/>{checking?'Checking favorites…':busy?'Saving…':savedId?'Remove saved listing':'Save listing'}
 </button>{feedback&&<p className="hint" role="status">{feedback}</p>}{error&&<p className="form-alert" role="alert">{error} <Link href="/login">Sign in</Link></p>}</div>;
}
