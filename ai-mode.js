// A preference selects a route, never grants paid access or changes kitchen data.
window.AIMode=(()=>{
 const key=()=> 'morzsa-ai-mode:'+(window.household?.userId()||'guest');
 const get=()=>{try{return localStorage.getItem(key())==='free'?'free':'plus'}catch{return 'plus'}};
 function set(value){if(!['free','plus'].includes(value))return false;try{localStorage.setItem(key(),value)}catch{return false}window.dispatchEvent(new CustomEvent('morzsa-ai-mode-change'));return true}
 return {get,set,isPlus:()=>get()==='plus'};
})();
