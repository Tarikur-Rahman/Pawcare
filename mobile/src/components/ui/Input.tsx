import React from 'react';
import {View,Text,TextInput,StyleSheet,TextInputProps} from 'react-native';
import {t} from '../../lib/theme/tokens';
type Props=TextInputProps&{label:string;error?:string;helper?:string};
export function Input({label,error,helper,...props}:Props){return <View style={styles.wrap}>
 <Text style={styles.label}>{label}</Text>
 <TextInput accessibilityLabel={label} placeholderTextColor="#8BA09A" style={[styles.input,error?{borderColor:t.danger}:{}]} {...props}/>
 {!!error&&<Text style={styles.error}>{error}</Text>}
 {!!helper&&!error&&<Text style={styles.helper}>{helper}</Text>}
 </View>}
const styles=StyleSheet.create({wrap:{marginBottom:14},label:{color:t.ink,fontSize:13,fontWeight:'700',marginBottom:7},input:{minHeight:49,borderWidth:1,borderColor:t.border,backgroundColor:t.paper,borderRadius:12,padding:12,fontSize:15,color:t.ink},error:{fontSize:12,color:t.danger,marginTop:5},helper:{fontSize:12,color:t.muted,marginTop:5}});
