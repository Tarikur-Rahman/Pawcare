import type {ApiErrorBody} from '@/lib/types/domain';
export class ApiError extends Error {
 constructor(public status:number,public code:string,message:string,public requestId?:string,public fieldErrors?:Record<string,string[]>) {super(message);this.name='ApiError';}
}
export function fromResponse(status:number,payload:unknown):ApiError {
 const body=(payload&&typeof payload==='object'?payload:{}) as ApiErrorBody;
 return new ApiError(status,body.code||`HTTP_${status}`,body.message||(status===503?'The service is unavailable. Please try again later.':'Request failed.'),body.requestId,body.fieldErrors);
}
export async function jsonOrNull(response:Response):Promise<unknown> {
 const ct=response.headers.get('content-type')||'';
 if(!ct.includes('json'))return null;
 try{return await response.json();}catch{return null;}
}
