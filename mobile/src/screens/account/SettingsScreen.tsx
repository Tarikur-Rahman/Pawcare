import React from 'react';import {Text} from 'react-native';import {useNavigation} from '@react-navigation/native';
import {Screen,Surface} from '../../components/ui/Screen';import {Button} from '../../components/ui/Button';import {t} from '../../lib/theme/tokens';
export default function SettingsScreen(){const nav=useNavigation<any>();return <Screen title="Settings" subtitle="Privacy and device preferences." back>
 <Button title="Reminder preferences" onPress={()=>nav.navigate('ReminderSettings')}/>
 <Surface><Text style={{color:t.ink,fontWeight:'800'}}>Privacy</Text><Text style={{color:t.muted,marginTop:8,lineHeight:20}}>Health records and addresses are private. The offline cache is limited to public listings and catalog data. Uploaded files stay private until verified and approved.</Text></Surface>
 <Surface><Text style={{color:t.ink,fontWeight:'800'}}>API connection</Text><Text style={{color:t.muted,marginTop:8}}>{process.env.EXPO_PUBLIC_API_URL||'Not configured'}</Text></Surface>
 </Screen>}
