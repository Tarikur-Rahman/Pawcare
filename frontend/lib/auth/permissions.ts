import type {Role} from '@/lib/types/domain';
export const roleHome:Record<Role,string>={OWNER:'/dashboard',VET:'/vet',ADMIN:'/admin'};
export function can(role:Role,area:'owner'|'vet'|'admin'):boolean{return (area==='owner'&&role==='OWNER')||(area==='vet'&&role==='VET')||(area==='admin'&&role==='ADMIN');}
