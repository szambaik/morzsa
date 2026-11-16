const {test}=require('node:test'),assert=require('node:assert/strict'),Q=require('../quantity-model'),S=require('../recipe-shopping'),C=require('../companion-model'),R=require('../recipe-room-model');
const recipe={title:'Banános palacsinta',summary:'Próbarecept',servings:2,minutes:15,ingredients:[{name:'Banán',amount:'1 nagy db'},{name:'Olaj',amount:'1 tk'},{name:'Tej',amount:'200 ml'}],steps:['Keverd össze.','Süsd meg.']};
test('decimal commas and points normalize into existing RPC limits without mutating old values',()=>{
 for(const value of ['0,5','0.5','.5'])assert.deepEqual(Q.normalize(value,'l'),{quantity:500,unit:'ml'});
 assert.deepEqual(Q.normalize('0,25','kg'),{quantity:250,unit:'g'});assert.deepEqual(Q.normalize('2','l'),{quantity:2,unit:'l'});assert.deepEqual(Q.normalize('1.5','l'),{quantity:1.5,unit:'l'});
 for(const value of ['',null,' ','0','-1','NaN','Infinity','1000','1e2','0.0001','1.2.3'])assert.equal(Q.normalize(value,'kg'),null,value);
 assert.equal(Q.normalize('.5','db'),null);assert.equal(Q.normalize('1','bogus'),null);assert.deepEqual(Q.normalize('999','g'),{quantity:999,unit:'g'});
});
test('unit localization only changes presentation, including old and unknown units',()=>{
 for(const [code,en] of [['db','pcs'],['csomag','pack'],['doboz','box'],['üveg','bottle'],['pohár','cup'],['egyedi','egyedi']]){assert.equal(Q.label(code,'en'),en);assert.equal(Q.label(code,'hu'),code)}
 assert.equal(Q.format(1.5,'l','hu'),'1,5 l');assert.equal(Q.format(1.5,'l','en'),'1.5 l');assert.equal(Q.recipeAmount('1,5 nagy db','en'),'1.5 large pcs');assert.equal(Q.recipeAmount('1,5 tk','en'),'1.5 tsp');
});
test('purchase preview describes the same normalized quantities that are committed, preserving recipe needs',()=>{
 const state={stock:{},cart:[],custom:[]},resolve=n=>n,unit=n=>n==='Olaj'?'l':'db',portions={base:2,target:3};
 const scaled=require('../recipe-portions').view(recipe,portions),plan=S.plan(state,recipe,resolve,unit,null,portions);
 assert.equal(S.purchase(state,scaled.ingredients[0],resolve,unit).reason,'rounded');assert.equal(S.purchase(state,scaled.ingredients[1],resolve,unit).reason,'standard');assert.equal(S.purchase(state,scaled.ingredients[2],resolve,unit).reason,'exact');
 for(const i of scaled.ingredients){const p=S.purchase(state,i,resolve,unit),saved=plan.next.cart.find(x=>x.name===i.name);assert.equal(p.quantity,saved.quantity);assert.equal(p.unit,saved.unit);assert.equal(saved.recipeNeeds[0].amount,i.amount)}
 const existing={...state,cart:[{...plan.next.cart[1],quantity:3,done:true,notes:'keep'}]},second={...recipe,title:'Másik recept'};const linked=S.plan(existing,second,resolve,unit,['Olaj'],portions);assert.equal(S.purchase(existing,scaled.ingredients[1],resolve,unit).reason,'kept');assert.equal(linked.next.cart[0].quantity,3);assert.equal(linked.next.cart[0].done,true);assert.equal(linked.next.cart[0].notes,'keep');assert.equal(linked.next.cart[0].recipeNeeds.length,2);assert.deepEqual(S.plan(linked.next,second,resolve,unit,['Olaj'],portions).next,linked.next);
});
test('completion records actual cooked portions separately without rewriting recipe or duplicate receipts',()=>{
 let book=C.workspace(null,R.recipe);book=C.startRecipe(book,recipe,'recipe',R.recipe);book=C.setPortions(book,'recipe',{base:2,target:3},R.recipe);const original=JSON.stringify(book.threads.find(t=>t.id==='recipe').recipe);
 for(const [label,expected] of [['Lezárt főzés: ',/Elkészítetted: 3 adag. Alaprecept: 2 adag/],['Cooking session finished: ',/You cooked 3 servings. Base recipe: 2 servings/]]){const result=C.finishRecipe(book,'recipe',R.recipe,label),completed=result.threads.find(t=>t.id==='recipe'),receipt=result.threads.find(t=>t.id===completed.parentId).messages.at(-1);assert.match(receipt.result,expected);assert.equal(JSON.stringify(completed.recipe),original);assert.equal(JSON.stringify(receipt.recipes[0]),original);assert.deepEqual(C.finishRecipe(result,'recipe',R.recipe,label),result);assert.match(C.normalize(result,R.recipe).threads.find(t=>t.id===completed.parentId).messages.at(-1).result,expected)}
});
