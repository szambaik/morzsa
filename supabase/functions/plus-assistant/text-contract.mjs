import {bodyFor} from '../voice-command/handler.mjs';
import {RECIPE_IMAGE_INSTRUCTION} from '../recipe-ideas/handler.mjs';
// Provider-only representation. Public clients and saved recipes keep the
// original steps:string[] + stepTitles:string[] contract.
export function textBodyFor(clean){
 const body=bodyFor(clean),schema=body.generationConfig.responseSchema;
 delete schema.properties.transcript;schema.required=schema.required.filter(k=>k!=='transcript');
 for(const part of body.systemInstruction.parts){
  part.text=part.text.replace(RECIPE_IMAGE_INSTRUCTION,'')
   .replace('Provide stepTitles, one short descriptive 3–7 word heading per step in the same order, at most 80 characters each; name the action, never just Step 1 or a number. Keep steps as plain strings and titles in the separate stepTitles array.', 'Each steps item pairs a title (3–7 words, at most 80 characters, naming the action) with its complete instruction (at most 1000 characters).')
   .replace('Within each step string,','Within each step instruction string,')
   .replace('Recipe ingredient names, amounts and steps must be plain text','Recipe ingredient names, amounts and step instructions must be plain text');
 }
 body.systemInstruction.parts.push({text:'The server supplies transcript from the written request. Do not generate transcript. Default to one complete recipe unless the user explicitly requests alternatives or the weekly plan requires multiple recipes. For a follow-up question, answer it without regenerating a recipe unless requested. Each recipe step must pair its title with the full instruction for that phase. In a multi-action instruction, separate numbered actions with newlines, restarting at 1. Include the actual cooking and doneness steps, not only preparation.'});
 const recipe=schema.properties.recipes?.items;
 if(recipe){
  // Plus images already consume title, ingredients and method directly.
  delete recipe.properties.imagePrompt;delete recipe.properties.stepTitles;
  recipe.required=recipe.required.filter(k=>!['imagePrompt','stepTitles'].includes(k));
  Object.assign(schema.properties.recipes,{minItems:0,maxItems:3});
  Object.assign(recipe.properties.steps,{minItems:1,maxItems:6});
  Object.assign(recipe.properties.ingredients,{minItems:1,maxItems:15});
  Object.assign(recipe.properties.equipment,{maxItems:4});
  recipe.properties.steps.items={type:'OBJECT',properties:{title:{type:'STRING'},instruction:{type:'STRING'}},required:['title','instruction']};
 }
 schema.properties.operations.maxItems=30;
 const props=schema.properties;
 if(props.recipes)schema.properties={answer:props.answer,recipes:props.recipes,...Object.fromEntries(Object.entries(props).filter(([k])=>!['answer','recipes'].includes(k)))};
 return body;
}
export function publicTextOutput(output,transcript){
 return {...output,transcript,...(Array.isArray(output?.recipes)?{recipes:output.recipes.map(r=>{
  if(!Array.isArray(r?.steps)||!r.steps.length||!r.steps.every(s=>s&&typeof s==='object'&&typeof s.title==='string'&&typeof s.instruction==='string'))return r;
  return {...r,steps:r.steps.map(s=>s.instruction),stepTitles:r.steps.map(s=>s.title)};
 })}:{})};
}
