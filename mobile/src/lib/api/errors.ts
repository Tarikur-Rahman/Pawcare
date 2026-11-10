export class ApiError extends Error {
 constructor(public status:number, public code:string, message:string,public fieldErrors:Record<string,string[]>={}){super(message);this.name='ApiError';}
}
export const getErrorMessage=(e:unknown)=>e instanceof Error?e.message:'Something went wrong. Please try again.';
export function fromApiResponse(status:number,result:unknown):ApiError{
 const r=(result&&typeof result==='object'?result:{}) as Record<string,unknown>;
 return new ApiError(status,String(r.code||`HTTP_${status}`),String(r.message||'Request unsuccessful.'),
 (r.fieldErrors&&typeof r.fieldErrors==='object'?r.fieldErrors:{}) as Record<string,string[]>);
}
