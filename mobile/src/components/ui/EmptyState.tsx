import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {t} from '../../lib/theme/tokens';
import {Button} from './Button';
export function EmptyState({title='Nothing here yet',message='New items will appear here.',action,onAction,icon='🐾'}:{title?:string;message?:string;action?:string;onAction?:()=>void;icon?:string}){
 return <View style={s.root}><Text style={s.icon}>{icon}</Text><Text style={s.title}>{title}</Text><Text style={s.msg}>{message}</Text>{!!action&&!!onAction&&<Button title={action} onPress={onAction} variant="outline" style={{alignSelf:'stretch',marginTop:12}}/>}</View>
}
const s=StyleSheet.create({root:{alignItems:'center',borderRadius:18,backgroundColor:t.paper,padding:28,borderWidth:1,borderColor:t.border},icon:{fontSize:34,marginBottom:10},title:{fontSize:17,fontWeight:'800',color:t.ink,textAlign:'center'},msg:{fontSize:14,color:t.muted,textAlign:'center',marginTop:8,lineHeight:20}});
