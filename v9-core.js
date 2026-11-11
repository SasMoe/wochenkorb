/* Wochenkorb V9 – shared, deterministic grocery quantities and recipe nutrition.
   No HTTP calls, no guesses about food density or nutrient composition. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WochenkorbV9=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DAYS=['Mo','Di','Mi','Do','Fr','Sa','So'], VESPER_ID='wk-family-vesper';
const profilesDefault=[{id:'adult-1',name:'Person 1',factor:1},{id:'adult-2',name:'Person 2',factor:1},{id:'child-1',name:'Kind',factor:0.5}];
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
const n=x=>{const a=Number(x);return Number.isFinite(a)?a:0},round=x=>Math.round((n(x)+Number.EPSILON)*1000)/1000;
const conversions={
 g:['g',1],gramm:['g',1],kg:['g',1000],mg:['g',0.001],ml:['ml',1],l:['ml',1000],liter:['ml',1000],litre:['ml',1000],cl:['ml',10],
 stk:['Stk',1],st:['Stk',1],stuck:['Stk',1],stueck:['Stk',1],stuecke:['Stk',1],zehe:['Zehe',1],zehen:['Zehe',1],
 scheibe:['Scheibe',1],scheiben:['Scheibe',1],el:['EL',1],tl:['TL',1],handvoll:['Handvoll',1],bund:['Bund',1],
 dose:['Dose',1],dosen:['Dose',1],packung:['Packung',1],packungen:['Packung',1],pck:['Packung',1],pack:['Packung',1],
 prise:['Prise',1],prisen:['Prise',1],tasse:['Tasse',1],tassen:['Tasse',1]
};
function unit(raw){const key=norm(raw).replace(/\s/g,'');const u=conversions[key];return u?{name:u[0],factor:u[1],recognized:true}:{name:String(raw||'').trim()||'Stk',factor:1,recognized:false};}
function convert(value,raw){const u=unit(raw);return {value:round(Math.max(0,n(value))*u.factor),unit:u.name,recognized:u.recognized};}
function format(x){return new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(round(x));}
function showAmount(q,u){return format(q)+' '+u;}
function profiles(s){return Array.isArray(s?.v9Profiles)&&s.v9Profiles.length?s.v9Profiles:profilesDefault;}
function meals(s){if(Array.isArray(s?.v9Meals))return s.v9Meals;return (s?.plan||[]).filter(x=>x?.id).map((p,i)=>({id:'migrate-'+p.id+'-'+i,recipeId:p.id,day:'',parts:{},servings:Math.max(0.25,n(p.servings)||2),guests:0}));}
function mealPortions(members,meal){if(meal?.parts&&Object.keys(meal.parts).length)return round(Object.values(meal.parts).reduce((a,x)=>a+Math.max(0,n(x)),0)+Math.max(0,n(meal.guests)));
 if(n(meal?.servings)>0)return round(n(meal.servings));return round(members.reduce((a,p)=>a+Math.max(0,n(p.factor)),0));}
function newMeal(recipeId,members,day='',recipe=null){const base={id:'v9-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),recipeId,day:DAYS.includes(day)?day:''};return isWholeRecipe(recipe)?{...base,batches:1}:{...base,parts:Object.fromEntries(members.map(p=>[p.id,Math.max(0,n(p.factor))])),guests:0};}
// A cake is made as a whole batch; its original "servings" represent slices/yield,
// not the number of family members who have to eat it this week.
const batchNames=/\b(?:kuchen|torte|muffin|muffins|cookie|cookies|keks|kekse|makronen|kugeln|brownie|brownies|eiweissbrot|backbrot|bananenbrot|brotlaib|gebaeck|geb[aä]ck)\b/i;
function isWholeRecipe(recipe){
 if(recipe?.planningType==='batch')return true;
 if(recipe?.planningType==='portions')return false;
 const name=norm(recipe?.name||'');
 if(/pfannkuchen|eierkuchen|kartoffelpuffer/.test(name))return false;
 return /(?:kuchen|torte|muffin|cookie|keks|makrone|kugeln|brownie|eiweissbrot|bananenbrot|brotlaib|geback)/i.test(name);
}
function batchUnit(recipe){const name=norm(recipe?.name);if(/kuchen|torte/.test(name))return 'Kuchen';if(/brot/.test(name))return 'Brot';return 'Backdurchgang';}
function batchYieldUnit(recipe){const name=norm(recipe?.name);if(/kuchen|torte/.test(name))return 'Stücke';if(/brot/.test(name))return 'Scheiben';if(/cookie|keks|muffin|makrone|kugeln|brownie/.test(name))return 'Stück';return 'Portionen';}
function batchCount(meal){const value=n(meal?.batches);return value>0?Math.min(20,Math.max(1,Math.round(value))):1;}
const fingerprint=r=>JSON.stringify([n(r?.servings),r?.ingredients||[]]);
function nutrition(recipe){const data=recipe?.nutrition,values=data?.perServing;
 if(!values||data.fingerprint!==fingerprint(recipe)||!['kcal','protein','carbs','fat'].every(k=>Number.isFinite(Number(values[k]))&&values[k]!==null&&n(values[k])>=0))return null;
 return {kcal:n(values.kcal),protein:n(values.protein),carbs:n(values.carbs),fat:n(values.fat),fiber:values.fiber==null?null:n(values.fiber),quality:data.quality||'estimated',source:data.source||'Nicht dokumentiert'};}
function nutritionScaled(recipe,portions){const o=nutrition(recipe);if(!o)return null;return {...o,kcal:round(o.kcal*portions),protein:round(o.protein*portions),carbs:round(o.carbs*portions),fat:round(o.fat*portions),fiber:o.fiber===null?null:round(o.fiber*portions)};}
function ingredientName(raw){const s=String(raw||'').trim();
 const t=s.match(/(?:dose\s*\/?\s*n?|dosen?|konserve\s*\/?\s*n?)\s+tomaten[\s,]+(?:st[üu]ckige|gehackte|gesch[aä]lte)/i);
 if(t)return /gesch[aä]lt/i.test(s)?'Geschälte Tomaten (Dose)':/gehackt/i.test(s)?'Gehackte Tomaten (Dose)':'Stückige Tomaten (Dose)';
 return s;
}
function recipeLine(raw,quantity,rawUnit){const name=ingredientName(raw),q=Math.max(0,n(quantity)),u=unit(rawUnit);
 // Preserve the pack weight on legacy Chefkoch imports that were parsed as 1 Stück.
 if(name!==String(raw||'').trim()&&u.name==='Stk'){
  const g=String(raw).match(/\(\s*(?:ca\.?\s*)?(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\s*\)/i);
  if(g){const w=convert(q*Number(g[1].replace(',','.')),g[2]);return {name,quantity:w.value,unit:w.unit};}
 }
 const value=convert(q,rawUnit);return {name,quantity:value.value,unit:value.unit};
}
function entries(state,alias){const output=[],map=new Map((state?.recipes||[]).map(r=>[r.id,r])),members=profiles(state),keyOf=typeof alias==='function'?alias:norm;
 for(const meal of meals(state)){
  const recipe=map.get(meal.recipeId),whole=recipe&&isWholeRecipe(recipe);
  const amount=whole?batchCount(meal):mealPortions(members,meal);
  if(!(amount>0))continue;
  if(meal.recipeId===VESPER_ID){for(const member of members){const factor=n(meal.parts?.[member.id]);if(!(factor>0))continue;for(const item of state?.v9Vesper?.[member.id]||[]){if(!Array.isArray(item)||!item[0])continue;const c=convert(n(item[1])*factor,item[2]);const name=ingredientName(item[0]);output.push({name,key:keyOf(name),quantity:c.value,unit:c.unit,source:'Vesper · '+member.name});}}}
  else{if(!recipe)continue;const coefficient=whole?amount:amount/Math.max(1,n(recipe.servings)||2);
   for(const ing of recipe.ingredients||[]){if(!Array.isArray(ing)||!ing[0])continue;
    const unquantified=/nach geschmack|optional|nach bedarf/i.test(ing[2]||'');const v=recipeLine(ing[0],n(ing[1])*coefficient,ing[2]||'Stk');
    output.push({name:v.name,key:keyOf(v.name),quantity:unquantified?0:v.quantity,unit:unquantified?'':v.unit,source:recipe.name,unquantified});
   }
  }
 }
 return output;
}
function needs(state,alias){const rows=new Map();for(const x of entries(state,alias)){let row=rows.get(x.key);if(!row){row={name:x.name,key:x.key,units:{},sources:[],unquantified:false};rows.set(x.key,row);}
 if(x.unquantified)row.unquantified=true;else row.units[x.unit]=round((row.units[x.unit]||0)+x.quantity);
 if(!row.sources.includes(x.source))row.sources.push(x.source);}
 return [...rows.values()];}
function pantry(state,key,unit){return Math.max(0,n(state?.v9Pantry?.[key+'::'+unit]));}
function quantities(state,need){return Object.entries(need.units||{}).map(([unit,needed])=>{const stock=pantry(state,need.key,unit);return {unit,needed:round(needed),stock:round(stock),missing:round(Math.max(0,needed-stock))};});}
function sumText(rows,field){return rows.filter(x=>x[field]>0).map(x=>showAmount(x[field],x.unit)).join(' + ');}
function parseAmount(raw){const m=String(raw||'').replace(',','.').trim().match(/^(\d+(?:\.\d+)?)\s*([A-Za-zÄÖÜäöüß]+)\b/u);if(!m)return null;const q=convert(Number(m[1]),m[2]);return q.value>0?{quantity:q.value,unit:q.unit}:null;}
function parseVesper(text){const parsed=[];for(const line of String(text||'').split(/\r?\n/)){const s=line.replace(/^[\s•*-]+/,'').trim();if(!s)continue;
 const m=s.replace(',','.').match(/^(\d+(?:\.\d+)?)\s+([\p{L}]+)\s+(.+)$/u);if(!m||!(Number(m[1])>0))return {error:'Bitte Menge und Einheit angeben, z. B. „2 Scheiben Brot“: '+s};parsed.push([m[3].trim().slice(0,100),Number(m[1]),m[2].slice(0,30)]);}
 return {items:parsed};}
return {DAYS,VESPER_ID,profilesDefault,norm,n,round,unit,convert,format,showAmount,profiles,meals,mealPortions,newMeal,isWholeRecipe,batchUnit,batchYieldUnit,batchCount,fingerprint,nutrition,nutritionScaled,ingredientName,recipeLine,entries,needs,pantry,quantities,sumText,parseAmount,parseVesper};
});
