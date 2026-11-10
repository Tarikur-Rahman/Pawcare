import type {Role} from '@/lib/types/domain';
import {roleHome} from './permissions';

const ownerRoots = new Set([
  'dashboard','pets','care','appointments','expenses','my-adoptions','my-listings',
  'my-reports','cart','checkout','orders','favorites','notifications','profile',
]);

/** Only honor an internal return path belonging to the signed-in user's workspace. */
export function postLoginDestination(role:Role, next?:string):string {
  const fallback=roleHome[role];
  if (!next || !next.startsWith('/') || next.startsWith('//') ||
      /[\\\r\n#]/.test(next) || /%(?:2f|5c|0a|0d|2e)/i.test(next)) return fallback;
  let parsed:URL;
  try { parsed=new URL(next,'https://pawcare.invalid'); } catch { return fallback; }
  if (parsed.origin!=='https://pawcare.invalid' ||
      !/^\/[a-zA-Z0-9/_-]*$/.test(parsed.pathname)) return fallback;
  const root=parsed.pathname.split('/')[1];
  const allowed=role==='ADMIN'?root==='admin':role==='VET'?root==='vet':ownerRoots.has(root);
  return allowed ? parsed.pathname+parsed.search : fallback;
}
