const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../kitchen-measures.js'),Room=require('../recipe-room-model.js');
test('known ingredients use ingredient-specific loose household measures',()=>{
 assert.equal(M.hint('Liszt','130 g'),'Kb. 1 bögre · lazán töltve, lesimítva');
 assert.equal(M.hint('Cukor','200 g'),'Kb. 1 bögre');
 assert.equal(M.hint('Rizs','0,2 kg'),'Kb. 1 bögre');
 assert.equal(M.hint('Kakaópor','12 g'),'Kb. 2 csapott evőkanál · lazán töltve, lesimítva');
 assert.equal(M.hint('plain flour','65 g','en'),'≈ ½ mug · loosely filled, levelled');
 assert.equal(M.hint('Tej','1 l'),'Kb. 4 bögre');
 assert.equal(M.hint('Olaj','5 ml'),'Kb. 1 teáskanál');
});
test('unknown density, sensitive small amounts and ambiguous quantities are not guessed',()=>{
 for(const [name,amount] of [['Mandulaliszt','130 g'],['Só','5 g'],['Sütőpor','5 g'],['Élesztő','7 g'],['Csirke','200 g'],['Liszt','100–200 g'],['Liszt','1 g'],['Cukor','ízlés szerint'],['Tojás','2 db']])assert.equal(M.hint(name,amount),'',name);
 const ingredient={name:'Liszt',amount:'130 g'},before=JSON.stringify(ingredient);M.hint(ingredient.name,ingredient.amount);assert.equal(JSON.stringify(ingredient),before);
});
test('detailed recipes survive frontend, assistant validation and cooking context without truncation',async()=>{
 const r={title:'Bread',summary:'Soft loaf',minutes:100,ingredients:[{name:'Liszt',amount:'130 g'}],stepTitles:['Prepare the dough'],steps:['a'.repeat(1000)]};
 const {validRecipes}=await import('../supabase/functions/recipe-ideas/handler.mjs');
 const {normalizeInput}=await import('../supabase/functions/voice-command/handler.mjs');
 assert.deepEqual(Room.recipe(r),r);assert.equal(validRecipes({answer:'Recipe',recipes:[r]},true),true);
 assert.equal(normalizeInput({text:'What next?',assistant:true,companion:true,context:{cookingRecipe:r,cookingStep:0,noScale:true}}).context.cookingRecipe.steps[0],r.steps[0]);
 assert.equal(normalizeInput({text:'How much?',assistant:true,context:{noScale:true}}).context.noScale,true);
 assert.throws(()=>normalizeInput({text:'How much?',assistant:true,context:{noScale:'yes'}}),/INVALID_INPUT/);
 const invalid={...r,steps:['a'.repeat(1001)]};assert.equal(Room.recipe(invalid),null);assert.equal(validRecipes({answer:'Recipe',recipes:[invalid]},true),false);
});
