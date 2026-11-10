import React from 'react';
import {Text,View,StyleSheet} from 'react-native';
import {t} from '../../lib/theme/tokens';
import {Button} from './Button';
export function ErrorBanner({message,onRetry}:{message:string;onRetry?:()=>void}){
 return <View style={s.root}><Text style={s.title}>Unable to complete request</Text><Text style={s.msg}>{message}</Text>{onRetry&&<Button title="Retry" onPress={onRetry} variant="outline" style={{marginTop:12}}/>}</View>;
}
const s=StyleSheet.create({root:{borderWidth:1,borderColor:'#EFBAC0',padding:16,backgroundColor:t.dangerBg,borderRadius:14,marginBottom:14},title:{fontSize:14,fontWeight:'800',color:t.danger},msg:{color:t.ink,marginTop:6,fontSize:13,lineHeight:19}});
