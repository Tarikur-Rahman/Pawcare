import React,{useState} from 'react';import {Text,View,Pressable,Alert} from 'react-native';import {useNavigation} from '@react-navigation/native';
import {Screen,Surface} from '../../components/ui/Screen';import {Input} from '../../components/ui/Input';import {Button} from '../../components/ui/Button';
import {ErrorBanner} from '../../components/ui/ErrorBanner';import {useAuth} from '../../lib/auth/AuthContext';import {validEmail} from '../../lib/validation/forms';
import {getErrorMessage} from '../../lib/api/errors';import {t} from '../../lib/theme/tokens';
export default function LoginScreen(){const nav=useNavigation<any>(),{login}=useAuth();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
 async function submit(){setError('');if(!validEmail(email)){setError('Enter a valid email address.');return;}if(!password){setError('Password is required.');return;}
 setLoading(true);try{await login(email,password);}catch(e){setError(getErrorMessage(e));}finally{setLoading(false);}}
 return <Screen title="Welcome back" eyebrow="PAWCARE" subtitle="Sign in to care for your pets, appointments and community.">
 <Surface>{!!error&&<ErrorBanner message={error}/>}
 <Input label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} placeholder="you@example.com"/>
 <Input label="Password" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} placeholder="Your password"/>
 <Button title="Sign in" loading={loading} onPress={()=>void submit()}/><View style={{height:10}}/>
 <Button title="Create an account" variant="outline" onPress={()=>nav.navigate('Register')}/><View style={{height:8}}/>
 <Button title="Forgot your password?" variant="ghost" onPress={()=>nav.navigate('ResetPassword')}/>
 </Surface><Button title="Browse public pet listings" variant="ghost" onPress={()=>nav.navigate('ExploreGuest')}/>
 <Text style={{fontSize:12,color:t.muted,textAlign:'center'}}>Accounts require verification before first login. Your password is never stored in the app.</Text>
 </Screen>;
}
