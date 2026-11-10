import * as ImagePicker from 'expo-image-picker';
import {uploadFile} from '../api/http';
export type PickedPhoto={uri:string;fileName:string;mimeType:string};
export async function choosePhoto():Promise<PickedPhoto|null>{
 const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:0.8,allowsEditing:false,selectionLimit:1});
 if(result.canceled||!result.assets[0])return null;
 const a=result.assets[0];return {uri:a.uri,fileName:a.fileName||`pet-${Date.now()}.jpg`,mimeType:a.mimeType||'image/jpeg'};
}
export async function sendPhoto(p:PickedPhoto){return uploadFile(p.uri,p.fileName,p.mimeType);}
