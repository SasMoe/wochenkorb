/* Wochenkorb V6: local-first purchase evidence, cautious stock signals and relevance-only offers.
   No merchant feeds, advertising, or network calls except optional user-initiated OCR. */
(() => {
'use strict';
const $v = q => document.querySelector(q);
const escV = s => String(s ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = s => String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
const money = n => Number(n).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
const iso = () => new Date().toISOString().slice(0,10);
const days = (a,b) => Math.max(0,Math.floor((new Date(a+'T12:00:00')-new Date(b+'T12:00:00'))/86400000));
const euro = raw => {const s=String(raw||'').replace(/€/g,'').trim();if(!s)return NaN;const n=s.includes(',')?Number(s.replace(/\./g,'').replace(',','.')):Number(s);return Number.isFinite(n)?n:NaN};
const ensure = () => {if(!Array.isArray(state.receipts))state.receipts=[];if(!Array.isArray(state.offers))state.offers=[];if(!state.storePreferences)state.storePreferences={primary:'ALDI Süd',water:'Lidl'};};
ensure();
const purchases = () => state.receipts.flatMap(r => (r.items||[]).map(x=>({...x,date:r.date,store:r.store,receiptId:r.id}))).filter(x=>x.name);
const matches = (a,b) => {const x=normalize(a),y=normalize(b);return x===y || (x.length>3&&y.length>3&&(x.includes(y)||y.includes(x)));};
const relevantName = name => state.catalog.some(c=>matches(name,c.name)) || state.shopping.items.some(c=>matches(name,c.name)) || state.recipes.some(r=>state.plan.some(p=>p.id===r.id)&&r.ingredients.some(x=>matches(name,x[0]))) || purchases().some(p=>matches(name,p.name));
function parseReceipt(text){
  const out=[];const lines=String(text||'').split(/\r?\n/);
  for (let raw of lines){
    let line=raw.replace(/\s+/g,' ').trim();if(!line||/^(summe|gesamt|total|bar|karte|mwst|ust|wechselgeld|gegeben|rueckgeld|rückgeld|bon|filiale|datum|terminal|zahlung|rabatt|pfandbon|zwischensumme|brutto|netto|steuer|steuerbetrag)\b/i.test(line))continue;
    // Price must end line. Discounts, empty labels and receipts metadata are rejected.
    const m=line.match(/^(.+?)\s+(-?\d{1,5}[,.]\d{2})\s*(?:[ABCD*])?\s*$/i);
    if(!m||m[2].startsWith('-'))continue;
    let name=m[1].replace(/^\d{6,14}\s+/,'').replace(/\s+[A-D]$/i,'').trim();
    let qty=1;const qm=name.match(/^(\d+(?:[.,]\d+)?)\s*[xX×]\s+(.+)$/);if(qm){qty=euro(qm[1]);name=qm[2]}
    if(name.length<2||name.length>110||/^(beleg|eur|euro|ust|datum|konto|kartennummer|summe|gesamt|ersparnis|filiale|nr\.?|\d{2}\.\d{2}\.\d{2,4})/i.test(name))continue;
    const price=euro(m[2]);if(!Number.isFinite(price)||price<=0||price>1000)continue;
    out.push({id:uid(),name,qty:Number.isFinite(qty)&&qty>0?qty:1,price});
  }
  return out;
}
function bestHistory(name){return purchases().filter(x=>matches(x.name,name)).sort((a,b)=>b.date.localeCompare(a.date));}
function stockSignal(name){
 const h=bestHistory(name);if(!h.length)return {status:'unknown',label:'Noch keine Kaufdaten',detail:'Ohne Kassenbon lässt sich kein Vorrat schätzen.'};
 const distinct=[...new Set(h.map(x=>x.date))].sort();const latest=distinct.at(-1);const age=days(iso(),latest);
 if(distinct.length<3)return {status:'unknown',label:'Noch zu wenig Daten',detail:`Letzter Kauf vor ${age} Tagen. Mindestens drei Einkaufszeitpunkte helfen für eine Intervallschätzung.`};
 const diffs=distinct.slice(1).map((x,i)=>days(x,distinct[i])).filter(x=>x>0).sort((a,b)=>a-b);
 const median=diffs[Math.floor(diffs.length/2)];if(!median)return {status:'unknown',label:'Noch zu wenig Daten',detail:'Mehr unterschiedliche Einkaufstage erforderlich.'};
 const freshness=/milch|joghurt|quark|salat|beeren|brot|banane|fleisch|fisch/i.test(name);
 if(freshness)return {status:'check',label:'Bitte selbst prüfen',detail:`Letzter Kauf vor ${age} Tagen. Frische und Haltbarkeit sind unbekannt.`};
 const ratio=age/median;const status=ratio<0.65?'likely':ratio>1.25?'check':'check';
 return {status,label:status==='likely'?'Vermutlich noch vorhanden':'Vermutlich bald benötigt',detail:`Letzter Kauf vor ${age} Tagen · beobachteter Kaufabstand ungefähr ${median} Tage. Keine genaue Bestandsmessung.`};
}
function scoreOffer(o){
 const normal=Number(o.reference),price=Number(o.price);if(!(price>0&&normal>price))return null;
 if(o.until&&o.until<iso())return null;
 if(o.store==='Lidl'&&!/wasser|mineralwasser/i.test(o.name))return null;
 if(!['ALDI Süd','Lidl'].includes(o.store))return null;
 if(!relevantName(o.name))return null;
 const saving=normal-price,pct=saving/normal;
 if(pct<0.10||saving<0.20)return null;
 const history=bestHistory(o.name);const signal=stockSignal(o.name);
 return {...o,saving,pct,signal,historyCount:history.length};
}
function collectReport(){const list=purchases();const last90=list.filter(x=>days(iso(),x.date)<=90);const total=state.receipts.reduce((sum,r)=>sum+(r.items||[]).reduce((s,x)=>s+Number(x.price||0),0),0);const labels=[...new Map(last90.map(x=>[normalize(x.name),x])).values()];return {list,last90,total,labels};}
function renderIntelligence(){ensure();const rep=collectReport(),target=$v('#intelligence-root');if(!target)return;
 const offers=state.offers.map(scoreOffer).filter(Boolean).sort((a,b)=>b.pct-a.pct).slice(0,5);
 const stock=state.catalog.filter(c=>c.active!==false).map(c=>({name:c.name,signal:stockSignal(c.name)}));
 const confident=stock.filter(x=>x.signal.status!=='unknown');
 target.innerHTML=`
 <div class="v6-stat-grid"><div class="surface v6-stat"><strong>${state.receipts.length}</strong><span>Erfasste Kassenbons</span></div><div class="surface v6-stat"><strong>${rep.labels.length}</strong><span>Produkte in 90 Tagen</span></div><div class="surface v6-stat"><strong>${money(rep.total)}</strong><span>Erfasster Einkaufswert</span></div></div>
 <div class="v6-columns"><div class="surface box"><div class="section-title"><h2>Kassenbon einlesen</h2></div><p class="sub">Foto vom ALDI- oder Lidl-Bon aufnehmen oder erkannten Bon-Text einfügen. Alle Zeilen vor dem Speichern kontrollieren.</p>
 <label class="v6-label">Geschäft<select class="field" id="v6-store"><option>ALDI Süd</option><option>Lidl</option><option>Anderes Geschäft</option></select></label>
 <label class="v6-label">Einkaufsdatum<input type="date" class="field" id="v6-date" value="${iso()}"></label>
 <label class="v6-label">Bon-Foto (optional)<input class="field" type="file" id="v6-photo" accept="image/*" capture="environment"></label>
 <button class="btn ghost" id="v6-ocr" type="button">Text aus Foto erkennen</button><p class="sub" id="v6-ocr-note">Foto-Erkennung lädt bei Bedarf eine OCR-Bibliothek. Verarbeitung lokal im Browser; Internet für die Erstladung erforderlich.</p>
 <label class="v6-label">Erkannter Bon-Text<textarea id="v6-text" class="field v6-textarea" placeholder="MILCH 1,19&#10;BIO NUDELN 1,49&#10;KAFFEE 5,99"></textarea></label>
 <div class="buttonrow"><button class="btn" id="v6-parse" type="button">Positionen prüfen</button><button class="btn ghost" id="v6-example" type="button">Beispiel</button></div>
 <div id="v6-preview" aria-live="polite"></div></div>
 <div class="surface box"><h2>Vorratsradar</h2><p class="sub">Nur Schätzungen aus euren echten Kassenbons. Nichts wird automatisch von der Einkaufsliste entfernt.</p>
 ${confident.length?`<div class="v6-stock-list">${confident.slice(0,12).map(x=>`<div class="v6-stock"><div><b>${escV(x.name)}</b><small>${escV(x.signal.detail)}</small></div><span class="v6-pill ${x.signal.status}">${escV(x.signal.label)}</span></div>`).join('')}</div>`:'<p class="v6-empty">Nach mehreren Einkäufen entstehen hier vorsichtige Prognosen. Bis dahin bleibt eure vollständige Checkliste maßgeblich.</p>'}
 <h3 style="margin-top:22px">Letzte Kassenbons</h3>${state.receipts.slice().reverse().slice(0,6).map(r=>`<div class="v6-history"><div><strong>${escV(r.store)}</strong><small>${escV(r.date)} · ${r.items.length} Positionen</small></div><button class="btn ghost tiny" data-v6-delete="${escV(r.id)}" type="button">Löschen</button></div>`).join('')||'<p class="sub">Noch keine Einkäufe gespeichert.</p>'}</div></div>
 <div class="surface box v6-offers"><div class="section-title"><h2>Nur relevante Angebote</h2></div><p class="sub">Kein Werbe-Feed. ALDI Süd zuerst; Lidl nur Wasser. Vorschläge erscheinen ausschließlich für bekannte Produkte mit mindestens 10 % und 0,20 € Vergleichsersparnis. Preise werden nicht automatisch aus dem Internet geladen.</p>
 ${offers.length?offers.map(o=>`<div class="v6-offer"><div><span class="v6-pill">${escV(o.store)}</span><strong>${escV(o.name)}</strong><small>${escV(o.signal.label)} · ${(o.pct*100).toFixed(0)} % unter Referenzpreis</small></div><div class="v6-price">${money(o.price)}<small>statt ${money(o.reference)}</small></div></div>`).join(''):'<div class="v6-empty">Aktuell keine passenden geprüften Angebote. Hier wird bewusst nichts beworben.</div>'}
 <details style="margin-top:18px"><summary>Eigene Angebotsdaten einlesen (Testbetrieb)</summary><p class="sub" style="margin:12px 0">Ein Angebot je Zeile: <code>Produkt;Angebotspreis;üblicher Preis;ALDI Süd;2026-11-14</code>. Ohne bestätigte Vergleichspreise wird nichts empfohlen.</p>
 <textarea id="v6-offer-input" class="field v6-textarea" placeholder="Kaffee;5,49;8,99;ALDI Süd;2026-11-14"></textarea><div class="buttonrow"><button class="btn" id="v6-save-offers" type="button">Angebote übernehmen</button><button class="btn ghost" id="v6-clear-offers" type="button">Angebote löschen</button></div><small class="sub">Manuell eingetragene Angebotsdaten sind keine aktuellen Händlerpreise.</small></details></div>
 <p class="sub v6-note">Datenschutz: Kaufdaten bleiben lokal, solange Supabase nicht konfiguriert ist. Fotos werden nicht dauerhaft gespeichert. Bei eingerichteter Supabase-Verbindung können Kassenbon-Datensätze mit dem Haushaltszustand synchronisiert werden.</p>`;
}
let staging=[];
function previewRows(){const target=$v('#v6-preview');if(!target)return;target.innerHTML=staging.length?`<div class="v6-preview"><h3>${staging.length} Positionen erkannt – bitte prüfen</h3><div class="v6-rows">${staging.map((x,i)=>`<div class="v6-entry"><input class="field" data-receipt-name="${i}" value="${escV(x.name)}" aria-label="Produktname"><input type="number" step="1" min="1" class="field" data-receipt-qty="${i}" value="${x.qty}" aria-label="Menge"><input class="field" data-receipt-price="${i}" value="${String(x.price).replace('.',',')}" aria-label="Gesamtpreis in Euro"><button class="btn ghost tiny" data-receipt-remove="${i}" type="button" aria-label="Position entfernen">✕</button></div>`).join('')}</div><p class="sub">Preise sind Positionsgesamtpreise, nicht Stückpreise. Unbekannte OCR-Zeilen fehlen möglicherweise.</p><button class="btn" id="v6-confirm" type="button">${staging.length} Positionen speichern</button></div>`:'<p class="sub">Keine Produktpositionen erkannt. Verwende „Produkt 1,29“ je Zeile oder korrigiere den Bon-Text.</p>';
}
function parseOffers(text){const result=[];const errors=[];String(text||'').split(/\r?\n/).forEach((line,index)=>{if(!line.trim())return;const parts=line.split(';').map(x=>x.trim());const [name,p,r,store,until]=parts;const price=euro(p),reference=euro(r);if(!name||!(price>0)||!(reference>price)||!['ALDI Süd','Lidl'].includes(store)||!/^\d{4}-\d{2}-\d{2}$/.test(until||'')){errors.push(index+1);return}result.push({id:uid(),name,price,reference,store,until});});return {result,errors}}
function loadOcr(){return new Promise((resolve,reject)=>{if(window.Tesseract)return resolve(window.Tesseract);const el=document.createElement('script');el.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';el.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('OCR nicht verfügbar'));el.onerror=()=>reject(Error('OCR-Bibliothek konnte nicht geladen werden'));document.head.append(el)})}
async function ocrPhoto(){const f=$v('#v6-photo').files[0];if(!f){toast('Zuerst ein Bon-Foto auswählen');return}if(f.size>15*1024*1024){toast('Das Foto darf höchstens 15 MB groß sein');return}const btn=$v('#v6-ocr');btn.disabled=true;$v('#v6-ocr-note').textContent='Texterkennung läuft lokal im Browser …';try{const t=await loadOcr(),worker=await t.createWorker('deu');try{const result=await worker.recognize(f);$v('#v6-text').value=result.data.text||'';$v('#v6-ocr-note').textContent='Text erkannt. Bitte korrigieren und Positionen prüfen.';}finally{await worker.terminate()}}catch(e){$v('#v6-ocr-note').textContent='Texterkennung nicht verfügbar: '+e.message+'. Bon-Text kann weiterhin eingefügt werden.'}finally{btn.disabled=false}}
const originalRender=render;
render=function(...args){originalRender(...args);renderIntelligence()};
const originalNavigate=navigate;
navigate=function(v,sub){if(v==='intelligenz'){view=v;history.replaceState(null,'','#'+v);document.querySelectorAll('.view').forEach(e=>e.classList.toggle('active',e.id==='view-intelligenz'));document.querySelectorAll('[data-view]').forEach(el=>{if(el.tagName==='BUTTON')el.classList.toggle('active',el.dataset.view===v)});renderIntelligence();window.scrollTo({top:0,behavior:'instant'});return}originalNavigate(v,sub)};
// Original router rejects unknown views; intercept tab navigation before it reaches its delegated handler.
document.addEventListener('click',e=>{const b=e.target.closest('[data-view="intelligenz"]');if(b){e.stopImmediatePropagation();navigate('intelligenz')}},true);
document.addEventListener('click',async e=>{
 const btn=e.target.closest('button');if(!btn)return;
 if(btn.id==='v6-example'){$v('#v6-text').value='MILCH 1,19\nBIO NUDELN 1,49\nKAFFEE 5,99\nSUMME 8,67';return}
 if(btn.id==='v6-parse'){staging=parseReceipt($v('#v6-text').value);previewRows();return}
 if(btn.hasAttribute('data-receipt-remove')){staging.splice(Number(btn.dataset.receiptRemove),1);previewRows();return}
 if(btn.id==='v6-ocr'){await ocrPhoto();return}
 if(btn.id==='v6-confirm'){
  staging=staging.map((x,i)=>({...x,name:$v(`[data-receipt-name="${i}"]`)?.value.trim()||'',qty:Number($v(`[data-receipt-qty="${i}"]`)?.value),price:euro($v(`[data-receipt-price="${i}"]`)?.value)})).filter(x=>x.name&&x.qty>0&&x.price>0);
  if(!staging.length){toast('Keine gültigen Positionen');return}
  const store=$v('#v6-store').value,date=$v('#v6-date').value;if(!date){toast('Datum fehlt');return}
  mutate(()=>{ensure();state.receipts.push({id:uid(),date,store,items:structuredClone(staging),createdAt:new Date().toISOString()})},'Kassenbon gespeichert');staging=[];renderIntelligence();return;
 }
 if(btn.hasAttribute('data-v6-delete')){if(!confirm('Diesen Kassenbon dauerhaft löschen?'))return;mutate(()=>{state.receipts=state.receipts.filter(x=>x.id!==btn.dataset.v6Delete)},'Bon gelöscht');return}
 if(btn.id==='v6-save-offers'){const {result,errors}=parseOffers($v('#v6-offer-input').value);if(errors.length){toast('Ungültige Angebotszeilen: '+errors.join(', '));return}if(!result.length){toast('Keine Angebote erkannt');return}mutate(()=>{state.offers=[...result]},result.length+' Angebote eingelesen');return}
 if(btn.id==='v6-clear-offers'){if(!confirm('Alle manuell eingetragenen Angebote löschen?'))return;mutate(()=>{state.offers=[]},'Angebote gelöscht');return}
});
window.WochenkorbIntelligence={parseReceipt,parseOffers,stockSignal,scoreOffer,render:renderIntelligence};
if(location.hash==='#intelligenz')navigate('intelligenz');else renderIntelligence();
})();
