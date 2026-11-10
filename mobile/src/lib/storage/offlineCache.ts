import AsyncStorage from '@react-native-async-storage/async-storage';
// Public catalog/listings only. Never cache tokens, private pet records, addresses or medical data here.
const allowed=new Set(['adoptions','marketplace','lost-found','shop']);
export async function savePublicCache(key:string,value:unknown){if(!allowed.has(key))return;
 await AsyncStorage.setItem(`public:v1:${key}`,JSON.stringify({savedAt:Date.now(),value}));}
export async function readPublicCache<T>(key:string):Promise<{data:T;ageMs:number}|null>{
 if(!allowed.has(key))return null;try{const s=await AsyncStorage.getItem(`public:v1:${key}`);if(!s)return null;
 const raw=JSON.parse(s) as {savedAt:number;value:T};if(Date.now()-raw.savedAt>24*3600*1000)return null;
 return {data:raw.value,ageMs:Date.now()-raw.savedAt};}catch{return null;}
}
