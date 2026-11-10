import React from 'react';import {Text} from 'react-native';
import {Screen,Surface} from '../../components/ui/Screen';import {t} from '../../lib/theme/tokens';
export default function ResetPasswordScreen(){return <Screen title="Password recovery" subtitle="Account recovery" back><Surface>
<Text style={{color:t.ink,fontWeight:'800'}}>Recovery is not available yet</Text>
<Text style={{color:t.muted,marginTop:10,lineHeight:22}}>The PawCare API does not yet expose a verified password-reset endpoint. We won't pretend to send an email. Contact the administrator through the approved support channel until the secure recovery workflow is implemented.</Text>
</Surface></Screen>}
