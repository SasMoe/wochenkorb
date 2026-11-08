/* Wochenkorb V7: German recipe discovery and store-specific relevance without ad feed. */
(() => {
  'use strict';
  const $v7 = selector => document.querySelector(selector);
  const esc7 = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const cleanUrl = value => {try {const url=new URL(String(value));return url.protocol==='https:'?url.href:'';}catch{return '';}};
  const dateNow = () => new Date().toISOString().slice(0,10);
  const norm7 = s => String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
  const cfg = () => window.WOCHENKORB_CONFIG || {};
  const client = () => window.WochenkorbCloudClient;
  let germanRecipes=[], feedLoaded=false, feedError='', loading=false;
  const cacheKey='wochenkorb-german-feed-v7';

  async function invoke(name, body) {
    if(!client())throw Error('Bitte zuerst bei Wochenkorb anmelden.');
    const {data,error}=await client().functions.invoke(name,{body});
    if(error)throw Error(error.message || 'Online-Abfrage nicht verfügbar');
    if(data?.error)throw Error(data.error);
    return data;
  }
  function renderGerman(){
    const target=$v7('#remoteRecipes'), info=$v7('#remoteMessage');
    if(!target||!info||recipeTab!=='feed')return;
    const search=norm7($v7('#onlineSearch')?.value||'');
    const visible=germanRecipes.filter(r=>!search||norm7(r.title+' '+r.description).includes(search));
    info.textContent=feedError || (germanRecipes.length? `${visible.length} von ${germanRecipes.length} deutschsprachigen Rezeptideen · Quelle: Chefkoch, Rezepte des Tages`: 'Noch keine deutschen Rezeptideen geladen.');
    target.innerHTML=visible.map(r=>`<article class="surface recipe-card v7-recipe">
      ${cleanUrl(r.image)?`<img class="recipe-photo" loading="lazy" alt="" src="${esc7(r.image)}">`:'<div class="recipe-photo recipe-image-fallback">🍲</div>'}
      <div class="recipe-content"><span class="tag">${esc7(r.source||'Chefkoch')}</span><h3>${esc7(r.title)}</h3><p>${esc7((r.description||'').slice(0,115))}</p>
      <div class="buttonrow"><a class="btn ghost tiny" href="${esc7(r.url)}" target="_blank" rel="noopener noreferrer">Original</a><button class="btn tiny" type="button" data-v7-import="${esc7(r.url)}">Zutaten importieren</button></div></div>
    </article>`).join('') || `<div class="empty"><strong>Keine passenden Rezepte im aktuellen Feed.</strong><p>Du kannst einen Rezeptlink importieren oder auf Chefkoch weiter suchen.</p><a target="_blank" rel="noopener noreferrer" href="https://www.chefkoch.de/rs/s0/${encodeURIComponent(search||'Rezepte')}/Rezepte.html">Bei Chefkoch suchen</a></div>`;
  }
  const originalRenderRecipes=renderRecipes;
  renderRecipes=function(...args){ originalRenderRecipes(...args);renderGerman(); };
  loadRemote=async function(query=''){
    if(loading)return;
    if(query&&feedLoaded){feedError='';renderGerman();return;}
    loading=true;feedError='Rezepte des Tages werden geladen …';renderGerman();
    try {
      let data=await invoke('recipe-feed',{action:'latest'});
      germanRecipes=Array.isArray(data.recipes)?data.recipes.filter(r=>cleanUrl(r.url)&&r.title):[];
      if(!germanRecipes.length)throw Error('Die Quelle hat gerade keine Rezepte geliefert.');
      feedLoaded=true;feedError='';
      try{localStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),recipes:germanRecipes}));}catch{}
    }catch(e){
      try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?.recipes?.length){germanRecipes=cached.recipes;feedLoaded=true;feedError='Offline-/Cache-Ansicht · Die neuesten Rezepte sind derzeit nicht erreichbar.';}
      else feedError='Der deutsche Rezept-Feed ist gerade nicht erreichbar: '+e.message;}catch{feedError='Der deutsche Rezept-Feed ist gerade nicht erreichbar.';}
    }finally{loading=false;remoteRecipes=[];renderRecipes();}
  };
  // A click on a feed item opens the established V5/V6 import form. The existing
  // Supabase recipe-import function loads structured ingredients and instructions.
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-v7-import]');if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    const url=cleanUrl(btn.dataset.v7Import);if(!url)return;
    const form=$v7('#importForm');form.reset();form.elements.url.value=url;
    $v7('#importDialog').showModal();
  },true);
  // Keep one click on refresh fetching a new RSS snapshot rather than cached only.
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-action="random-remote"]');if(!btn)return;
    feedLoaded=false;loadRemote();
  },true);
  document.addEventListener('input',e=>{if(e.target?.id==='onlineSearch'&&feedLoaded)renderGerman();});
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-action="search-remote"]');if(btn&&feedLoaded)renderGerman();
  });

  function addStorePanel(){
    const el=$v7('#intelligence-root');if(!el||el.querySelector('#v7-stores'))return;
    const section=document.createElement('section');section.id='v7-stores';section.className='surface box v7-store-panel';
    section.innerHTML=`<div class="section-title"><h2>Unsere Geschäfte</h2></div>
      <p class="sub">ALDI Süd ist euer Hauptgeschäft, dm für Drogerie und Kinderbedarf, Lidl vor allem für Wasser. Die Links führen zu den Originalquellen; Preise werden vor dem Einkauf im Geschäft geprüft.</p>
      <div class="v7-store-grid">
        <a target="_blank" rel="noopener noreferrer" href="https://www.aldi-sued.de/angebote"><strong>ALDI Süd</strong><small>Aktuelle Wochenangebote öffnen</small></a>
        <a target="_blank" rel="noopener noreferrer" href="https://www.dm.de/neu/aktionen"><strong>dm</strong><small>Aktionen & Drogerieartikel öffnen</small></a>
        <a target="_blank" rel="noopener noreferrer" href="https://www.lidl.de/c/online-prospekte/s10005610"><strong>Lidl</strong><small>Prospekt & Wasserangebote öffnen</small></a>
      </div>
      <div class="v7-lookup"><label>Ein ALDI-Produkt prüfen<input class="field" id="v7-aldi-query" placeholder="z. B. Butter, Kaffee, Milch" maxlength="60"></label>
      <button type="button" class="btn" id="v7-aldi-load">Aktuellen ALDI-Preis suchen</button><p id="v7-aldi-result" class="sub" aria-live="polite">Experimentelle Abfrage der öffentlich angezeigten ALDI-Süd-Preise; kein garantierter Zugriff und keine Filial-Verfügbarkeitsprüfung.</p></div>`;
    el.prepend(section);
  }
  const originalIntelligenceRender=window.WochenkorbIntelligence?.render;
  if(originalIntelligenceRender){
    // V6 renders the learning pane each time state changes. A MutationObserver
    // reattaches the store panel without altering the core learning state.
    const container=$v7('#intelligence-root');
    if(container){let active=false;new MutationObserver(()=>{if(active||container.querySelector('#v7-stores'))return;active=true;addStorePanel();active=false;}).observe(container,{childList:true});addStorePanel();}
  }
  document.addEventListener('click',async e=>{
    if(e.target?.id!=='v7-aldi-load')return;
    e.stopImmediatePropagation();
    const query=$v7('#v7-aldi-query').value.trim(),out=$v7('#v7-aldi-result');
    if(query.length<2){out.textContent='Bitte mindestens zwei Zeichen eingeben.';return;}
    const button=e.target;button.disabled=true;out.textContent='ALDI-Preise werden abgefragt …';
    try {
      const data=await invoke('store-feed',{store:'aldi-sued',query});
      const items=Array.isArray(data.products)?data.products:[];
      if(!items.length){out.textContent='Keine Treffer bei ALDI Süd. Eventuell ist die Quelle vorübergehend nicht erreichbar.';return;}
      const resultHTML=`${items.length} Treffer (Live-Abfrage, ${esc7(dateNow())}). Preise können regional abweichen.<div class="v7-product-list">${items.slice(0,10).map(p=>`<div><span>${esc7(p.name)}${p.brand?' · '+esc7(p.brand):''}</span><strong>${esc7(p.priceLabel||'–')}${p.wasPriceLabel?` <s>${esc7(p.wasPriceLabel)}</s>`:''}</strong></div>`).join('')}</div>`;
      const candidates=items.filter(p=>p.wasPrice>p.price&&p.price>0).map(p=>({
        id:uid(),name:p.name,store:'ALDI Süd',price:p.price,reference:p.wasPrice,source:'aldi-live',fetchedAt:new Date().toISOString()
      }));
      if(candidates.length){mutate(()=>{state.offers=[...(state.offers||[]).filter(o=>o.source!=='aldi-live'),...candidates]},'ALDI-Preise geprüft');}
      addStorePanel();const newOut=$v7('#v7-aldi-result');if(newOut)newOut.innerHTML=resultHTML;
    }catch(error){out.textContent='Live-Abfrage nicht verfügbar: '+error.message+'. Nutze den Angebotslink oben oder die manuelle Eingabe.';}
    finally{button.disabled=false;}
  },true);
  try{let cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?.recipes?.length&&Date.now()-cached.at<6*3600000){germanRecipes=cached.recipes;feedLoaded=true;}}catch{}
  if(view==='rezepte'&&recipeTab==='feed')loadRemote();
})();
