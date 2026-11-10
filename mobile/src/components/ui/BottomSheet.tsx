import React from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {t} from '../../lib/theme/tokens';
export function BottomSheet({visible,onClose,title,children}:{visible:boolean;onClose:()=>void;title:string;children:React.ReactNode}){
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <View style={styles.full}><Pressable style={styles.backdrop} accessibilityLabel="Close panel" onPress={onClose}/>
  <View style={styles.sheet}><View style={styles.handle}/><View style={styles.head}><Text style={styles.title}>{title}</Text><Pressable onPress={onClose} accessibilityRole="button"><Text style={styles.close}>Close</Text></Pressable></View>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:25}}>{children}</ScrollView></View></View>
 </Modal>;
}
const styles=StyleSheet.create({full:{flex:1,justifyContent:'flex-end'},backdrop:{...StyleSheet.absoluteFill,backgroundColor:'#0D202077'},sheet:{backgroundColor:t.paper,maxHeight:'87%',padding:20,borderTopLeftRadius:26,borderTopRightRadius:26},handle:{alignSelf:'center',width:40,height:5,backgroundColor:'#D3DEDB',borderRadius:10,marginBottom:17},head:{flexDirection:'row',justifyContent:'space-between',marginBottom:14,alignItems:'center'},title:{fontSize:20,fontWeight:'800',color:t.ink},close:{color:t.brand,fontWeight:'700'}});
