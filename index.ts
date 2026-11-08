// Wochenkorb V8.2 – read-only merchant gateway. No API keys or private user data
// sent to retailers, JWT verification required in Supabase configuration.
// Lidl Plus: public store offers scoped to one explicitly selected store.
// dm: publicly accessible (undocumented) product search; NOT an offer feed.
// ALDI Süd: existing product search retained for compatibility.
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
};
const cache=new Map();
const fail=(error,status=502)=>new Response(JSON.stringify({error:String(error||'Händler momentan nicht erreichbar').slice(0,300)}),{status,headers:cors});
const okay=(data)=>new Response(JSON.stringify({...data,checkedAt:new Date().toISOString()}),{headers:{...cors,'Cache-Control':'private, max-age=300'}});
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const str=(x,max=160)=>typeof x==='string'?x.trim().slice(0,max):'';
const dec=x=>{if(typeof x==='number')return Number.isFinite(x)?x:0;const s=String(x??'').trim();const m=s.replace(/\s/g,'').match(/\d+[.,]?\d*/);if(!m)return 0;return Number(m[0].replace(',','.'))||0;};
const positive=x=>Number.isFinite(Number(x))&&Number(x)>0?Number(x):0;
const safeUrl=(x,host)=>{try{const u=new URL(x,'https://www.'+host);return u.protocol==='https:'&&(u.hostname===host||u.hostname==='www.'+host)?u.href:'';}catch{return '';}};
async function requestJSON(url,headers={}){
  const reply=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{'Accept':'application/json',...headers}});
  if(!reply.ok)throw Error('Händler-API HTTP '+reply.status);
  const data=await reply.json();if(!data||typeof data!=='object')throw Error('Unerwartete Händlerantwort');return data;
}
async function cached(key,ttl,getter){const entry=cache.get(key);if(entry&&Date.now()-entry.at<ttl)return entry.data;const data=await getter();if(cache.size>80)cache.clear();cache.set(key,{at:Date.now(),data});return data;}
function aldiProduct(p){
  const price=obj(p.price),value=positive(Number(price.amountRelevant??price.amount??0)/100);
  const wasPriceLabel=str(price.wasPriceDisplay,80);
  return {name:str(p.name),brand:str(p.brandName,80),price:value,priceLabel:str(price.amountRelevantDisplay,40)||value.toFixed(2)+' €',wasPrice:dec(wasPriceLabel),wasPriceLabel,sku:str(p.sku,40),unitPrice:str(p.pricePerUnitDisplay||p.unitPriceDisplay,80),url:''};
}
async function aldi(query){
  const params=new URLSearchParams({serviceType:'walk-in',servicePoint:'B384',currency:'EUR',limit:'30',offset:'0',sort:'relevance',q:query});
  const data=await requestJSON('https://api.aldi-sued.de/v3/product-search?'+params);
  if(!Array.isArray(data.data))throw Error('ALDI-Antwortformat geändert');
  return {products:data.data.slice(0,30).map(aldiProduct).filter(p=>p.name&&p.price>0),store:'ALDI Süd',source:'ALDI öffentliches Produktsystem',priceType:'online',note:'Unverbindlicher Onlinepreis; Filialbestand unbekannt.'};
}
function dmProduct(x){
  const p=obj(x),meta=obj(p.product),prices=obj(p.price),localized=obj(p.priceInfo),priceRaw=p.priceLocalized||p.priceDisplay||prices.price||prices.value||p.price||p.salesPrice||p.currentPrice||localized.price||0;
  const number=positive(typeof priceRaw==='object'?(obj(priceRaw).value??obj(priceRaw).amount??obj(priceRaw).price??0):dec(priceRaw));
  const name=str(p.name||p.title||p.productName||meta.name||meta.title);
  const brand=str(p.brandName||p.brand||meta.brandName,90),sku=str(p.dan||p.sku||meta.dan,50);
  const url=safeUrl(p.url||p.productUrl||p.link||meta.url||'','dm.de');
  const unitPrice=str(p.unitPriceDisplay||p.basePriceLocalized||p.pricePerUnit||p.unitPrice||'',100);
  return {name,brand,price:number,priceLabel:number?number.toFixed(2)+' €':'',wasPrice:0,wasPriceLabel:'',sku,unitPrice,url};
}
async function dm(query){
  // Avoid dm.de/search (disallowed robots path). Public JSON search used by dm's site.
  const params=new URLSearchParams({query,pageSize:'20',currentPage:'0'});
  const data=await requestJSON('https://product-search.services.dmtech.com/de/search?'+params,{'Accept-Language':'de-DE'});
  const rows=Array.isArray(data.products)?data.products:Array.isArray(data.items)?data.items:Array.isArray(data.data?.products)?data.data.products:Array.isArray(data.results)?data.results:null;
  if(!rows)throw Error('dm-Suchformat geändert');
  const products=rows.slice(0,20).map(dmProduct).filter(p=>p.name);
  return {products,store:'dm',source:'dm öffentliches Produktsystem',priceType:'catalog',note:'dm-Sortimentspreise, nicht automatisch Sonderangebote; Filialverfügbarkeit ungeprüft.'};
}
const lidlHeaders={
  'Accept-Language':'de-DE','User-Agent':'LidlPlus/17.0.5 Android okhttp/4.12.0',
  'X-Client-Version':'17.0.5','X-Client-Platform':'android'
};
function lidlStore(x){
  const p=obj(x),key=str(p.storeKey||p.store_key,18);
  const label=[str(p.name,90),str(p.address,90),[str(p.postalCode||p.postal_code,10),str(p.locality,60)].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  return {key,label:label||key};
}
async function lidlStores(query){
  const params=new URLSearchParams({input:query,language:'de',latitude:'51.1634',longitude:'10.4477'});
  const data=await requestJSON('https://stores.lidlplus.com/api/v1/autocomplete/DE?'+params,lidlHeaders);
  const rows=Array.isArray(data)?data:Array.isArray(data.stores)?data.stores:Array.isArray(data.results)?data.results:null;
  if(!rows)throw Error('Lidl-Filialsuche nicht lesbar');
  return {stores:rows.slice(0,10).map(lidlStore).filter(s=>/^DE\d{3,7}$/i.test(s.key)),store:'Lidl',source:'Lidl Plus öffentliche Filialsuche'};
}
function lidlProduct(x){
  const p=obj(x),box=obj(p.priceBox),name=[str(p.brand,75),str(p.title,140)].filter(Boolean).join(' ');
  const current=positive(box.largePartNumeric??dec(box.largePartString));
  const previous=positive(box.smallPartNumeric??dec(box.smallPartString));
  const start=str(p.startValidityDate,40).slice(0,10),until=str(p.endValidityDate,40).slice(0,10);
  return {name:name||str(p.title||p.name),brand:str(p.brand,75),price:current,
    priceLabel:current?current.toFixed(2)+' €':'',wasPrice:previous>current?previous:0,
    wasPriceLabel:previous>current?previous.toFixed(2)+' €':'',unitPrice:str(p.pricePerUnit,100),
    starts:start,until,imageUrl:str(p.imageUrl,400),url:safeUrl(p.url||p.productUrl||'','lidl.de'),
    sku:str(p.id,45),offerType:str(p.offerType,80),discountText:str(box.discountMessage,80)};
}
async function lidlOffers(storeKey){
  const data=await requestJSON('https://offers.lidlplus.com/app/api/v4/DE/'+encodeURIComponent(storeKey)+'/offers',lidlHeaders);
  const rows=Array.isArray(data.offers)?data.offers:Array.isArray(data.data?.offers)?data.data.offers:null;
  if(!rows)throw Error('Lidl-Angebotsformat geändert');
  return {products:rows.slice(0,220).map(lidlProduct).filter(p=>p.name&&p.price>0),store:'Lidl',source:'Lidl Plus öffentliche Filialangebote',priceType:'in-store-offer',storeKey,
    note:'Filialangebote, nicht personalisierte Coupons; Aktionszeitraum und Lidl-Plus-Bedingungen prüfen.'};
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return fail('POST erforderlich',405);
  try{
    // Supabase Edge gateway verifies the signed-in user's JWT (verify_jwt: true).
    const body=obj(await req.json()),store=str(body.store,20),mode=str(body.mode,24)||'search';
    if(!['aldi-sued','dm','lidl'].includes(store))return fail('Unbekanntes Geschäft',400);
    if((store==='lidl'&&mode==='stores')||(store!=='lidl'&&mode==='search')){
      const query=str(body.query,61);if(query.length<2||query.length>60)return fail('Suchwort muss 2–60 Zeichen lang sein',400);
      const key=store+':'+mode+':'+query.toLowerCase();
      const data=await cached(key,15*60*1000,()=>store==='aldi-sued'?aldi(query):store==='dm'?dm(query):lidlStores(query));return okay(data);
    }
    if(store==='lidl'&&mode==='offers'){
      const key=str(body.storeKey,20);
      if(!/^DE\d{3,7}$/i.test(key))return fail('Bitte eine Lidl-Filiale wählen',400);
      return okay(await cached('lidl-offers:'+key,15*60*1000,()=>lidlOffers(key)));
    }
    return fail('Ungültige Händlersuche',400);
  }catch(err){return fail(err instanceof Error?err.message:'Händler momentan nicht erreichbar');}
});
