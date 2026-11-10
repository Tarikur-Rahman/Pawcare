import Link from 'next/link';
import type {Row} from '@/lib/types/domain';import {str} from '@/lib/types/domain';
import {ArrowUpRight} from 'lucide-react';
export function PetCard({pet}:{pet:Row}){const species=str(pet,'species');return <Link href={`/pets/${encodeURIComponent(str(pet,'id'))}`} className="pet-card"><div className="pet-thumb">{species.toLowerCase().includes('cat')?'🐈':species.toLowerCase().includes('bird')?'🦜':'🐕'}</div><div><h3>{str(pet,'name')}</h3><p>{species}{str(pet,'breed')?` · ${str(pet,'breed')}`:''}</p></div><ArrowUpRight size={18} className="pet-arrow"/></Link>;}