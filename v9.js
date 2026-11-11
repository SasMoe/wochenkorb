/* Wochenkorb V9 – one shared meal-first workflow. Uses existing Supabase sync. */
(()=>{
'use strict';
const K=window.WochenkorbV9;if(!K)return;
const $9=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const people=()=>K.profiles(state), allMeals=()=>K.meals(state);
const getRecipe=id=>state.recipes.find(r=>r.id===id);
const mealName=id=>id===K.VESPER_ID?'Unser Abendvesper':getRecipe(id)?.name||'Rezept nicht gefunden';
const nutritionText=r=>{const a=K.nutrition(r);return a?K.format(a.kcal)+' kcal / Portion'+(a.quality==='estimated'?' · Schätzung':''):'Nährwerte noch offen';};
function migrateOnFirstEdit(){
 if(!Array.isArray(state.v9Meals)){
   const persons=people(),total=persons.reduce((acc,p)=>acc+Number(p.factor||0),0)||1;
   state.v9Meals=K.meals(state).map(m=>{const r=getRecipe(m.recipeId);return r&&K.isWholeRecipe(r)?{id:m.id,recipeId:m.recipeId,day:'',batches:1}:{id:m.id,recipeId:m.recipeId,day:'',guests:0,parts:Object.fromEntries(persons.map(p=>[p.id,K.round(Number(p.factor)*Number(m.servings)/total)]))};});
 }
 state.plan=[]; // V8 expects unique recipe ids, V9 owns repeated meal instances.
}
function change(fn,message){mutate(()=>{migrateOnFirstEdit();fn();},message);}
function addMeal(recipeId,day=''){
 const r=recipeId===K.VESPER_ID?null:findRecipe(recipeId);
 if(recipeId!==K.VESPER_ID&&!r){toast('Rezept nicht gefunden');return;}
 change(()=>{if(r)ensureSavedRecipe(r);state.v9Meals.push(K.newMeal(recipeId,people(),day,r));},'Gericht eingeplant');
}
// Keep old recipe-card click actions but now allow the same dish many times.
planRecipe=addMeal;
const previousSignature=planSignature;
planSignature=function(){return JSON.stringify({old:previousSignature(),meals:allMeals(),members:people(),vesper:state.v9Vesper||{},pantry:state.v9Pantry||{},planningVersion:'9.1',plannedRecipes:state.recipes.filter(r=>allMeals().some(m=>m.recipeId===r.id)).map(r=>[r.id,K.fingerprint(r),r.planningType||'auto'])});};
const previousBuilder=buildShopping;
buildShopping=function(){
 const old=state.plan;let basic;
 try{state.plan=[];basic=previousBuilder();}finally{state.plan=old;}
 const rows=new Map(basic.map(r=>[r.key,r]));
 const grouped=new Map();
 function addNeed(key,name,qty,unit,source){
  if(!(qty>0))return;
  let obj=grouped.get(key);if(!obj){obj={key,name,units:{},sources:[]};grouped.set(key,obj);}
  obj.units[unit]=K.round((obj.units[unit]||0)+qty);
  if(source&&!obj.sources.includes(source))obj.sources.push(source);
 }
 // All recipe meals + person-specific Vesper, scale before grouping.
 for(const x of K.needs(state,keyOf)){
  for(const [u,q] of Object.entries(x.units))addNeed(x.key,x.name,q,u,'Rezept');
  if(!rows.has(x.key)){
   const known=state.catalog.find(c=>keyOf(c.name)===x.key),guess=guessCategories(x.name);
   rows.set(x.key,{key:x.key,name:known?.name||x.name,area:known?.area||guess.area,aisle:known?.aisle||guess.aisle,status:'open',notes:[],sources:[],custom:false});
  }
  const row=rows.get(x.key);if(!row.sources.includes('rezept'))row.sources.push('rezept');
  for(const src of x.sources){if(!row.notes.includes(src))row.notes.push(src);}
  if(x.unquantified&&!Object.keys(x.units).length)row.notes.push('Menge nach Geschmack – bitte prüfen');
 }
 // Explicit staple / optional / manually added quantities are additional demand.
 for(const c of state.catalog){if(c.active===false||!(c.kind==='stamm'||(c.kind==='bedarf'&&state.selected.includes(c.id))))continue;
  const amount=K.parseAmount(c.amount);if(amount)addNeed(keyOf(c.name),c.name,amount.quantity,amount.unit,'Regelbedarf');
 }
 for(const c of state.oneOff||[]){const amount=K.parseAmount(c.amount);if(amount)addNeed(keyOf(c.name),c.name,amount.quantity,amount.unit,'Zusätzlich');}
 return [...rows.values()].map(row=>{
  const need=grouped.get(row.key)||{key:row.key,units:{}};
  const amounts=K.quantities(state,need);
  return {...row,amounts,quantityKnown:amounts.length>0,quantityText:K.sumText(amounts,'needed'),stockText:K.sumText(amounts,'stock'),buyText:K.sumText(amounts,'missing')};
 });
};
// Quantity is primary information on BOTH shopping and home screens. Existing
// shopping rows from older versions have no structured amount fields; project
// current quantities for display without modifying statuses or writing state.
let projectedSignature='', projectedRows=new Map();
function projectedItem(key){
 const sig=activeRenderSignature||planSignature();
 if(sig!==projectedSignature){
  projectedSignature=sig;
  projectedRows=new Map(buildShopping().map(i=>[i.key,i]));
 }
 return projectedRows.get(key);
}
function visibleQuantity(i){
 // Show current quantities if planning changed; otherwise trust the saved week.
 const current=projectedItem(i.key);
 if(state.shopping?.signature!==(activeRenderSignature||planSignature())&&current)return current;
 if(i.quantityKnown||Array.isArray(i.amounts)&&i.amounts.length)return i;
 return current||i;
}
// A render computes the expensive planning signature once even for 300+ rows.
let activeRenderSignature=null;
const originalRender91=render;
render=function(...args){activeRenderSignature=planSignature();try{return originalRender91(...args);}finally{activeRenderSignature=null;}};
const previousItemMarkup=itemMarkup;
itemMarkup=function(i,mode){
 const row=visibleQuantity(i),has=row.quantityKnown||Array.isArray(row.amounts)&&row.amounts.length>0;
 let html=previousItemMarkup(i,mode);
 let line;
 if(has){
  const needed=row.quantityText||K.sumText(row.amounts||[],'needed');
  const missing=row.buyText||K.sumText(row.amounts||[],'missing');
  const stock=row.stockText||K.sumText(row.amounts||[],'stock');
  line=`<div class="v91-quantity" aria-label="Einkaufsmenge ${esc(missing||'0')}"><strong class="v91-amount">${esc(missing||'0 '+(row.amounts?.[0]?.unit||''))}</strong><span>einkaufen</span><small>Benötigt: ${esc(needed||'unbekannt')}${stock?' · Zuhause: '+esc(stock):''}</small></div>`;
 }else{
  line='<small class="v91-unknown">Menge noch offen</small>';
 }
 html=html.replace('</strong>','</strong>'+line);
 // Stock management is an explicit action, not required to read quantities.
 return html.replace('<button class="open-details"',`<button type="button" class="v9-stock" data-v9-stock="${esc(i.key)}">Vorrat</button><button class="open-details"`);
};
function plannedItemHtml(m){
 const r=getRecipe(m.recipeId),persons=people(),whole=Boolean(r&&K.isWholeRecipe(r)),
 batches=whole?K.batchCount(m):0,
 amount=whole?batches*Math.max(1,Number(r.servings)||1):K.mealPortions(persons,m),
 nutr=r?K.nutritionScaled(r,amount):null;
 if(whole){
  const unit=K.batchUnit(r),yieldUnit=K.batchYieldUnit(r),yieldCount=Math.max(1,Number(r.servings)||1)*batches;
  const macro=nutr?`<div class="v9-macro">${esc(K.format(nutr.kcal))} kcal für alle ${esc(K.format(yieldCount))} ${esc(yieldUnit)}${nutr.quality==='estimated'?' · geschätzt':''}</div>`:'<small class="v9-missing-nutrition">Nährwerte noch offen</small>';
  return `<article class="v9-planned-meal v91-whole-meal"><div class="v9-meal-head"><div><strong>${esc(r.name)}</strong><small>${esc(batches)} ${esc(unit)} · ergibt ${esc(K.format(yieldCount))} ${esc(yieldUnit)} laut Rezept</small>${macro}</div><div class="v9-commands"><label>Tag <select data-v9-day="${esc(m.id)}"><option value="">Offen</option>${K.DAYS.map(d=>`<option value="${d}" ${m.day===d?'selected':''}>${d}</option>`).join('')}</select></label><button type="button" class="btn ghost tiny" data-v9-remove="${esc(m.id)}">Entfernen</button></div></div>
  <div class="v91-batch-control"><span>Ganze ${esc(unit)} planen</span><div class="stepper"><button type="button" data-v91-batch="${esc(m.id)}" data-delta="-1" aria-label="Ein Rezept weniger" ${batches<=1?'disabled':''}>−</button><b>${esc(batches)}</b><button type="button" data-v91-batch="${esc(m.id)}" data-delta="1" aria-label="Ein Rezept mehr" ${batches>=20?'disabled':''}>+</button></div></div></article>`;
 }
 const participant=m.parts&&Object.keys(m.parts).length?persons.filter(p=>Number(m.parts[p.id])>0).map(p=>p.name).join(', '):'Portionen aus bisherigem Plan';
 const macro=nutr?`<div class="v9-macro"><strong>${esc(K.format(nutr.kcal))} kcal gesamt</strong> · ${esc(K.format(nutr.protein))} g Eiweiß · ${esc(K.format(nutr.carbs))} g KH · ${esc(K.format(nutr.fat))} g Fett${nutr.quality==='estimated'?' · geschätzt':''}</div>
   <div class="v9-person-nutrition">${persons.filter(p=>Number(m.parts?.[p.id])>0).map(p=>{const sub=K.nutritionScaled(r,Number(m.parts[p.id]));return `<small>${esc(p.name)}: ${esc(K.format(sub.kcal))} kcal · ${esc(K.format(sub.protein))} g Eiweiß</small>`;}).join('')}</div>`:
   (r?'<small class="v9-missing-nutrition">Nährwerte noch offen</small>':'<small>Persönliche Vesper-Zutaten</small>');
 return `<article class="v9-planned-meal"><div class="v9-meal-head"><div><strong>${esc(mealName(m.recipeId))}</strong><small>${esc(K.format(amount))} Portionen · ${esc(participant||'Keiner isst mit')}</small>${macro}</div>
  <div class="v9-commands"><label>Tag <select data-v9-day="${esc(m.id)}"><option value="">Offen</option>${K.DAYS.map(d=>`<option value="${d}" ${m.day===d?'selected':''}>${d}</option>`).join('')}</select></label><button type="button" class="btn ghost tiny" data-v9-remove="${esc(m.id)}">Entfernen</button></div></div>
  <details class="v9-portion-controls"><summary>Wer isst mit? · Portionen ändern</summary><div class="v9-portion-grid">${persons.map(p=>{
   const val=m.parts&&Object.keys(m.parts).length?m.parts[p.id]??0:'';
   return `<label>${esc(p.name)} <input type="number" min="0" max="6" step="0.25" inputmode="decimal" data-v9-meal="${esc(m.id)}" data-v9-person="${esc(p.id)}" value="${esc(val)}" placeholder="${esc(p.factor)}"></label>`;
  }).join('')}</div><small>0 = isst nicht mit; 0,5 = halbe Portion. Späteres Essen zählt mit.</small>${m.recipeId===K.VESPER_ID?'<div class="v9-buttons"><button class="btn ghost tiny" type="button" data-v9-vesper="1">Vesper-Vorlieben bearbeiten</button></div>':''}</details></article>`;
}
function plannerHtml(){const m=allMeals();return `<div class="v9-heading"><div><p class="eyebrow">Unser Wochenplan</p><h2>Was essen wir diese Woche?</h2><p class="sub">Gerichte zuerst. Wochenkorb berechnet daraus den Bedarf für euch alle.</p></div><span class="countpill">${m.length} Mahlzeit${m.length===1?'':'en'}</span></div>
 <div class="v9-buttons"><button type="button" class="btn" data-v9-add-dish="1">+ Gericht auswählen</button><button type="button" class="btn ghost" data-v9-add-vesper="1">+ Abendvesper</button></div>
 ${m.length?`<div class="v9-meal-grid">${m.map(plannedItemHtml).join('')}</div>`:'<div class="v9-empty">Noch nichts geplant. Wählt eure Lieblingsgerichte oder beginnt mit einem Abendvesper.</div>'}
 <div class="v9-footer"><button type="button" class="btn ghost tiny" data-action="start-week">Neue Einkaufsliste</button><button type="button" class="btn ghost tiny" data-action="refresh-list">Liste aktualisieren</button></div>`;}
function renderHomePlanner(){
 const section=$9('#view-zuhause');if(!section)return;
 let panel=$9('#v9-planner-home');if(!panel){panel=document.createElement('section');panel.id='v9-planner-home';panel.className='surface box v9-planner';section.querySelector('.hero')?.before(panel);}
 panel.innerHTML=plannerHtml();
 const hero=section.querySelector('.hero');if(hero)hero.hidden=true;
 const h=section.querySelector('.pagehead h1');if(h)h.textContent='Unsere Woche planen';
 const sub=section.querySelector('.pagehead .sub');if(sub)sub.textContent='Was essen wir? Wer isst mit? Was müssen wir noch einkaufen?';
 const mini=$9('#homePlan');if(mini)mini.innerHTML=`<p class="sub">${allMeals().length} Mahlzeiten geplant · oben verwalten</p>`;
 const count=$9('#homeStats .stat:last-child strong');if(count)count.textContent=String(allMeals().length);
}
const previousHome=renderHome;
renderHome=function(...args){previousHome(...args);renderHomePlanner();};
function renderPlanTab(){const box=$9('#planList');if(box)box.innerHTML=plannerHtml();const badge=$9('#planBadge');if(badge)badge.textContent=allMeals().length?'('+allMeals().length+')':'';}
const previousRecipes=renderRecipes;
renderRecipes=function(...args){previousRecipes(...args);renderPlanTab();
 const saved=$9('#savedRecipes');if(!saved)return;
 const filtered=state.recipes.filter(r=>norm([r.name,r.tag,r.description,...(r.ingredients||[]).map(i=>i[0])].join(' ')).includes(norm(queryLocal)));
 const cards=[...saved.querySelectorAll('.recipe-card')],pairs=cards.map((el,i)=>({el,r:filtered[i]})).filter(x=>x.r);
 for(const {el,r} of pairs){
  const row=el.querySelector('.buttonrow');if(row){row.insertAdjacentHTML('beforeend',`<button class="btn ghost tiny" type="button" data-v9-favorite="${esc(r.id)}">${r.favorite?'★ Stamm':'☆ Stamm'}</button><button class="btn ghost tiny" type="button" data-v9-nutrition="${esc(r.id)}">Nährwerte</button><button class="btn ghost tiny v91-recipe-mode" type="button" data-v91-mode="${esc(r.id)}" title="Planungsart ändern">${K.isWholeRecipe(r)?'1 ganzes Rezept':'Familienportionen'}</button>`);}
  const summary=el.querySelector('.recipe-content p');if(summary)summary.insertAdjacentHTML('beforeend',`<br><b class="v9-nutrition-label">${esc(nutritionText(r))}</b>`);
 }
 pairs.sort((a,b)=>Number(Boolean(b.r.favorite))-Number(Boolean(a.r.favorite))).forEach(({el})=>saved.appendChild(el));
};
const previousDetail=openDetail;
openDetail=function(id){previousDetail(id);const r=findRecipe(id),root=$9('#recipeDetailContent');if(!r||!root)return;
 const n=K.nutrition(r);
 root.insertAdjacentHTML('beforeend',`<section class="v9-detail-nutrition"><h3>Nährwerte pro ${K.isWholeRecipe(r)?(K.batchYieldUnit(r)==='Stücke'?'Stück':K.batchYieldUnit(r)==='Scheiben'?'Scheibe':'Einheit'):'Portion'}</h3><p>${esc(nutritionText(r))}</p>${n?`<small>Eiweiß ${K.format(n.protein)} g · Kohlenhydrate ${K.format(n.carbs)} g · Fett ${K.format(n.fat)} g · Quelle: ${esc(n.source)}</small>`:'<small>Keine berechneten oder geprüften Werte hinterlegt. Wir erfinden keine Nährwerte.</small>'}
 ${state.recipes.some(x=>x.id===r.id)?`<button type="button" class="btn ghost tiny" data-v9-nutrition="${esc(r.id)}">Nährwerte hinterlegen</button>`:''}</section>`);
};
const previousManage=renderManage;
renderManage=function(...args){previousManage(...args);
 const root=$9('#view-verwalten');let box=$9('#v9-family-settings');if(!root)return;
 if(!box){box=document.createElement('section');box.className='surface box v9-family';box.id='v9-family-settings';root.querySelector('.manager-grid')?.before(box);}
 box.innerHTML=`<details><summary><b>Familienportionen & Abendvesper</b><small>Einmal einstellen – für die ganze Familie verwenden</small></summary>
 <form id="v9-family-form" class="v9-settings-body"><p class="sub">Persönliche Standardportionen. Bei jedem Gericht veränderbar.</p><div class="v9-family-grid">${people().map(p=>`<label>Familienmitglied<input type="text" class="field" maxlength="30" required name="name-${esc(p.id)}" value="${esc(p.name)}">Portionsfaktor<input class="field" type="number" min="0.25" max="4" step="0.25" inputmode="decimal" required name="factor-${esc(p.id)}" value="${esc(p.factor)}"></label>`).join('')}</div><div class="v9-buttons"><button class="btn" type="submit">Speichern</button><button class="btn ghost" type="button" data-v9-vesper="1">Vesper-Vorlieben</button></div></form></details>`;
};
function popup(id,title,content){let d=$9('#'+id);if(!d){d=document.createElement('dialog');d.id=id;d.className='overlay v9-dialog';document.body.appendChild(d);}
 d.innerHTML=`<button type="button" class="modal-close" data-v9-close="${id}" aria-label="Schließen">✕</button><h2>${esc(title)}</h2>${content}`;d.showModal();return d;}
function vesperEditor(){popup('v9-vesper-dialog','Unser Familienvesper',`<p class="sub">Was isst jeder gern? Für jede Person pro Vesperabend die Zutaten angeben. Eine pro Zeile, z. B. <b>2 Scheiben Brot</b> oder <b>30 g Käse</b>.</p><form id="v9-vesper-form"><div class="v9-vesper-grid">${people().map(p=>`<label><strong>${esc(p.name)}</strong><textarea class="field" rows="5" data-v9-vesper-person="${esc(p.id)}" placeholder="2 Scheiben Brot\n30 g Käse">${esc((state.v9Vesper?.[p.id]||[]).map(x=>`${x[1]} ${x[2]} ${x[0]}`).join('\n'))}</textarea></label>`).join('')}</div><div class="form-actions"><button class="btn" type="submit">Vesper-Vorlieben speichern</button></div></form>`);}
function nutritionEditor(id){const recipe=getRecipe(id);if(!recipe)return;const n=K.nutrition(recipe)||{};
 popup('v9-nutrition-dialog','Nährwerte: '+recipe.name,`<p class="sub">Feste Nährwerte je <strong>1 ${K.isWholeRecipe(recipe)?(K.batchYieldUnit(recipe)==='Stücke'?'Stück':K.batchYieldUnit(recipe)==='Scheiben'?'Scheibe':K.batchYieldUnit(recipe)==='Portionen'?'Portion':K.batchYieldUnit(recipe)):'Portion'}</strong> des Originalrezepts (${esc(recipe.servings)} ${K.isWholeRecipe(recipe)?K.batchYieldUnit(recipe):'Portionen'}). Beim Planen eines ganzen Rezepts rechnen wir mit der gesamten Rezeptmenge. Quellenangaben bleiben in eurer Datenbank. Bei Rezeptänderungen werden diese Angaben automatisch ungültig.</p>
 <form id="v9-nutrition-form"><input type="hidden" name="recipeId" value="${esc(id)}"><div class="v9-nutrition-grid">${[['kcal','Kalorien (kcal)'],['protein','Eiweiß (g)'],['carbs','Kohlenhydrate (g)'],['fat','Fett (g)'],['fiber','Ballaststoffe (g, optional)']].map(([k,label])=>`<label>${label}<input type="number" class="field" name="${k}" min="0" max="30000" step="0.1" inputmode="decimal" ${k==='fiber'?'':'required'} value="${n[k]==null?'':esc(n[k])}"></label>`).join('')}</div>
 <label>Quelle / Beleg<input class="field" name="source" maxlength="200" required placeholder="z. B. BLS 4.0 / Packung" value="${esc(n.source||'')}"></label>
 <label>Einordnung<select class="field" name="quality"><option value="estimated" ${n.quality==='estimated'?'selected':''}>Geschätzt / berechnet</option><option value="verified" ${n.quality==='verified'?'selected':''}>Geprüft (Beleg vorhanden)</option></select></label><div class="form-actions"><button class="btn" type="submit">Nährwerte speichern</button></div></form>`);
}
function stockEditor(key){const row=state.shopping?.items?.find(x=>x.key===key);if(!row)return;
 const live=visibleQuantity(row);const available=[...new Set([...(live.amounts||[]).map(x=>x.unit),'g','ml','Stk','Scheibe','Packung','EL'])];
 popup('v9-stock-dialog','Vorrat: '+row.name,`<p class="sub">Nur tatsächlich vorhandene Menge eingeben. Die Einkaufsliste wird danach neu berechnet, ohne bereits abgehakte Artikel zu verlieren.</p>
 <form id="v9-stock-form"><input type="hidden" name="itemKey" value="${esc(key)}"><label>Einheit<select class="field" name="unit" id="v9-stock-unit">${available.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join('')}</select></label><label>Zu Hause vorhanden<input class="field" name="quantity" type="number" min="0" max="100000" step="0.01" inputmode="decimal" required id="v9-stock-qty"></label><div class="form-actions"><button class="btn" type="submit">Vorrat speichern</button></div></form>`);
 const select=$9('#v9-stock-unit'),input=$9('#v9-stock-qty');const apply=()=>{input.value=String(K.pantry(state,key,select.value));};select.addEventListener('change',apply);apply();
}
const close=id=>{const dialog=$9('#'+id);if(dialog?.open)dialog.close();};
function setPortions(event){const field=event.target,id=field.dataset.v9Meal,personId=field.dataset.v9Person,value=Number(String(field.value).replace(',','.'));
 if(!Number.isFinite(value)||value<0||value>6){toast('Bitte Portionswert zwischen 0 und 6 verwenden.');render();return;}
 change(()=>{const meal=state.v9Meals.find(x=>x.id===id);if(!meal)return;
  if(!meal.parts||!Object.keys(meal.parts).length){const members=people(),total=members.reduce((a,p)=>a+Number(p.factor),0)||1;
   meal.parts=Object.fromEntries(members.map(p=>[p.id,K.round(Number(p.factor)*Number(meal.servings||total)/total)]));delete meal.servings;
  }
  meal.parts[personId]=K.round(value);
 },'Portionen geändert');
}
// Intercept actions before older V8 handlers, without changing their behavior elsewhere.
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-v9-add-dish],[data-v9-add-vesper],[data-v9-remove],[data-v9-vesper],[data-v9-close],[data-v9-favorite],[data-v9-nutrition],[data-v9-stock],[data-v91-batch],[data-v91-mode],[data-action="clear-plan"]');if(!button)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(button.hasAttribute('data-v9-add-dish')){navigate('rezepte','saved');return;}
 if(button.hasAttribute('data-v9-add-vesper')){addMeal(K.VESPER_ID);return;}
 if(button.hasAttribute('data-v9-remove')){change(()=>{state.v9Meals=state.v9Meals.filter(x=>x.id!==button.dataset.v9Remove);},'Gericht entfernt');return;}
 if(button.hasAttribute('data-v9-vesper')){vesperEditor();return;}
 if(button.hasAttribute('data-v9-close')){close(button.dataset.v9Close);return;}
 if(button.hasAttribute('data-v9-favorite')){const recipe=getRecipe(button.dataset.v9Favorite);if(recipe)mutate(()=>{recipe.favorite=!recipe.favorite;},'Stammrezept aktualisiert');return;}
 if(button.hasAttribute('data-v9-nutrition')){nutritionEditor(button.dataset.v9Nutrition);return;}
 if(button.hasAttribute('data-v9-stock')){stockEditor(button.dataset.v9Stock);return;}
 if(button.hasAttribute('data-v91-batch')){
  const id=button.dataset.v91Batch,delta=Number(button.dataset.delta);
  change(()=>{const m=state.v9Meals.find(x=>x.id===id);if(m)m.batches=Math.max(1,Math.min(20,K.batchCount(m)+delta));},'Ganze Rezepte geändert');return;
 }
 if(button.hasAttribute('data-v91-mode')){
  const r=getRecipe(button.dataset.v91Mode);if(!r)return;
  mutate(()=>{r.planningType=K.isWholeRecipe(r)?'portions':'batch';},'Planungsart geändert');return;
 }
 if(button.dataset.action==='clear-plan'){if(confirm('Alle geplanten Mahlzeiten entfernen?'))change(()=>{state.v9Meals=[];},'Wochenplan geleert');return;}
},true);
document.addEventListener('change',e=>{
 const field=e.target;if(field.matches('[data-v9-meal]')){setPortions(e);return;}
 if(field.matches('[data-v9-day]'))change(()=>{const m=state.v9Meals.find(m=>m.id===field.dataset.v9Day);if(m)m.day=K.DAYS.includes(field.value)?field.value:'';},'Wochentag geändert');
},true);
document.addEventListener('submit',e=>{
 const form=e.target,id=form.getAttribute('id');if(!['v9-family-form','v9-vesper-form','v9-nutrition-form','v9-stock-form'].includes(id))return;
 e.preventDefault();e.stopImmediatePropagation();
 if(id==='v9-family-form'){
  const values=people().map(p=>({...p,name:String(form.elements['name-'+p.id].value||'').trim().slice(0,30),factor:Number(form.elements['factor-'+p.id].value)}));
  if(values.some(x=>!x.name||!(x.factor>=.25&&x.factor<=4))){toast('Familienportionen überprüfen.');return;}
  mutate(()=>{state.v9Profiles=values;},'Familienportionen gespeichert');return;
 }
 if(id==='v9-vesper-form'){
  const next={...(state.v9Vesper||{})};
  for(const p of people()){const input=form.querySelector(`[data-v9-vesper-person="${p.id}"]`),parsed=K.parseVesper(input?.value||'');if(parsed.error){toast(parsed.error);return;}next[p.id]=parsed.items;}
  mutate(()=>{state.v9Vesper=next;},'Familienvesper gespeichert');close('v9-vesper-dialog');return;
 }
 if(id==='v9-nutrition-form'){
  const recipe=getRecipe(form.elements.recipeId.value);if(!recipe)return;
  const fields=['kcal','protein','carbs','fat'],v={};
  for(const k of fields){if(form.elements[k].value===''||!Number.isFinite(Number(form.elements[k].value))||Number(form.elements[k].value)<0){toast('Nährwerte überprüfen.');return;}v[k]=Number(form.elements[k].value);}
  v.fiber=form.elements.fiber.value.trim()===''?null:Number(form.elements.fiber.value);
  if(v.fiber!==null&&(!Number.isFinite(v.fiber)||v.fiber<0)){toast('Ballaststoffe überprüfen.');return;}
  const source=String(form.elements.source.value||'').trim();if(!source){toast('Bitte Nährwertquelle angeben.');return;}
  mutate(()=>{recipe.nutrition={perServing:v,fingerprint:K.fingerprint(recipe),quality:form.elements.quality.value==='verified'?'verified':'estimated',source:source.slice(0,200),updatedAt:new Date().toISOString()};},'Nährwerte dauerhaft gespeichert');close('v9-nutrition-dialog');return;
 }
 if(id==='v9-stock-form'){
  const key=form.elements.itemKey.value,quantity=Number(form.elements.quantity.value),unit=form.elements.unit.value;
  if(!Number.isFinite(quantity)||quantity<0||quantity>100000){toast('Vorratsmenge überprüfen.');return;}
  mutate(()=>{state.v9Pantry={...(state.v9Pantry||{})};const k=key+'::'+unit;if(quantity===0)delete state.v9Pantry[k];else state.v9Pantry[k]=quantity;},'Bestand gespeichert');
  close('v9-stock-dialog');if(state.shopping?.id)refreshShopping();return;
 }
},true);
// The native share sheet should also show quantities without requiring the info button.
shareList=function(){
 if(!state.shopping.id){toast('Noch keine Einkaufsliste');return;}
 const items=state.shopping.items.filter(i=>i.status==='open');
 const message=groupItems(items,'aisle').map(g=>g.cat+'\n'+g.items.map(item=>{
  const q=visibleQuantity(item),amount=q.buyText||K.sumText(q.amounts||[],'missing');
  return '☐ '+item.name+(amount?' – '+amount:' – Menge offen');
 }).join('\n')).join('\n\n')||'Alles erledigt!';
 if(navigator.share)navigator.share({title:'Unser Wochenkorb',text:message}).catch(()=>{});
 else if(navigator.clipboard?.writeText)navigator.clipboard.writeText(message).then(()=>toast('Liste mit Mengen kopiert')).catch(()=>download('einkauf.txt',message,'text/plain'));
 else download('einkauf.txt',message,'text/plain');
};
const footer=$9('.foot');if(footer)footer.textContent='Wochenkorb V9.1 · Familienplanung · Ohne Werbung';
render();
window.WochenkorbPlanV9={addMeal,meals:allMeals,needs:()=>K.needs(state,keyOf)};
})();
