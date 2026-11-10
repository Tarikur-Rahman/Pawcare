import React from 'react';import {View,Text} from 'react-native';
import {Visit} from '../../lib/models/domain';import {prettyDate} from '../../lib/utils/date';import {StatusBadge} from '../ui/StatusBadge';import {Surface} from '../ui/Screen';import {t} from '../../lib/theme/tokens';
export function VisitCalendar({visits}:{visits:Visit[]}){return <View style={{gap:10}}>{visits.map(v=><Surface key={v.id}>
 <Text style={{fontWeight:'800',color:t.ink}}>Visit #{v.id} · Pet #{v.petId}</Text><Text style={{marginVertical:7,color:t.muted}}>{prettyDate(v.startsAt)}</Text><StatusBadge value={v.status}/></Surface>)}</View>}
