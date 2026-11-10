export const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const validPassword=(v:string)=>v.length>=12&&v.length<=128;
export function required(value:string,name:string,max=250){const s=value.trim();if(!s)throw new Error(`${name} is required.`);if(s.length>max)throw new Error(`${name} must be under ${max} characters.`);return s;}
export function positiveId(value:string|number,name='ID'){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw new Error(`Invalid ${name}.`);return n;}
