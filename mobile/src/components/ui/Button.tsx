import React from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,ViewStyle} from 'react-native';
import {t} from '../../lib/theme/tokens';
type Props={title:string;onPress:()=>void;disabled?:boolean;loading?:boolean;variant?:'primary'|'outline'|'ghost'|'danger';style?:ViewStyle;testID?:string};
export function Button({title,onPress,disabled,loading,variant='primary',style,testID}:Props){
 const solid=variant==='primary'||variant==='danger';const ink=variant==='danger'?t.danger:variant==='primary'?t.brand:t.ink;
 return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled:!!disabled||!!loading}}
 onPress={onPress} disabled={disabled||loading} style={({pressed})=>[styles.root,{backgroundColor:solid?ink:'transparent',borderColor:ink,opacity:disabled?0.55:pressed?0.75:1},style]}>
 {loading?<ActivityIndicator size="small" color={solid?'white':ink}/>:<Text style={[styles.text,{color:solid?'#FFFFFF':ink}]}>{title}</Text>}
 </Pressable>;
}
const styles=StyleSheet.create({root:{minHeight:48,paddingHorizontal:15,paddingVertical:12,borderRadius:13,alignItems:'center',justifyContent:'center',borderWidth:1},text:{fontSize:14,fontWeight:'700',textAlign:'center'}});
