/* Wochenkorb V5 – Supabase Auth + household document + realtime item checkmarks.
   The original V4 functions remain the offline-capable, no-build UI engine.
   Only the public Supabase publishable/anon key is ever used in this browser. */
(() => {
  'use strict';
  const cfg = window.WOCHENKORB_CONFIG || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.supabaseUrl || '') &&
    /^(sb_publishable_|eyJ)/.test(cfg.supabasePublishableKey || '');
  const statusLine = document.getElementById('cloudStatus');
  const gate = document.getElementById('authGate');
  const authForm = document.getElementById('authForm');
  const authMessage = document.getElementById('authMessage');
  const $id = id => document.getElementById(id);
  const localSave = save;  // V4 local snapshot, used as offline cache as well.
  let client = null, user = null, householdId = null, revision = -1, channel = null;
  let ready = false, applyingRemote = false, pendingDocument = false, sendingDocument = false;
  let saveTimer = null, pullTimer = null, conflict = false, pendingStatus = new Map();

  function cloudStatus(message, bad = false) {
    statusLine.textContent = message;
    statusLine.classList.toggle('error',bad);
    statusLine.title = bad ? 'Prüfe die Verbindung. Änderungen bleiben vorerst lokal.' : message;
    $id('retrySyncButton').hidden = !bad;
  }
  function message(text, bad = false) { authMessage.textContent=text; authMessage.style.color=bad?'var(--red)':'var(--muted)'; }
  function showGate(section = 'auth') {
    gate.classList.add('visible');
    document.documentElement.classList.add('auth-loading');
    $id('setupInfo').hidden = section !== 'config';
    $id('householdSetup').hidden = section !== 'household';
    authForm.hidden = section !== 'auth';
    $id('authRegister').hidden = $id('authReset').hidden = section !== 'auth';
  }
  function closeGate() {
    gate.classList.remove('visible');
    document.documentElement.classList.remove('auth-loading');
  }
  function applyTheme(theme, persist = true) {
    if (!['midnight','rose-light','rose-dark'].includes(theme)) theme='midnight';
    document.documentElement.dataset.theme = theme;
    $id('themePicker').value = theme;
    try { if (persist) localStorage.setItem('wochenkorb-theme',theme); } catch {}
    const bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.content = theme==='rose-light'?'#fff4f8':theme==='rose-dark'?'#190f19':'#11111c';
  }
  applyTheme(localStorage.getItem('wochenkorb-theme') || 'midnight',false);

  // Important: store checkmarks by (household, run ID, item key) independently.
  // A regular recipe/catalog update must not overwrite the other phone's checkmarks.
  function documentContent() {
    const copy = JSON.parse(JSON.stringify(state));
    if (copy.shopping?.items) for (const item of copy.shopping.items) item.status = 'open';
    return copy;
  }
  function documentQueueKey() { return 'wk-doc-queue:'+householdId; }
  function persistPendingDocument() {
    try { localStorage.setItem(documentQueueKey(),JSON.stringify({revision,content:documentContent()})); } catch {}
  }
  function clearPendingDocument() { try { localStorage.removeItem(documentQueueKey()); } catch {} }
  function queueDocument() {
    if (!ready || applyingRemote) return;
    pendingDocument=true;
    persistPendingDocument();
    clearTimeout(saveTimer);
    saveTimer=setTimeout(pushDocument,600);
    cloudStatus(navigator.onLine?'Synchronisiere …':'Offline · Speichere lokal');
  }
  // Interpose on V4 save(), preserving its fully local backup behavior.
  save = function () { localSave(); queueDocument(); };

  const originalRefreshShopping = refreshShopping;
  refreshShopping = function(reset=false) {
    const oldWeek=state.shopping.id;
    originalRefreshShopping(reset);
    if(oldWeek !== state.shopping.id){pendingStatus.clear();rememberPendingStatus();}
  };
  const originalStatus = changeStatus;
  changeStatus = function (key, mode) {
    if (!ready) return originalStatus(key, mode);
    const item = state.shopping.items.find(x=>x.key===key);
    if (!item) return;
    item.status = mode==='home'?(item.status==='have'?'open':'have'):(item.status==='bought'?'open':'bought');
    localSave();render();
    pendingStatus.set(key,item.status);
    rememberPendingStatus();
    flushStatuses();
  };

  function pendingStatusKey() { return 'wk-status-queue:'+householdId+':'+(state.shopping?.id||''); }
  function rememberPendingStatus() {
    try { localStorage.setItem(pendingStatusKey(), JSON.stringify([...pendingStatus])); } catch {}
  }
  function restorePendingStatus() {
    try {
      pendingStatus = new Map(JSON.parse(localStorage.getItem(pendingStatusKey()) || '[]'));
      for (const item of state.shopping.items||[]) if(pendingStatus.has(item.key)) item.status=pendingStatus.get(item.key);
    } catch { pendingStatus=new Map(); }
  }
  let statusesSending=false;
  async function flushStatuses() {
    if (statusesSending || !ready || !householdId || !navigator.onLine) return;
    statusesSending=true;
    try {
      while (pendingStatus.size && navigator.onLine) {
        const batch=[...pendingStatus];
        const week=state.shopping.id;
        if(!week) {pendingStatus.clear();rememberPendingStatus();break;}
        const rows=batch.map(([key,status])=>({household_id:householdId,week_id:week,item_key:key,status,changed_by:user.id}));
        const {error} = await client.from('item_statuses').upsert(rows,{onConflict:'household_id,week_id,item_key'});
        if(error) throw error;
        // A later click may have happened during the request; only remove unchanged values.
        if(week===state.shopping.id) {
          for(const [key,value] of batch) if(pendingStatus.get(key)===value) pendingStatus.delete(key);
          rememberPendingStatus();
        } else break;
      }
      if(!pendingDocument && !conflict) cloudStatus('✓ Synchronisiert');
    } catch(e) { cloudStatus('Offline / Sync ausstehend',true); console.warn('Status-Sync:',e); }
    finally {statusesSending=false;}
  }
  async function pushDocument() {
    if(sendingDocument || !pendingDocument || !ready || !navigator.onLine || conflict) return;
    sendingDocument=true;
    try {
      while (pendingDocument && !conflict && navigator.onLine) {
        pendingDocument=false;
        const snapshot=documentContent();
        const {data,error}=await client.rpc('save_household_state',{
          p_household:householdId,p_revision:revision,p_content:snapshot
        });
        if(error) {
          if (/revision_conflict/i.test(error.message)) {
            conflict=true;pendingDocument=true;
            cloudStatus('Konflikt · lokale Daten gesichert',true);
            document.getElementById('error').textContent='Konflikt: Zwei Geräte haben gleichzeitig Kategorien oder Rezepte bearbeitet. Bitte erst die lokale Sicherung exportieren, dann erneut synchronisieren.';document.getElementById('error').style.display='block';
            return;
          }
          throw error;
        }
        revision=Number(data);
        if(pendingDocument)persistPendingDocument();else clearPendingDocument();
      }
      if (!pendingStatus.size) cloudStatus('✓ Synchronisiert');
    } catch(e) {
      pendingDocument=true;
      cloudStatus('Sync ausstehend',true);
      console.warn('Dokument-Sync:',e);
    } finally { sendingDocument=false; }
  }
  function validDocument(s) {return s&&s.version===4&&Array.isArray(s.catalog)&&Array.isArray(s.recipes)&&Array.isArray(s.plan)&&s.shopping&&Array.isArray(s.shopping.items);}
  async function readDocument() {
    if(!householdId) return;
    const {data,error:err}=await client.from('household_state').select('content,revision').eq('household_id',householdId).single();
    if(err)throw err;
    if(!validDocument(data.content))throw Error('Die Daten im Familienhaushalt sind ungültig. Es wurde nichts überschrieben.');
    if (pendingDocument && ready) return; // never silently erase unuploaded local edits
    applyingRemote=true;
    try {
      let restore=null;
      try{restore=JSON.parse(localStorage.getItem(documentQueueKey())||'null')}catch{}
      const cached=restore&&validDocument(restore.content);
      if(cached && restore.revision!==Number(data.revision)) {
        conflict=true;pendingDocument=true;
        cloudStatus('Konflikt · lokale Daten gesichert',true);
      }
      state=cached?restore.content:data.content;
      revision=Number(data.revision);
      if(cached)pendingDocument=true;
      if(state.shopping.id) {
        const {data:statuses,error:statusError}=await client.from('item_statuses')
          .select('item_key,status').eq('household_id',householdId).eq('week_id',state.shopping.id);
        if(statusError)throw statusError;
        const map=new Map(statuses.map(i=>[i.item_key,i.status]));
        for(const item of state.shopping.items) item.status=map.get(item.key)||'open';
      }
      restorePendingStatus();
      localSave();render();
    } finally {applyingRemote=false;}
  }
  function subscribeRealtime() {
    if(channel)client.removeChannel(channel);
    channel=client.channel('wk-family-'+householdId)
      .on('postgres_changes',{event:'*',schema:'public',table:'item_statuses',filter:'household_id=eq.'+householdId},payload=>{
        const item=payload.new;
        if(!item||item.week_id!==state.shopping.id||pendingStatus.has(item.item_key))return;
        const target=state.shopping.items.find(i=>i.key===item.item_key);
        if(target){target.status=item.status;localSave();render();}
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'household_state',filter:'household_id=eq.'+householdId},payload=>{
        if(!ready || pendingDocument || conflict || Number(payload.new.revision)<=revision)return;
        clearTimeout(pullTimer);
        pullTimer=setTimeout(()=>readDocument().catch(e=>cloudStatus(e.message,true)),350);
      }).subscribe();
  }
  async function loadPreference() {
    const {data, error:err}=await client.from('user_preferences').select('theme').eq('user_id',user.id).maybeSingle();
    if(err)console.warn('Theme sync:',err.message);
    if(data?.theme)applyTheme(data.theme);
  }
  async function startFamily(id) {
    householdId=id;
    ready=false; conflict=false;pendingDocument=false; revision=-1;
    await readDocument();
    await loadPreference();
    ready=true;
    subscribeRealtime();
    cloudStatus(conflict?'Konflikt · lokale Daten gesichert':pendingDocument?'Änderungen werden synchronisiert …':'✓ Synchronisiert',conflict);
    if(pendingDocument&&!conflict)pushDocument();
    $id('accountInfo').textContent='Angemeldet: '+user.email+' · gemeinsame Familienliste';
    $id('signOutButton').hidden=false;
    $id('createInviteButton').hidden=false;
    closeGate();
    flushStatuses();
  }
  async function afterLogin() {
    const {data:{user:current},error:err} = await client.auth.getUser();
    if (err || !current) {showGate('auth');return;}
    user=current;
    const {data:member,error:memberError}=await client.from('household_members')
      .select('household_id,role').eq('user_id',user.id).maybeSingle();
    if(memberError)throw memberError;
    if(!member) {showGate('household');message('Konto eingerichtet. Jetzt Haushalt erstellen oder beitreten.');return;}
    await startFamily(member.household_id);
    $id('createInviteButton').hidden=member.role!=='owner';
  }

  $id('themePicker').addEventListener('change',async e=>{
    const selected=e.target.value;applyTheme(selected);
    if(client&&user&&ready) {
      const {error:err}=await client.from('user_preferences').upsert({user_id:user.id,theme:selected,updated_at:new Date().toISOString()});
      if(err)toast('Design lokal gespeichert; Cloud-Update fehlgeschlagen');
    }
  });
  authForm.addEventListener('submit',async e=>{
    e.preventDefault();const btn=authForm.querySelector('button[type=submit]');btn.disabled=true;message('Anmeldung läuft …');
    try {
      const {error:err}=await client.auth.signInWithPassword({email:$id('authEmail').value.trim(),password:$id('authPassword').value});
      if(err)throw err;
      await afterLogin();
    }catch(e){message(e.message||'Anmeldung fehlgeschlagen',true)}finally{btn.disabled=false;}
  });
  $id('authRegister').onclick=async()=>{
    const email=$id('authEmail').value.trim(),password=$id('authPassword').value;
    if(!email||password.length<8){message('E-Mail und Passwort mit mindestens 8 Zeichen eingeben.',true);return;}
    message('Konto wird erstellt …');
    try{
      const {data,error:err}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});if(err)throw err;
      if(data.session)await afterLogin(); else message('Bestätigungs-E-Mail gesendet. Bitte bestätigen und anschließend anmelden.');
    }catch(e){message(e.message,true)}
  };
  $id('authReset').onclick=async()=>{
    const email=$id('authEmail').value.trim();if(!email){message('Bitte zuerst die E-Mail-Adresse eingeben.',true);return;}
    const {error:err}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    message(err?err.message:'E-Mail zum Zurücksetzen wurde verschickt.',Boolean(err));
  };
  $id('createHousehold').onclick=async()=>{
    const name=$id('newHouseholdName').value.trim()||'Unser Zuhause';
    message('Haushalt wird angelegt …');
    const initialStatuses=(state.shopping?.items||[]).filter(i=>i.status&&i.status!=='open');
    const initialWeek=state.shopping?.id;
    const {data,error:err}=await client.rpc('create_household',{p_name:name,p_initial_state:documentContent()});
    if(err){message(err.message,true);return;}
    try{
      if(initialWeek&&initialStatuses.length){
        const {error:statusErr}=await client.from('item_statuses').upsert(initialStatuses.map(i=>({
          household_id:data,week_id:initialWeek,item_key:i.key,status:i.status,changed_by:user.id
        })),{onConflict:'household_id,week_id,item_key'});
        if(statusErr)console.warn('Alte Häkchen konnten nicht übernommen werden:',statusErr);
      }
      await startFamily(data);
    }catch(e){message(e.message,true)}
  };
  $id('joinHousehold').onclick=async()=>{
    const token=$id('inviteCode').value.trim();
    const {data,error:err}=await client.rpc('join_household',{p_token:token});
    if(err){message('Einladung ungültig oder abgelaufen: '+err.message,true);return;}
    try{await startFamily(data)}catch(e){message(e.message,true)}
  };
  $id('createInviteButton').onclick=async()=>{
    const {data,error:err}=await client.rpc('create_household_invite',{p_household:householdId});
    if(err){toast(err.message);return;}
    try{await navigator.clipboard.writeText(data);toast('Einmaliger Einladungscode kopiert · 7 Tage gültig')}
    catch{window.prompt('Einladungscode für deine Frau – einmalig gültig:',data)}
  };
  async function signOut() {
    ready=false;
    if(channel)await client.removeChannel(channel);
    await client.auth.signOut();user=null;householdId=null;revision=-1;pendingStatus.clear();pendingDocument=false;
    try { localStorage.removeItem(KEY); } catch{}
    state=defaultState();localSave();render();
    $id('accountInfo').textContent='Nicht angemeldet';$id('signOutButton').hidden=true;
    $id('createInviteButton').hidden=true;cloudStatus('Nicht angemeldet');showGate('auth');
  }
  $id('signOutButton').onclick=signOut;
  $id('setupSignOut').onclick=signOut;
  $id('retrySyncButton').onclick=async()=>{
    if(conflict){
      if(!confirm('Die neueren Cloud-Daten laden? Lokale, noch nicht synchronisierte Änderungen gehen dabei verloren. Vorher am besten eine Sicherung exportieren.'))return;
      conflict=false;pendingDocument=false;clearPendingDocument();
    }
    try{await readDocument();await pushDocument();await flushStatuses();cloudStatus('✓ Synchronisiert')}
    catch(e){cloudStatus(e.message,true)}
  };
  $id('localOnly').onclick=()=>{cloudStatus('Nur lokal · keine gemeinsame Synchronisierung',true);closeGate()};

  // V4's recipe importer fetches cross-origin links directly and fails with CORS.
  // If Supabase is active, use the controlled backend to read supported recipe sites.
  const originalImport = importRecipe;
  importRecipe = async function (form) {
    const url=String(form.elements.url.value||'').trim(),text=String(form.elements.text.value||'').trim();
    if(ready && url && !text && !/themealdb\.com/i.test(url)) {
      try {
        const {data,error:err}=await client.functions.invoke('recipe-import',{body:{url}});
        if(err)throw err;
        if(!data?.recipe)throw Error(data?.error||'Kein Rezept gefunden');
        const recipe=fromRecipeJson(data.recipe,url);
        if(!recipe?.ingredients.length)throw Error('Keine Zutaten im Rezept gefunden');
        saveImported(recipe);return;
      } catch(e) {
        // Fallback to browser import for CORS-compatible sites, otherwise explain.
        try {return await originalImport(form)}catch{
          throw Error('Rezept-Import nicht möglich: '+(e.message||'Website nicht unterstützt')+'. Alternativ Zutaten als Text einfügen.');
        }
      }
    }
    return originalImport(form);
  };

  window.addEventListener('online',()=>{
    if(!ready)return;
    flushStatuses();
    if(pendingDocument)pushDocument();else readDocument().catch(e=>cloudStatus(e.message,true));
  });
  window.addEventListener('pagehide',()=>{if(ready&&pendingDocument)cloudStatus('Nicht synchronisierte Änderungen');});

  function loadSDK() {
    if(window.supabase?.createClient)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const tag=document.createElement('script');
      const timer=setTimeout(()=>{tag.remove();reject(Error('Supabase-SDK konnte nicht geladen werden'))},12000);
      tag.onload=()=>{clearTimeout(timer);window.supabase?.createClient?resolve():reject(Error('Supabase-Bibliothek ungültig'));};
      tag.onerror=()=>{clearTimeout(timer);reject(Error('Supabase-Bibliothek nicht erreichbar'));};
      tag.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      document.head.append(tag);
    });
  }
  async function boot() {
    if(!configured) {
      showGate('config');cloudStatus('Lokal · Supabase noch nicht eingerichtet',true);return;
    }
    try{await loadSDK()}catch(e){showGate('config');message(e.message,true);cloudStatus('Supabase nicht erreichbar',true);return}
    client=window.supabase.createClient(cfg.supabaseUrl.replace(/\/$/,''),cfg.supabasePublishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    window.WochenkorbCloudClient=client; // Read-only access for first-party V7 functions.
    // Avoid triggering an incomplete household load on TOKEN_REFRESHED.
    client.auth.onAuthStateChange((event)=>{
      if(event==='PASSWORD_RECOVERY') {
        setTimeout(async()=>{
          const pass=prompt('Neues Passwort (mindestens 8 Zeichen):');
          if(pass?.length>=8){const {error:err}=await client.auth.updateUser({password:pass});message(err?err.message:'Passwort geändert. Du kannst dich anmelden.',Boolean(err));}
        },0);
      }
      if(event==='SIGNED_OUT'&&ready) setTimeout(signOut,0);
    });
    try {
      const {data:{session}}=await client.auth.getSession();
      if(session)await afterLogin();else {showGate('auth');cloudStatus('Anmeldung erforderlich')}
    }catch(e){showGate('auth');message(e.message,true);cloudStatus('Verbindung fehlgeschlagen',true)}
  }
  boot();
})();
