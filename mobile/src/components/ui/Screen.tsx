import React from 'react';
import {ScrollView,StyleSheet,Text,View,Pressable,RefreshControl} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {t} from '../../lib/theme/tokens';
export function Screen({title,subtitle,children,back=false,refreshing=false,onRefresh,eyebrow}:{title:string;subtitle?:string;children:React.ReactNode;back?:boolean;refreshing?:boolean;onRefresh?:()=>void;eyebrow?:string}){
 const insets=useSafeAreaInsets(),nav=useNavigation<any>();
 return <ScrollView style={s.root} keyboardShouldPersistTaps="handled" refreshControl={onRefresh?<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.brand}/>:undefined} contentContainerStyle={[s.content,{paddingTop:Math.max(insets.top,14)+7,paddingBottom:Math.max(insets.bottom,15)+48}]}>
  {back&&<Pressable onPress={()=>nav.goBack()} accessibilityRole="button" style={s.back}><Text style={s.backtext}>‹  Back</Text></Pressable>}
  {!!eyebrow&&<Text style={s.eyebrow}>{eyebrow.toUpperCase()}</Text>}
  <Text style={s.title}>{title}</Text>{!!subtitle&&<Text style={s.subtitle}>{subtitle}</Text>}
  <View style={s.body}>{children}</View>
 </ScrollView>;
}
export function Surface({children}:{children:React.ReactNode}){return <View style={s.surface}>{children}</View>}
export function SectionTitle({children}:{children:React.ReactNode}){return <Text style={s.section}>{children}</Text>}
export function LabeledValue({label,value}:{label:string;value:unknown}){return <View style={s.valueRow}><Text style={s.label}>{label}</Text><Text style={s.value}>{value===undefined||value===null||value===''?'—':String(value)}</Text></View>}
const s=StyleSheet.create({root:{flex:1,backgroundColor:t.bg},content:{paddingHorizontal:20},back:{marginBottom:12},backtext:{color:t.brand,fontWeight:'700',fontSize:15},eyebrow:{fontSize:11,fontWeight:'800',letterSpacing:1.7,color:t.brand,marginBottom:6},title:{fontSize:30,fontWeight:'900',color:t.ink,letterSpacing:-0.7},subtitle:{fontSize:14,color:t.muted,marginTop:6,lineHeight:21},body:{marginTop:22,gap:14},surface:{backgroundColor:t.paper,borderWidth:1,borderColor:t.border,borderRadius:t.radius,padding:16},section:{fontSize:19,fontWeight:'800',color:t.ink,marginTop:6},valueRow:{flexDirection:'row',justifyContent:'space-between',gap:12,marginVertical:6,borderBottomWidth:1,borderBottomColor:t.bg,paddingBottom:7},label:{color:t.muted,fontSize:13,flex:1},value:{color:t.ink,fontSize:13,fontWeight:'600',flex:2,textAlign:'right'}});
