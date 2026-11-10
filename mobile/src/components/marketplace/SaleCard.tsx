import React from 'react';import {Pressable,Text,View,StyleSheet} from 'react-native';
import type {SaleListing} from '../../lib/models/domain';import {t} from '../../lib/theme/tokens';
import {formatMoney} from "../../lib/utils/money";
export function SaleCard({item,onPress}:{item:SaleListing;onPress:()=>void}){return <Pressable onPress={onPress} style={{backgroundColor:t.paper,borderWidth:1,borderColor:t.border,padding:16,borderRadius:17,marginBottom:10}} accessibilityRole="button">
 <View style={s.head}><Text style={s.name}>{item.title}</Text><Text style={s.arrow}>›</Text></View>
 <Text style={s.area}>📍 {item.generalArea}</Text>
 {item.description&&<Text style={s.summary} numberOfLines={2}>{item.description}</Text>}
 <Text style={{color:t.brand,fontWeight:"800"}}>{formatMoney(item.askingMinor,item.currency)}</Text>
 </Pressable>}
const s=StyleSheet.create({head:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},name:{fontSize:16,fontWeight:'800',color:t.ink,flex:1},arrow:{fontSize:22,color:t.brand},area:{fontSize:13,color:t.muted,marginTop:6,marginBottom:7},summary:{color:t.muted,fontSize:13,lineHeight:19,marginBottom:6}});
