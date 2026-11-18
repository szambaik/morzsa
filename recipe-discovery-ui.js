window.RecipeDiscoveryUI=(()=>{
 const say=(hu,en)=>language==='en'?en:hu;
 function tools(value,disabled=false){
  if(!value)return '';const selected=new Set(value.refinements),receipt=CraftingModel.receipt(value.request,language)||value.request;
  return '<section class="recipe-idea-tools" aria-label="'+say('További receptötletek','More recipe ideas')+'"><p>'+say('Megtartott igények: ','Keeping your request: ')+esc(receipt.slice(0,150))+'</p><button class="small-button" data-more-ideas '+(disabled?'disabled':'')+'>'+say('Új ötlet','New idea')+'</button><details><summary>'+say('Finomítanék','Refine these ideas')+'</summary><form data-refine-ideas><fieldset><legend>'+say('Mi legyen más?','What should change?')+'</legend>'+[['less_cleanup','Kevesebb mosogatás','Less washing up'],['cheap','Olcsóbb','Cheaper'],['more_vegetables','Több zöldség','More vegetables']].map(([key,hu,en])=>'<label><input type="checkbox" name="refinement" value="'+key+'" '+(selected.has(key)?'checked ':'')+(disabled?'disabled':'')+'>'+say(hu,en)+'</label>').join('')+'</fieldset><button class="small-button" '+(disabled?'disabled':'')+'>'+say('Új ötletek ezekkel','New ideas with these preferences')+'</button></form></details></section>';
 }
 function variants(attribute,disabled=false){return '<details class="recipe-variants"><summary>'+say('Más változatot kérek','Try another version')+'</summary><div role="group" aria-label="'+say('Receptvariációk','Recipe variations')+'">'+[['quick','Gyorsabb','Quicker'],['cheap','Olcsóbb','Cheaper'],['healthy','Egészségesebb','Healthier'],['premium','Prémium','Premium']].map(([key,hu,en])=>'<button class="small-button" '+attribute+'="'+key+'" '+(disabled?'disabled':'')+'>'+say(hu,en)+'</button>').join('')+'</div></details>'}
 return {tools,variants};
})();
