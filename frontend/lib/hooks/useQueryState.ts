 'use client';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {useCallback} from 'react';
export function useQueryState(key:string){
 const router=useRouter(),pathname=usePathname(),search=useSearchParams();
 const value=search.get(key)||'';
 const update=useCallback((next:string)=>{const q=new URLSearchParams(search.toString());if(next)q.set(key,next);else q.delete(key);router.replace(`${pathname}${q.size?`?${q.toString()}`:''}`,{scroll:false});},[key,router,pathname,search]);
 return [value,update] as const;
}
