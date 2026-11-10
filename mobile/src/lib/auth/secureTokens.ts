import * as SecureStore from 'expo-secure-store';
const ACCESS='pawcare_access_v1',REFRESH='pawcare_refresh_v1';
let accessToken:string|null=null;
export async function getAccessToken(){if(accessToken!==null)return accessToken; return SecureStore.getItemAsync(ACCESS);}
export async function getRefreshToken(){return SecureStore.getItemAsync(REFRESH);}
export async function storeTokens(access:string,refresh:string){
 await SecureStore.setItemAsync(ACCESS,access);await SecureStore.setItemAsync(REFRESH,refresh);
 accessToken=access;
}
export async function clearTokens(){accessToken=null;await Promise.all([SecureStore.deleteItemAsync(ACCESS),SecureStore.deleteItemAsync(REFRESH)]);}
export function forgetAccessInMemory(){accessToken=null;}
