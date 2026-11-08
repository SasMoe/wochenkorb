/* Wochenkorb V8.2 – "Bin sowieso dort". Deliberately opt-in, local market choice,
   live prices when available; never adds to the basket without a tap. */
(() => {
  'use strict';
  const Core=window.WochenkorbMarketsCore;
  if(!Core)return;
  const $82=q=>document.querySelector(q);
  const escape82=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDay=()=>new Date().toLocaleDateString('sv-SE');
  const euro=n=>Number(n).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
  const safeLink=x=>{try{const u=new URL(x);return u.protocol==='https:'&&(['lidl.de','www.lidl.de','dm.de','www.dm.de','aldi-sued.de','www.aldi-sued.de'].includes(u.hostname))?u.href:'';}catch{return ''}};
  const saved=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const persist=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const visitKey='wk-market-visit-v82',storeKey='wk-lidl-store-v82';
  let chosen=saved(visitKey,{day:'',store:''});
  if(chosen.day!==localDay())chosen={day:localDay(),store:''};
  let lidlStore=saved(storeKey,null),storeOptions=[],dataCache=new Map(),products=[],message='',isLoading=false,failures=0,manualQuery='',lastCheck='',hasChecked=false,checkId=0;
  function ui(){
    const root=$82('#view-einkaufen');if(!root)return;
    let box=$82('#wk-market-assistant');if(!box){
      box=document.createElement('section');box.id='wk-market-assistant';box.className='surface box wk-market';
      box.innerHTML=`<div class="wk-market-header"><div><h2>Bin sowieso dort</h2><p class="sub">Schnell prüfen, was sich bei deinem Einkauf zusätzlich lohnt.</p></div><span class="wk-badge">Optional</span></div>
        <div class="wk-market-picks" aria-label="Markt für heute wählen" role="group">${Core.stores.map(s=>`<button type="button" class="wk-pick" data-wk-market="${escape82(s)}">${escape82(s)}</button>`).join('')}</div>
        <div id="wk-market-body" aria-live="polite"></div>`;
      const shopbar=$82('#v8-shop-bar');if(shopbar)shopbar.after(box);else root.querySelector('#shopStats')?.after(box);
    }
    box.querySelectorAll('[data-wk-market]').forEach(b=>{const active=b.dataset.wkMarket===chosen.store;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    renderBody();
  }
  function knownStore(item){
    const direct=item?.store;if(Core.stores.includes(direct))return direct;
    const existing=(state.catalog||[]).find(x=>Core.identity(x.name)===Core.identity(item.name));
    if(existing?.store&&Core.stores.includes(existing.store))return existing.store;
    const name=Core.normalize([item?.name,item?.area,item?.aisle].filter(Boolean).join(' '));
    if(/wasser/.test(name))return 'Lidl';
    if(/drogerie|windel|baby|pflege|haushalt|waschmittel|zahnpasta|seife|shampoo|reinig|spulmittel|klopapier|toilettenpapier/.test(name))return 'dm';
    return 'ALDI Süd';
  }
  function storeBasket(store){return (state.shopping?.items||[]).filter(x=>x.status==='open'&&knownStore(x)===store);}
  function matching(name,products){let best=null,score=0;for(const p of products){const s=Core.matchScore(name,p);if(s>score){best=p;score=s}}return score>=65?best:null;}
  function renderBody(){
    const target=$82('#wk-market-body');if(!target)return;
    if(!chosen.store){target.innerHTML='<p class="wk-hint">Wähle einen Markt. Deine Einkaufsliste bleibt unverändert.</p>';return;}
    const store=chosen.store,items=storeBasket(store),link=Core.links[store];
    const chosenLidl=store==='Lidl';
    target.innerHTML=`<div class="wk-market-summary"><div><strong>Heute: ${escape82(store)}</strong><small>${items.length} offene Artikel dafür auf der Liste</small></div><button type="button" class="btn ghost tiny" id="wk-market-clear">Zurücksetzen</button></div>
      ${chosenLidl?`<div class="wk-lidl-choice"><div><b>Deine Lidl-Filiale</b><small>${lidlStore?escape82(lidlStore.label):'Einmal auswählen, damit die Angebote zur Filiale passen.'}</small></div><button type="button" class="btn ghost tiny" id="wk-lidl-change">${lidlStore?'Ändern':'Auswählen'}</button></div>
      <div id="wk-lidl-chooser" hidden><label for="wk-lidl-location" class="wk-label">Ort oder Postleitzahl</label><div class="wk-inline"><input class="field" id="wk-lidl-location" placeholder="z. B. Fürth" maxlength="50" autocomplete="address-level2"><button type="button" class="btn ghost" id="wk-lidl-search">Filialen</button></div><div id="wk-lidl-results"></div></div>`:''}
      <div class="wk-inline wk-actionbar"><button type="button" id="wk-market-check" class="btn" ${isLoading?'disabled':''}>${isLoading?'Prüfe Angebote …':'Passende Angebote prüfen'}</button><a class="btn ghost" href="${escape82(link)}" target="_blank" rel="noopener noreferrer">Originalangebote ↗</a></div>
      <p id="wk-market-message" class="sub wk-status" aria-live="polite">${escape82(message||'Keine automatische Änderung eurer Liste. Preise und Verfügbarkeit bitte beim Händler prüfen.')}</p>
      <div class="wk-market-results" id="wk-market-results"></div>
      <details class="wk-manual"><summary>Ein bestimmtes Produkt suchen</summary>
      <div class="wk-inline"><input type="search" class="field" id="wk-product-query" maxlength="60" placeholder="z. B. Kaffee, Windeln" value="${escape82(manualQuery)}"><button type="button" class="btn ghost" id="wk-product-search">Suchen</button></div><div class="sub" id="wk-manual-result">${chosenLidl?'Durchsucht die bereits geladenen Filialangebote. Für das gesamte Sortiment den Originalshop öffnen.':'Prüft aktuelle Produktdaten. Ein Preis ist nicht automatisch ein Angebot.'}</div></details>`;
    const area=$82('#wk-market-results');
    if(!hasChecked){
      area.innerHTML=items.length?`<div class="wk-mini-title">Für diesen Markt auf der Liste</div><div class="wk-compact">${items.slice(0,8).map(x=>`<span>${escape82(x.name)}</span>`).join('')}${items.length>8?`<small>+${items.length-8} weitere</small>`:''}</div>`:'';
    } else renderRecommendations();
  }
  function section(title,rows){return rows.length?`<div class="wk-rec-section"><h3>${escape82(title)} <span>${rows.length}</span></h3>${rows.map(entry=>{
    const p=entry.product,link=safeLink(p.url),saving=entry.discount?Math.round((p.wasPrice-p.price)/p.wasPrice*100):0;
    const otherStore=entry.category==='list'&&knownStore(entry.item)!==chosen.store;
    const note=entry.category==='list'?(otherStore?'Schon auf eurer Liste · bisher '+knownStore(entry.item):'Auf eurer Einkaufsliste'):entry.category==='stock'?'Regelmäßig gekauft – Vorrat prüfen':'Gehört zu euren Stammartikeln';
    return `<article class="wk-rec"><div class="wk-rec-description"><b>${escape82(entry.item.name)}</b><small>${escape82(p.name)}</small><small>${escape82(note)}${p.unitPrice?' · '+escape82(p.unitPrice):''}</small></div><div class="wk-rec-action">${p.price>0?`<strong>${euro(p.price)}</strong>`:''}${entry.discount?`<small class="wk-saving">−${saving}% statt ${euro(p.wasPrice)}</small>`:'<small class="wk-subtle">Preis, kein Rabatt bestätigt</small>'}${link?`<a target="_blank" rel="noopener noreferrer" href="${escape82(link)}" class="wk-offer-link">Zum Produkt ↗</a>`:''}${entry.category!=='list'?`<button type="button" class="btn tiny" data-wk-add="${escape82(entry.item.name)}">+ Liste</button>`:otherStore?`<button type="button" class="btn ghost tiny" data-wk-assign="${escape82(entry.item.name)}">Hier mitnehmen</button>`:''}</div></article>`;
  }).join('')}</div>`:'';}
  function renderRecommendations(){
    const target=$82('#wk-market-results');if(!target)return;
    const suggestions=Core.recommendations(state,products,{today:localDay(),store:chosen.store});
    const basket=suggestions.filter(x=>x.category==='list');const extra=suggestions.filter(x=>x.category!=='list');
    const basketMissing=storeBasket(chosen.store).filter(i=>!basket.some(s=>Core.identity(s.item.name)===Core.identity(i.name)));
    const infos=products.length?`<p class="sub wk-checked">${products.length} Produkte/Angebote geprüft${lastCheck?' · '+escape82(lastCheck):''}${failures?' · '+failures+' Abfragen ohne Ergebnis':''}. Nur tatsächlich zuordenbare Treffer werden gezeigt.</p>`:'';
    target.innerHTML=`${infos}${section('Von eurer Liste gefunden',basket)}${basketMissing.length?`<details class="wk-unmatched"><summary>${basketMissing.length} weitere Artikel stehen für ${escape82(chosen.store)} auf der Liste</summary><div class="wk-compact">${basketMissing.map(x=>`<span>${escape82(x.name)}</span>`).join('')}</div></details>`:''}
      ${section('Vorrat auffüllen / interessant',extra)}
      ${!basket.length&&!extra.length?`<p class="wk-empty">${products.length?'Keine sicheren Treffer für euren Bedarf. Wir erfinden keine Angebote.':'Keine Händlerdaten verfügbar. Nutze bei Bedarf die Originalangebote.'}</p>`:''}
      <p class="sub wk-disclaimer">Nur Hinweise: Preise, Zeiträume, Packungsgrößen, Filialbestand und Lidl-Plus-Bedingungen im Originalangebot prüfen. Nichts wird automatisch gekauft oder hinzugefügt.</p>`;
  }
  function matchPrice(products,query){return products.filter(p=>Core.matchScore(query,p)>=65).slice(0,6);}
  async function invoke(body){
    const client=window.WochenkorbCloudClient;
    if(!client)throw Error('Bitte zuerst bei Wochenkorb anmelden.');
    const {data,error}=await client.functions.invoke('store-feed',{body});
    if(error||data?.error)throw Error(data?.error||error?.message||'Händler nicht erreichbar');
    return data;
  }
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function searchLidlStores(){
    const input=$82('#wk-lidl-location'),result=$82('#wk-lidl-results');
    if(!input||!result)return;
    const query=input.value.trim();if(query.length<2){result.textContent='Bitte Ort oder Postleitzahl eingeben.';return;}
    result.textContent='Suche Lidl-Filialen …';
    try{
      const data=await invoke({store:'lidl',mode:'stores',query});storeOptions=(data.stores||[]).slice(0,8);
      result.innerHTML=storeOptions.length?storeOptions.map((s,i)=>`<button type="button" class="wk-store-option" data-wk-lidl-pick="${i}">${escape82(s.label)}</button>`).join(''):'Keine Filiale gefunden. Anderen Ort probieren.';
    }catch(e){result.textContent='Filialsuche nicht erreichbar: '+e.message;}
  }
  async function getStoreProducts(){
    const store=chosen.store;if(!store)return [];
    if(store==='Lidl'){
      if(!lidlStore?.key)throw Error('Bitte zuerst eure Lidl-Filiale auswählen.');
      const cacheKey=`lidl:${lidlStore.key}`;
      const cached=dataCache.get(cacheKey);if(cached&&Date.now()-cached.at<15*60*1000)return cached.products;
      const data=await invoke({store:'lidl',mode:'offers',storeKey:lidlStore.key});
      const rows=Array.isArray(data.products)?data.products:[];
      dataCache.set(cacheKey,{at:Date.now(),products:rows});return rows;
    }
    const items=storeBasket(store);
    const regular=(state.catalog||[]).filter(c=>c.kind==='stamm'&&c.active!==false&&knownStore(c)===store).filter(c=>!items.some(x=>Core.identity(x.name)===Core.identity(c.name))).slice(0,3);
    const names=[...new Set([...items.slice(0,store==='dm'?4:5),...regular].map(i=>i.name))].slice(0,store==='dm'?5:6);
    const rows=[];failures=0;
    if(!names.length)return [];
    for(const [idx,name] of names.entries()){
      try{
        const cacheKey=store+':'+Core.normalize(name);let cached=dataCache.get(cacheKey);
        if(!cached||Date.now()-cached.at>15*60*1000){
          const data=await invoke({store:store==='dm'?'dm':'aldi-sued',mode:'search',query:name.slice(0,60)});
          cached={at:Date.now(),products:Array.isArray(data.products)?data.products:[]};dataCache.set(cacheKey,cached);
        }
        rows.push(...cached.products.slice(0,15));
      }catch(e){failures++;}
      if(idx<names.length-1)await delay(store==='dm'?2100:260);
    }
    return rows;
  }
  async function checkMarket(){
    if(isLoading||!chosen.store)return;
    isLoading=true;const token=++checkId,checkedStore=chosen.store,checkedLidl=lidlStore?.key;hasChecked=false;products=[];failures=0;
    message=`Prüfe ${chosen.store} …`;renderBody();
    try{
      const found=await getStoreProducts();if(token!==checkId||checkedStore!==chosen.store||checkedLidl!==lidlStore?.key)return;
      products=found;hasChecked=true;lastCheck=new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
      message=products.length?`${chosen.store} geprüft. Nur Treffer zu eurem Bedarf werden empfohlen.`:'Keine Produktdaten erhalten. Die offiziellen Angebotslinks funktionieren weiterhin.';
    }catch(err){if(token===checkId){message=err.message||'Markt momentan nicht erreichbar';hasChecked=true;}}
    finally{if(token===checkId){isLoading=false;renderBody();}}
  }
  async function productSearch(){
    const field=$82('#wk-product-query'),target=$82('#wk-manual-result');if(!field||!target)return;
    const query=field.value.trim();manualQuery=query;
    if(query.length<2){target.textContent='Mindestens zwei Zeichen eingeben.';return;}
    target.textContent='Suche …';
    try{
      let rows=[];
      if(chosen.store==='Lidl'){
        if(!hasChecked){target.textContent='Bitte erst die Filialangebote laden.';return;}
        rows=products.filter(p=>Core.normalize(p.name).includes(Core.normalize(query))).slice(0,6);
      }else{
        const data=await invoke({store:chosen.store==='dm'?'dm':'aldi-sued',mode:'search',query:query.slice(0,60)});
        rows=(data.products||[]).slice(0,8);
      }
      const safe=rows.filter(p=>p&&p.name);
      target.innerHTML=safe.length?`<div class="wk-search-list">${safe.map(p=>{
        const link=safeLink(p.url);
        return `<div><span>${escape82(p.name)}<small>${escape82(p.unitPrice||'')}</small></span><span>${Number(p.price)>0?`<b>${euro(p.price)}</b>`:'Preis offen'}${link?` <a href="${escape82(link)}" target="_blank" rel="noopener noreferrer">Produkt ↗</a>`:''}</span></div>`;
      }).join('')}</div><small>Suchtreffer sind nicht automatisch Sonderangebote.</small>`:'Keine Treffer. Bitte Originalangebote öffnen.';
    }catch(e){target.textContent='Suche nicht erreichbar: '+e.message;}
  }
  function selectMarket(store){
    if(!Core.stores.includes(store))return;
    checkId++;isLoading=false;chosen={day:localDay(),store};persist(visitKey,chosen);
    products=[];message='';hasChecked=false;manualQuery='';ui();
    const shopStore=$82('#v8-shop-store');if(shopStore){shopStore.value=store;shopStore.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  function addToList(name){
    if(!state.shopping?.id){toast('Bitte zuerst eine Einkaufswoche starten.');return;}
    const modified=Core.addItem(state,name,chosen.store);
    if(!modified){toast('Steht bereits auf eurer Einkaufsliste.');return;}
    if(!state.marketOverrides||typeof state.marketOverrides!=='object')state.marketOverrides={};
    state.marketOverrides[Core.identity(name)]=chosen.store;
    refreshShopping();
    toast('Auf eurer Liste für '+chosen.store+'.');
  }
  function assignForThisWeek(name){
    if(!state.marketOverrides||typeof state.marketOverrides!=='object')state.marketOverrides={};
    state.marketOverrides[Core.identity(name)]=chosen.store;
    refreshShopping();toast('Diese Woche bei '+chosen.store+' mitnehmen.');
  }
  const oldBuildShopping=buildShopping;
  buildShopping=function(...args){return oldBuildShopping(...args).map(row=>({...row,store:state.marketOverrides?.[Core.identity(row.name)]||row.store}));};
  const oldRefresh=refreshShopping;
  refreshShopping=function(reset=false){if(reset)state.marketOverrides={};return oldRefresh(reset);};
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-wk-market],#wk-market-clear,#wk-market-check,#wk-lidl-change,#wk-lidl-search,[data-wk-lidl-pick],#wk-product-search,[data-wk-add],[data-wk-assign]');
    if(!button)return;e.preventDefault();e.stopImmediatePropagation();
    if(button.dataset.wkMarket){selectMarket(button.dataset.wkMarket);return;}
    if(button.id==='wk-market-clear'){
      checkId++;isLoading=false;chosen={day:localDay(),store:''};persist(visitKey,chosen);products=[];message='';hasChecked=false;ui();
      const picker=$82('#v8-shop-store');if(picker){picker.value='Alle';picker.dispatchEvent(new Event('change',{bubbles:true}));}
      return;
    }
    if(button.id==='wk-lidl-change'){$82('#wk-lidl-chooser').hidden=!$82('#wk-lidl-chooser').hidden;return;}
    if(button.id==='wk-lidl-search'){searchLidlStores();return;}
    if(button.dataset.wkLidlPick!==undefined){
      const row=storeOptions[Number(button.dataset.wkLidlPick)];if(row){checkId++;isLoading=false;lidlStore=row;persist(storeKey,row);products=[];hasChecked=false;message='Lidl-Filiale gespeichert.';ui();}return;
    }
    if(button.id==='wk-market-check'){checkMarket();return;}
    if(button.id==='wk-product-search'){productSearch();return;}
    if(button.dataset.wkAdd){addToList(button.dataset.wkAdd);return;}
    if(button.dataset.wkAssign){assignForThisWeek(button.dataset.wkAssign);return;}
  },true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&e.target.id==='wk-lidl-location'){e.preventDefault();searchLidlStores();}
    if(e.key==='Enter'&&e.target.id==='wk-product-query'){e.preventDefault();productSearch();}
  });
  const previousRenderShop=renderShop;
  renderShop=function(...args){previousRenderShop(...args);ui();};
  ui();
  window.WochenkorbMarkets={checkMarket,storeBasket,selectMarket};
})();
