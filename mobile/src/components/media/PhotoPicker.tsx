import React,{useState} from 'react';import {Image,View,Text} from 'react-native';
import {Button} from '../ui/Button';import {ErrorBanner} from '../ui/ErrorBanner';
import {choosePhoto,PickedPhoto,sendPhoto} from '../../lib/media/uploads';import {getErrorMessage} from '../../lib/api/errors';
export function PhotoPicker({onUploaded}:{onUploaded:(result:unknown)=>void}){
 const [photo,setPhoto]=useState<PickedPhoto|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 async function pick(){try{setError('');setPhoto(await choosePhoto());}catch(e){setError(getErrorMessage(e));}}
 async function upload(){if(!photo)return;setLoading(true);setError('');try{onUploaded(await sendPhoto(photo));}catch(e){setError(getErrorMessage(e));}finally{setLoading(false);}}
 return <View style={{gap:10}}><Text style={{fontWeight:'700'}}>Add supporting image (private review)</Text>
 {error?<ErrorBanner message={error}/>:null}
 {photo?<Image source={{uri:photo.uri}} style={{height:140,borderRadius:14}} resizeMode="cover"/>:null}
 <Button title="Choose a photo" variant="outline" onPress={()=>void pick()}/>
 <Button title="Upload to private review" disabled={!photo} loading={loading} onPress={()=>void upload()}/>
 <Text style={{fontSize:12,color:'#647C74'}}>Uploaded images remain quarantined until moderated. Do not post private addresses in photos.</Text></View>;
}
