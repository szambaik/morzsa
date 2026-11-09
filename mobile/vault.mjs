// Only native platforms use this adapter. A failed secure write never destroys the old save.
export function createVault(secure,legacy){
 let writes=Promise.resolve();
 const missing=e=>e?.message==='Item with given key does not exist';
 async function get(key){try{return (await secure.get({key})).value}catch(e){if(missing(e))return null;throw e}}
 function set(key,value){const next=writes.catch(()=>{}).then(()=>secure.set({key,value}));writes=next;return next}
 return {
  async loadSession(){
   const stored=await get('morzsa-session');if(stored!==null){const value=JSON.parse(stored);legacy.removeItem('morzsa-session');return value}
   const old=legacy.getItem('morzsa-session');if(!old)return null;
   const value=JSON.parse(old);await set('morzsa-session',JSON.stringify(value));legacy.removeItem('morzsa-session');return value;
  },
  async saveSession(value){await set('morzsa-session',JSON.stringify(value));legacy.removeItem('morzsa-session')},
  async saveProof(value){await set('morzsa-native-pkce',JSON.stringify(value));legacy.removeItem('morzsa-native-pkce')},
  async takeProof(){const raw=await get('morzsa-native-pkce');await set('morzsa-native-pkce','null');legacy.removeItem('morzsa-native-pkce');return raw?JSON.parse(raw):null}
 };
}
