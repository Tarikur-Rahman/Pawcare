import React from 'react';import {Text,View,Pressable} from 'react-native';import {useNavigation} from '@react-navigation/native';
import {Screen,SectionTitle} from '../../components/ui/Screen';import {t} from '../../lib/theme/tokens';
const links=[{icon:'💚',title:'Pet adoption',subtitle:'Find a forever friend',route:'AdoptionList'},
 {icon:'🐾',title:'Pet marketplace',subtitle:'Verified listings & welfare checks',route:'Marketplace'},
 {icon:'🔎',title:'Lost & found',subtitle:'Help reunite pets with families',route:'LostFound'},
 {icon:'🥣',title:'Pet food store',subtitle:'Browse pet nutrition products',route:'FoodStore'}];
export default function ExploreScreen(){const nav=useNavigation<any>();return <Screen title="Explore PawCare" eyebrow="COMMUNITY" subtitle="Care, connect, and find what your pets need.">
 <SectionTitle>Discover</SectionTitle>{links.map(link=><Pressable key={link.route} onPress={()=>nav.navigate(link.route)} accessibilityRole="button" style={{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:t.paper,borderColor:t.border,borderWidth:1,borderRadius:18,padding:17}}>
 <Text style={{fontSize:28}}>{link.icon}</Text><View style={{flex:1}}><Text style={{fontWeight:'800',fontSize:17,color:t.ink}}>{link.title}</Text><Text style={{color:t.muted,fontSize:12,marginTop:4}}>{link.subtitle}</Text></View><Text style={{fontSize:22,color:t.brand}}>›</Text></Pressable>)}
 <Text style={{color:t.muted,fontSize:12,lineHeight:18}}>Public listings are moderated. Never publish private contact details or precise lost-pet locations.</Text></Screen>;
}
