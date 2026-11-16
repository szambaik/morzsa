const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('pantry details add once through the shared cart save path and repeated add preserves list membership',()=>{
 const buttons={'.close':{},'[data-pantry-list]':{},'[data-pantry-quantity]':{addEventListener(){}}};
 const dialog={open:false,setAttribute(){},querySelector:s=>buttons[s],querySelectorAll:()=>[],showModal(){this.open=true},close(){this.open=false}};
 const before={stock:{Tej:1},custom:[],cart:[{name:'Tojás',quantity:7,unit:'db',done:false,recipeNeeds:[{recipe:{title:'Palacsinta'}}]}],history:[],likes:['keep']};let saved=0;
 const c={scrollY:0,window:{},document:{hasFocus:()=>false,getElementById:()=>dialog,createElement:()=>dialog,body:{append(){}}},language:'hu',state:before,catalog:[{name:'Tej'}],productArtwork:{},displayName:n=>n,esc:n=>n,voiceContext:()=> 'test',WorkspaceEntry:require('../workspace-entry'),QuickEntry:require('../quick-entry'),CompanionModel:require('../companion-model'),productUnit:()=> 'l',basketFeedback(){},showVoiceUndo(){},refreshCatalog(){},toast(){},saveShoppingState:next=>{c.state=next;saved++;return true}};
 vm.runInNewContext(fs.readFileSync('pantry-library.js','utf8'),c);c.openPantryDetails('Tej');buttons['[data-pantry-list]'].onclick();assert.equal(saved,1);assert.equal(c.state.cart.length,2);assert.deepEqual(c.state.cart[0],before.cart[0]);assert.equal(c.state.stock.Tej,1);assert.equal(c.state.likes,before.likes);
 assert.equal(buttons['[data-pantry-list]'].disabled,true);buttons['[data-pantry-list]'].onclick();assert.equal(saved,1);assert.equal(c.state.cart.length,2);assert.deepEqual(c.state.cart[0],before.cart[0]);
});
