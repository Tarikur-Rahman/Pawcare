import React,{useState} from 'react';import {Alert} from 'react-native';import {useNavigation} from '@react-navigation/native';
import {Screen,Surface} from '../../components/ui/Screen';import {Input} from '../../components/ui/Input';import {Button} from '../../components/ui/Button';import {ErrorBanner} from '../../components/ui/ErrorBanner';
import {useAuth} from '../../lib/auth/AuthContext';import {validEmail,validPassword} from '../../lib/validation/forms';import {getErrorMessage} from '../../lib/api/errors';
export default function RegisterScreen(){const nav=useNavigation<any>(),{register}=useAuth();const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');const [error,setError]=useState(''),[loading,setLoading]=useState(false);
 async function submit(){setError('');if(name.trim().length<2){setError('Enter your name.');return;}if(!validEmail(email)){setError('Enter a valid email.');return;}if(!validPassword(password)){setError('Use at least 12 characters in your password.');return;}if(password!==confirm){setError('Passwords do not match.');return;}
 setLoading(true);try{const message=await register(email,password,name);Alert.alert('Registration submitted',message,[{text:'Back to login',onPress:()=>nav.goBack()}]);}catch(e){setError(getErrorMessage(e));}finally{setLoading(false);}}
 return <Screen title="Join PawCare" subtitle="Create your pet-care account. Verification is required before sign-in." back><Surface>
 {!!error&&<ErrorBanner message={error}/>}<Input label="Full name" value={name} onChangeText={setName} autoComplete="name"/>
 <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/>
 <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry helper="12–128 characters"/>
 <Input label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry/>
 <Button title="Create account" loading={loading} onPress={()=>void submit()}/></Surface></Screen>;
}
