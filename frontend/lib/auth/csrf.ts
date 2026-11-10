export function sameOriginMutation(request:Request):boolean {
 const marker=request.headers.get('x-pawcare-request');
 if(marker!=='web')return false;
 const site=request.headers.get('sec-fetch-site');
 if(site&&site!=='same-origin'&&site!=='none')return false;
 const origin=request.headers.get('origin');
 if(origin){try{if(new URL(origin).origin!==new URL(request.url).origin)return false;}catch{return false;}}
 return true;
}
