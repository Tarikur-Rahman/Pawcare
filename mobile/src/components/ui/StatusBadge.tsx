import React from 'react';
import {Text,View,StyleSheet} from 'react-native';
import {t} from '../../lib/theme/tokens';
export function StatusBadge({value}:{value?:string|null}){
 const label=(value||'DRAFT').replaceAll('_',' ');
 const good=/ACTIVE|PUBLISHED|CONFIRMED|COMPLETED|APPROVED|DELIVERED|REUNITED/i.test(label);
 const warn=/PENDING|PLACED|DRAFT|REQUESTED|REVIEW/i.test(label);
 return <View style={[s.wrap,{backgroundColor:good?t.tint:warn?t.warningBg:t.dangerBg}]}><Text style={[s.label,{color:good?t.success:warn?t.warning:t.danger}]}>{label}</Text></View>;
}
const s=StyleSheet.create({wrap:{borderRadius:99,paddingHorizontal:9,paddingVertical:5,alignSelf:'flex-start'},label:{fontSize:10,letterSpacing:0.5,fontWeight:'800'}});
