/* Wochenkorb V8 – catalogue search, reversible list assignment, canonical ingredients,
   store routes and conflict-safe document updates. No permanent Apple import. */
(() => {
  'use strict';
  const $8 = q => document.querySelector(q);
  const escape8 = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normal = s => String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
  const stores = ['ALDI Süd','dm','Lidl','Anderes'];
  let manageQuery='',manageStore='Alle',shopQuery='',shopStore='Alle',homeQuery='',bulkSelection=new Set();
  // Deliberately conservative: tomato paste, canned tomatoes and cherry tomatoes
  // are NOT interchangeable with fresh tomatoes. User aliases override the defaults.
  const defaults = new Map(Object.entries({
    'tomate':'tomaten','tomaten':'tomaten','frische tomate':'tomaten','frische tomaten':'tomaten',
    'rispentomate':'tomaten','rispentomaten':'tomaten','rispen tomaten':'tomaten','tomaten gross':'tomaten','grosse tomaten':'tomaten',
    'zwiebel':'zwiebeln','zwiebeln':'zwiebeln','gelbe zwiebeln':'zwiebeln',
    'apfel':'apfel','apfelstucke':'apfel','apfelstuecke':'apfel','apfel frisch':'apfel','apfel rot':'apfel',
    'aepfel':'apfel','aepfeln':'apfel','aepfel frisch':'apfel',
    'ei':'eier','eier':'eier','huhnereier':'eier',
    'kartoffel':'kartoffeln','kartoffeln':'kartoffeln',
    'mohre':'karotten','mohren':'karotten','karotte':'karotten','karotten':'karotten',
    'banane':'bananen','bananen':'bananen',
    'gurke':'gurke','salatgurke':'gurke','salatgurken':'gurke',
    'nudel':'nudeln','nudeln':'nudeln'
  }));
  // These phrases must never silently merge into fresh tomatoes, even if users
  // later extend the default alias table accidentally.
  const ingredientKey = value => {
    const text=normal(value);
    const aliases=state?.ingredientAliases && typeof state.ingredientAliases==='object'?state.ingredientAliases:{};
    const custom=aliases[text];
    if(typeof custom==='string' && custom && custom!==text) return normal(custom);
    return defaults.get(text)||text;
  };
  window.WochenkorbIngredients={key:ingredientKey,normalize:normal};
  function storeOf(item){
    if(stores.includes(item?.store))return item.store;
    const text=normal([item?.name,item?.area,item?.aisle].filter(Boolean).join(' '));
    if(/wasser|mineralwasser|sprudelwasser/.test(text))return 'Lidl';
    if(/drogerie|baby|windel|feuchttuch|pflege|bad |seife|shampoo|spulmittel|reinig|waschmittel|zahnpasta|zahnburste|schnuller|kindersachen|toilettenpapier|klopapier/.test(text))return 'dm';
    return 'ALDI Süd';
  }
  const matches=(item,query)=>!query||normal([item.name,item.area,item.aisle,item.amount,item.store, ...(Object.entries(state.ingredientAliases||{}).filter(([,v])=>ingredientKey(v)===ingredientKey(item.name)).map(([k])=>k))].join(' ')).includes(normal(query));
  const withStore=(item)=>({...item,store:storeOf(item)});

  function managerBar(){
    const root=$8('#view-verwalten');if(!root)return;
    let bar=$8('#v8-manage-bar');
    if(!bar){
      bar=document.createElement('div');bar.id='v8-manage-bar';bar.className='surface box v8-tools';
      bar.innerHTML=`<div class="v8-tools-title"><h2>Artikel finden & verwalten</h2><small id="v8-manage-count"></small></div>
       <div class="v8-fields"><label>Suche<input class="field" id="v8-manage-search" type="search" autocomplete="off" placeholder="Milch, Tomate, Windeln …" aria-label="Artikel suchen"></label>
       <label>Geschäft<select class="field" id="v8-manage-store"><option>Alle</option>${stores.map(s=>`<option>${s}</option>`).join('')}</select></label></div>
       <p class="sub">⇄ schiebt Artikel zwischen Stamm und Bedarf um. Der Artikel, seine Notizen und Historie bleiben erhalten. Die aktuelle Einkaufsliste wird nicht automatisch zurückgesetzt.</p>
       <div class="v8-bulk"><span id="v8-selected-count">0 ausgewählt</span><button class="btn ghost tiny" id="v8-bulk-stamm" type="button">→ Stamm</button><button class="btn ghost tiny" id="v8-bulk-bedarf" type="button">→ Bedarf</button><button class="btn ghost tiny" id="v8-bulk-clear" type="button">Auswahl löschen</button></div>
       <details id="v8-duplicates" class="v8-duplicates"><summary>Gleiche Zutaten prüfen <span id="v8-duplicate-count"></span></summary><div id="v8-duplicate-list"></div></details>`;
      root.querySelector('.pagehead')?.after(bar);
    }
    const search=$8('#v8-manage-search'),select=$8('#v8-manage-store');
    if(search&&search.value!==manageQuery)search.value=manageQuery;
    if(select&&select.value!==manageStore)select.value=manageStore;
  }
  function manageRows(){
    managerBar();
    const filtered=state.catalog.filter(item=>matches(item,manageQuery)&&(manageStore==='Alle'||storeOf(item)===manageStore));
    for(const kind of ['stamm','bedarf']){
      const root=$8(kind==='stamm'?'#stapleManager':'#optionalManager');if(!root)continue;
      const rows=filtered.filter(c=>c.kind===kind).sort((a,b)=>a.name.localeCompare(b.name,'de'));
      root.innerHTML=rows.map(c=>`<li class="v8-catalog-row"><input type="checkbox" class="v8-mark" data-v8-select="${escape8(c.id)}" ${bulkSelection.has(c.id)?'checked':''} aria-label="${escape8(c.name)} auswählen">
        <div class="name"><b>${escape8(c.name)}</b><small>${escape8(c.area)} · ${escape8(c.aisle)} · ${escape8(storeOf(c))}${c.amount?' · '+escape8(c.amount):''}</small></div>
        <button type="button" class="btn ghost tiny" data-v8-toggle="${escape8(c.id)}" aria-label="${escape8(c.name)} in ${kind==='stamm'?'Nach Bedarf':'Stammzutaten'} verschieben">⇄ ${kind==='stamm'?'Bedarf':'Stamm'}</button>
        <button class="btn ghost tiny" data-v8-alias="${escape8(c.id)}" type="button" aria-label="Synonyme für ${escape8(c.name)}">Synonyme</button>
        <button class="btn ghost tiny" data-action="edit-catalog" data-id="${escape8(c.id)}">✎</button></li>`).join('')||'<li class="muted tinytext">Keine passenden Artikel.</li>';
    }
    $8('#v8-manage-count').textContent=filtered.length+' von '+state.catalog.length+' Artikeln';
    $8('#v8-selected-count').textContent=bulkSelection.size+' ausgewählt';
    const groups=new Map();
    for(const c of state.catalog){const key=ingredientKey(c.name);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}
    const duplicates=[...groups.entries()].filter(([,rows])=>rows.length>1);
    $8('#v8-duplicate-count').textContent='('+duplicates.length+' Gruppen)';
    $8('#v8-duplicate-list').innerHTML=duplicates.length?duplicates.slice(0,30).map(([key,rows])=>
      `<div class="v8-duplicate-row"><div><b>${escape8(rows[0].name)}</b><small>${rows.map(c=>escape8(c.name)).join(' · ')}</small></div><button type="button" class="btn ghost tiny" data-v8-merge="${escape8(key)}">Prüfen</button></div>`
    ).join(''):'<p class="sub">Keine eindeutig gleichgeordneten Katalogartikel. Ähnliche, aber unterschiedliche Produkte werden absichtlich nicht automatisch zusammengelegt.</p>';
  }
  const previousManage=renderManage;
  renderManage=function(...args){previousManage(...args);manageRows();};

  // The normal catalog form remains the primary place for adding and editing;
  // V8 merely exposes the preferred store in the same dialog.
  const oldOpenCatalog=openCatalog;
  openCatalog=function(id,kind){oldOpenCatalog(id,kind);const f=$8('#catalogForm');let field=f.querySelector('#v8-store-select');
    if(!field){let row=document.createElement('label');row.className='v8-store-select-wrap';row.textContent='Bevorzugtes Geschäft';
      row.innerHTML+=' <select class="field" name="v8store" id="v8-store-select">'+stores.map(s=>`<option>${s}</option>`).join('')+'</select>';
      f.querySelector('.form-actions')?.before(row);field=f.querySelector('#v8-store-select');}
    const found=state.catalog.find(c=>c.id===id);field.value=found?.store||storeOf(found||{name:f.elements.name.value,area:f.elements.area.value,aisle:f.elements.aisle.value});
  };
  // Handler runs after V4's submit handler, which creates/edits catalog rows.
  // Use a capture listener to save the preferred store inside the same mutation.
  document.addEventListener('submit',e=>{
    if(e.target?.id!=='catalogForm')return;
    const f=e.target,desired=f.elements.v8store?.value;
    if(!stores.includes(desired))return;
    // Original submit listener follows on target. Save the store in its own
    // microtask only if original validation succeeded and closed the dialog.
    const before=f.elements.id.value,entered=f.elements.name.value.trim();
    queueMicrotask(()=>{
      if(f.closest('dialog')?.open)return;
      const item=before?state.catalog.find(x=>x.id===before):state.catalog.find(x=>normal(x.name)===normal(entered));
      if(item && item.store!==desired)mutate(()=>{item.store=desired},'Geschäft gespeichert');
    });
  },true);

  // Deduplication in the shopping list uses the exact same canonical key as
  // catalogue creation. It never changes recipe ingredient text or quantities.
  const oldBuildShopping=buildShopping;
  buildShopping=function(){return oldBuildShopping().map(i=>{
    const catalogue=state.catalog.find(x=>ingredientKey(x.name)===ingredientKey(i.name));
    return {...i,store:storeOf(catalogue||i)};
  });};
  const oldPlanSignature=planSignature;
  planSignature=function(){return oldPlanSignature()+'|'+JSON.stringify(state.catalog.map(x=>[x.id,x.store]))+'|'+JSON.stringify(state.ingredientAliases||{});};
  // Every search is a view filter: never mutate the shopping item statuses.
  function shopBar(){
    const root=$8('#view-einkaufen');if(!root)return;
    let bar=$8('#v8-shop-bar');if(!bar){bar=document.createElement('div');bar.id='v8-shop-bar';bar.className='surface box v8-tools';
      bar.innerHTML=`<div class="v8-tools-title"><h2>Wo kaufen wir ein?</h2><small id="v8-shop-count"></small></div>
       <div class="v8-fields"><label>Artikel suchen<input type="search" class="field" id="v8-shop-search" placeholder="Auf der Einkaufsliste suchen …"></label>
       <label>Geschäft<select class="field" id="v8-shop-store"><option>Alle</option>${stores.map(s=>`<option>${s}</option>`).join('')}</select></label></div>
       <p class="sub">Standardgeschäfte für eure Artikel. Mit „Bin sowieso dort“ kannst du auch die Angebote anderer Märkte berücksichtigen.</p>`;
       root.querySelector('.pagehead')?.after(bar);
    }
    $8('#v8-shop-search').value=shopQuery;$8('#v8-shop-store').value=shopStore;
  }
  function showShop(){shopBar();if(!state.shopping.id)return;
    const all=state.shopping.items.filter(i=>i.status!=='have').map(withStore);
    const rows=all.filter(i=>matches(i,shopQuery)&&(shopStore==='Alle'||i.store===shopStore));
    $8('#v8-shop-count').textContent=rows.length+' von '+all.length+' Artikeln';
    $8('#shopShopping').innerHTML=rows.length?groupsMarkup(rows,'shop'):'<div class="empty">Keine Artikel mit diesem Filter.</div>';
    for(const element of $8('#shopShopping').querySelectorAll('.product-row')){
      const key=element.querySelector('[data-key]')?.dataset.key;
      const item=rows.find(i=>i.key===key);
      if(!item)continue;
      const tag=document.createElement('small');tag.className='v8-store-tag';tag.textContent=item.store;element.querySelector('.product-text')?.append(tag);
      if(element.querySelector('.open-details')){
        const btn=document.createElement('button');btn.type='button';btn.className='v8-store-button';btn.dataset.v8StoreKey=key;btn.textContent='Geschäft ändern';btn.setAttribute('aria-label',item.name+' Geschäft ändern');element.querySelector('.open-details').before(btn);
      }
    }
  }
  // One deliberate button, no background crawling: compare at most six
  // ALDI articles from the current list. Exact canonical matching only.
  function addPriceButton(){
    const panel=$8('#v7-stores');if(!panel||panel.querySelector('#v8-aldi-check'))return;
    const section=document.createElement('div');section.className='v8-price-check';
    section.innerHTML='<button class="btn ghost" type="button" id="v8-aldi-check">Meine Einkaufsliste bei ALDI prüfen</button><p class="sub" id="v8-aldi-status">Prüft auf Wunsch maximal 6 bekannte ALDI-Artikel. Preise unverbindlich, keine Filialgarantie.</p>';
    panel.append(section);
  }
  async function checkAldiList(){
    const status=$8('#v8-aldi-status'),button=$8('#v8-aldi-check');if(!status||!button)return;
    const client=window.WochenkorbCloudClient;
    if(!client){status.textContent='Bitte zuerst online anmelden.';return;}
    const items=state.shopping?.items?.filter(x=>x.status==='open'&&storeOf(state.catalog.find(c=>ingredientKey(c.name)===ingredientKey(x.name))||x)==='ALDI Süd').slice(0,6)||[];
    if(!items.length){status.textContent='Keine offenen ALDI-Artikel auf der aktuellen Einkaufsliste.';return;}
    button.disabled=true;status.textContent='Prüfe '+items.length+' Artikel …';
    const hits=[],failures=[];let offers=[];
    try{
      for(const item of items){
        try{
          const {data,error}=await client.functions.invoke('store-feed',{body:{store:'aldi-sued',query:item.name.slice(0,60)}});
          if(error||data?.error)throw Error(error?.message||data.error);
          const found=(data?.products||[]).find(p=>ingredientKey(p.name)===ingredientKey(item.name));
          if(!found)continue;
          hits.push({item:item.name,price:Number(found.price),before:Number(found.wasPrice)});
          if(Number(found.wasPrice)>Number(found.price)&&Number(found.price)>0){offers.push({id:uid(),name:item.name,store:'ALDI Süd',price:Number(found.price),reference:Number(found.wasPrice),source:'aldi-live',fetchedAt:new Date().toISOString()});}
        }catch(e){failures.push(item.name);}
        await new Promise(resolve=>setTimeout(resolve,450));
      }
      if(offers.length)mutate(()=>{state.offers=[...(state.offers||[]).filter(o=>o.source!=='aldi-live'),...offers]},'ALDI-Angebote verglichen');
      addPriceButton();
      const newStatus=$8('#v8-aldi-status');if(newStatus)newStatus.innerHTML=hits.length?
        `${hits.length} passende Artikel gefunden${failures.length?' · '+failures.length+' Abfragen fehlgeschlagen':''}.<div class="v7-product-list">${hits.map(h=>`<div><span>${escape8(h.item)}</span><strong>${Number(h.price).toFixed(2).replace('.',',')} €${h.before>h.price?' <s>'+Number(h.before).toFixed(2).replace('.',',')+' €</s>':''}</strong></div>`).join('')}</div>`:
        'Keine eindeutig zuordenbaren ALDI-Preise gefunden'+(failures.length?' (Quelle zeitweise nicht erreichbar)':'')+'. Bitte Originalangebote prüfen.';
    }finally{button.disabled=false;}
  }
  // V6 may redraw the panel, so add the opt-in lookup whenever the learning
  // page becomes visible, without touching saved data.
  const addScanIfNeeded=()=>{if($8('#v7-stores'))addPriceButton()};
  if($8('#intelligence-root'))new MutationObserver(addScanIfNeeded).observe($8('#intelligence-root'),{childList:true});
  addScanIfNeeded();
  document.addEventListener('click',e=>{if(e.target?.id==='v8-aldi-check'){e.stopImmediatePropagation();checkAldiList().catch(err=>{$8('#v8-aldi-status').textContent='Preisabfrage fehlgeschlagen: '+err.message;});}},true);

  const previousShop=renderShop;
  renderShop=function(...args){previousShop(...args);showShop();};
  const previousHome=renderHome;
  renderHome=function(...args){previousHome(...args);showHomeSearch();};
  function showHomeSearch(){
    let bar=$8('#v8-need-bar');if(!bar){bar=document.createElement('div');bar.id='v8-need-bar';bar.className='v8-home-search';
      bar.innerHTML='<label>Nach Bedarf durchsuchen<input class="field" type="search" id="v8-need-search" placeholder="Artikel suchen …"></label><small id="v8-need-count"></small>';
      $8('#needChips')?.before(bar);
    }
    const input=$8('#v8-need-search');if(input)input.value=homeQuery;
    const matchesList=state.catalog.filter(c=>c.kind==='bedarf'&&c.active!==false&&matches(c,homeQuery));
    const display=homeQuery?matchesList:matchesList.slice(0,36);
    $8('#needChips').innerHTML=display.map(c=>`<button class="chip ${state.selected.includes(c.id)?'active':''}" data-action="toggle-need" data-id="${escape8(c.id)}">${state.selected.includes(c.id)?'✓ ':'+ '}${escape8(c.name)}</button>`).join('')||'<p class="sub">Keine Treffer.</p>';
    $8('#v8-need-count').textContent=homeQuery?`${matchesList.length} Treffer`:`${Math.min(36,matchesList.length)} von ${matchesList.length} · Suchen für weitere`;
  }
  function aliasesFor(c){return Object.entries(state.ingredientAliases||{}).filter(([,value])=>ingredientKey(value)===ingredientKey(c.name)).map(([name])=>name);}
  function aliasEditor(id){const item=state.catalog.find(c=>c.id===id);if(!item)return;
    const before=aliasesFor(item);
    const input=prompt(`Andere Namen für „${item.name}“ (mit Komma trennen).\nBeispiel: Rispentomaten, frische Tomaten\nAchtung: Unterschiedliche Produktarten NICHT zusammenführen.`,before.join(', '));
    if(input===null)return;
    const proposed=[...new Set(input.split(',').map(normal).filter(Boolean))];
    const dangerous=proposed.filter(alias=>{
      const other=state.catalog.find(x=>x.id!==id&&ingredientKey(x.name)===ingredientKey(alias));return Boolean(other);
    });
    if(dangerous.length&&!confirm('Einige Bezeichnungen gehören bereits zu anderen Katalogartikeln: '+dangerous.join(', ')+'. Trotzdem zuordnen?'))return;
    mutate(()=>{
      const aliases={...(state.ingredientAliases||{})};
      for(const name of before)delete aliases[name];
      for(const name of proposed)if(name!==normal(item.name))aliases[name]=normal(item.name);
      state.ingredientAliases=aliases;
    },'Synonyme aktualisiert');
  }
  function mergeDuplicates(key){
    const duplicates=state.catalog.filter(x=>ingredientKey(x.name)===key);
    if(duplicates.length<2)return;
    const lines=duplicates.map((c,i)=>`${i+1}: ${c.name} (${c.kind==='stamm'?'Stamm':'Bedarf'} · ${storeOf(c)})`).join('\n');
    const choice=prompt('Welche Artikelbezeichnung behalten?\n'+lines+'\nDie übrigen Einträge werden mit diesem Artikel zusammengelegt. Das ist eine bewusste Katalogänderung.','1');
    if(choice===null)return;const chosen=duplicates[Number(choice)-1];if(!chosen){toast('Keine gültige Auswahl');return;}
    if(!confirm('Zusammenführen? Die alternativen Artikel werden aus dem Katalog entfernt, Rezepte behalten ihre Originaltexte.'))return;
    mutate(()=>{
      const others=duplicates.filter(c=>c.id!==chosen.id);
      if(duplicates.some(c=>c.kind==='stamm'))chosen.kind='stamm';
      if(duplicates.some(c=>state.selected.includes(c.id))&&chosen.kind==='bedarf'&&!state.selected.includes(chosen.id))state.selected.push(chosen.id);
      if(chosen.kind==='stamm')state.selected=state.selected.filter(id=>id!==chosen.id);
      if(!chosen.amount)chosen.amount=others.find(c=>c.amount)?.amount||'';
      state.ingredientAliases={...(state.ingredientAliases||{})};
      for(const c of others)if(normal(c.name)!==normal(chosen.name))state.ingredientAliases[normal(c.name)]=normal(chosen.name);
      const obsolete=new Set(others.map(c=>c.id));
      state.catalog=state.catalog.filter(c=>!obsolete.has(c.id));
      state.selected=state.selected.filter(id=>!obsolete.has(id));
    },'Duplikate zusammengeführt');
  }
  function toggleKinds(ids,kind){const existing=ids.map(id=>state.catalog.find(c=>c.id===id)).filter(Boolean);
    if(!existing.length)return;
    mutate(()=>{
      for(const c of existing){c.kind=kind;if(kind==='stamm')state.selected=state.selected.filter(x=>x!==c.id);}
    },`${existing.length} Artikel nach ${kind==='stamm'?'Stammzutaten':'Nach Bedarf'} verschoben`);
  }
  function storeAssign(key){const row=state.shopping.items.find(i=>i.key===key);if(!row)return;
    const item=state.catalog.find(x=>ingredientKey(x.name)===ingredientKey(row.name));
    const choice=prompt(`Geschäft für „${row.name}“:\n1 = ALDI Süd, 2 = dm, 3 = Lidl, 4 = Anderes`,String(Math.max(1,stores.indexOf(storeOf(item||row))+1)));
    if(choice===null)return;const store=stores[Number(choice)-1];if(!store){toast('Bitte eine Zahl von 1 bis 4 eingeben');return;}
    mutate(()=>{
      if(item){item.store=store;}else {
        // A recipe-only or one-off item is added as optional catalogue item,
        // preserving the existing shopping row and all checkmarks.
        state.catalog.push({id:uid(),name:row.name,kind:'bedarf',area:row.area,aisle:row.aisle,active:true,amount:'',store});
      }
      row.store=store;
    },'Geschäft gespeichert');
  }
  // Capture only V8 actions. Original V4/V6/V7 handlers remain unchanged.
  document.addEventListener('click',e=>{
    const action=e.target.closest('[data-v8-toggle],[data-v8-alias],[data-v8-merge],[data-v8-store-key],#v8-bulk-stamm,#v8-bulk-bedarf,#v8-bulk-clear');
    if(!action)return;e.preventDefault();e.stopImmediatePropagation();
    if(action.dataset.v8Toggle){const c=state.catalog.find(i=>i.id===action.dataset.v8Toggle);if(c)toggleKinds([c.id],c.kind==='stamm'?'bedarf':'stamm');return;}
    if(action.dataset.v8Alias){aliasEditor(action.dataset.v8Alias);return;}
    if(action.dataset.v8Merge){mergeDuplicates(action.dataset.v8Merge);return;}
    if(action.dataset.v8StoreKey){storeAssign(action.dataset.v8StoreKey);return;}
    if(action.id==='v8-bulk-clear'){bulkSelection.clear();manageRows();return;}
    if(action.id==='v8-bulk-stamm'||action.id==='v8-bulk-bedarf'){
      toggleKinds([...bulkSelection],action.id==='v8-bulk-stamm'?'stamm':'bedarf');bulkSelection.clear();manageRows();
    }
  },true);
  document.addEventListener('change',e=>{
    if(e.target?.matches('[data-v8-select]')){const id=e.target.dataset.v8Select;if(e.target.checked)bulkSelection.add(id);else bulkSelection.delete(id);$8('#v8-selected-count').textContent=bulkSelection.size+' ausgewählt';}
    if(e.target?.id==='v8-manage-store'){manageStore=e.target.value;manageRows();}
    if(e.target?.id==='v8-shop-store'){shopStore=e.target.value;showShop();}
  });
  document.addEventListener('input',e=>{
    if(e.target?.id==='v8-manage-search'){manageQuery=e.target.value;manageRows();$8('#v8-manage-search')?.focus();}
    if(e.target?.id==='v8-shop-search'){shopQuery=e.target.value;showShop();$8('#v8-shop-search')?.focus();}
    if(e.target?.id==='v8-need-search'){homeQuery=e.target.value;showHomeSearch();$8('#v8-need-search')?.focus();}
  });
  // Document-content replacement from Supabase invokes render(), so V8 view
  // helpers always derive from the CURRENT shared household state.
  render();
})();
