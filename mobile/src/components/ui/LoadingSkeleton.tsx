import React from 'react';
import {View,StyleSheet,ActivityIndicator,Text} from 'react-native';
import {t} from '../../lib/theme/tokens';
export function LoadingSkeleton({message='Loading PawCare…'}:{message?:string}){return <View style={s.root}><ActivityIndicator color={t.brand} size="large"/><Text style={s.caption}>{message}</Text></View>}
const s=StyleSheet.create({root:{padding:35,alignItems:'center',justifyContent:'center'},caption:{color:t.muted,marginTop:12,fontSize:13}});
