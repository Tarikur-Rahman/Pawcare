export function prettyDate(v:string|undefined|null){if(!v)return 'Not scheduled';const d=new Date(v);return Number.isNaN(d.getTime())?'Unknown':d.toLocaleString();}
export function isoFromLocal(v:string){const d=new Date(v);if(Number.isNaN(d.getTime()))throw new Error('Enter a valid ISO date and time, for example 2026-11-10T14:30');return d.toISOString();}
export function isoInMinutes(minutes:number){return new Date(Date.now()+minutes*60000).toISOString();}
