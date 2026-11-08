/* Wochenkorb V8.2 – pure, testable market matching and recommendation rules.
   Never infer a discount from a shelf price. Never auto-add products to the list. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  root.WochenkorbMarketsCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const stores=['Lidl','ALDI Süd','dm'];
  const links={
    'Lidl':'https://www.lidl.de/c/online-prospekte/s10005610',
    'ALDI Süd':'https://www.aldi-sued.de/angebote',
    'dm':'https://www.dm.de/neu/aktionen'
  };
  const normalize = s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
  const aliases={
    'mineralwasser':'wasser','sprudelwasser':'wasser','wasser':'wasser','stilles wasser':'wasser',
    'toilettenpapier':'klopapier','klopapier':'klopapier',
    'rispentomaten':'tomaten','rispentomate':'tomaten','tomate':'tomaten','tomaten':'tomaten',
    'karotten':'karotten','moehren':'karotten','mohren':'karotten','mohre':'karotten',
    'ei':'eier','eier':'eier','haferdrink':'hafermilch','hafermilch':'hafermilch'
  };
  const taboo=new Set(['bio','frisch','extra','premium','aldi','lidl','dm','der','die','das','und','mit','ohne','von','aus','des','dem','fur','fuer','ab','zu','g','kg','ml','l','stk','x','pack','stuck','stueck','statt']);
  const cut=s=>normalize(s).split(' ').filter(x=>x.length>1&&!taboo.has(x)&&!/^\d+$/.test(x));
  function identity(name){
    const n=normalize(name);
    // These forms are deliberately separated even when 'tomaten' is present.
    if(/tomat/.test(n)){
      if(/mark/.test(n))return 'tomatenmark';
      if(/passiert/.test(n))return 'passierte tomaten';
      if(/stuckig|stueckig|gehackt|dose|konserv|dosentomaten/.test(n))return 'stuckige dosentomaten';
      if(/cherry|cocktail/.test(n))return 'cherrytomaten';
      if(/getrocknet/.test(n))return 'getrocknete tomaten';
      return 'tomaten';
    }
    if(/milch/.test(n)){
      if(/hafer|oat/.test(n))return 'hafermilch';
      if(/mandel/.test(n))return 'mandelmilch';
      if(/laktosefrei/.test(n))return 'laktosefreie milch';
    }
    if(aliases[n])return aliases[n];
    return n;
  }
  function matchScore(item,product){
    const name=String(item?.name||item||''),title=String(product?.name||product?.title||'');
    if(!name||!title)return 0;
    const a=identity(name),b=identity(title),productNorm=normalize(title);
    const protectedTypes=['tomatenmark','passierte tomaten','stuckige dosentomaten','cherrytomaten','getrocknete tomaten','tomaten','hafermilch','mandelmilch','laktosefreie milch'];
    if(protectedTypes.includes(a)){
      const reverse=identity(title);
      if(reverse!==a)return 0;
    }
    if(a===b)return 100;
    // Multi-token catalogue names must match all distinguishing words.
    let tokens=cut(name).map(t=>aliases[t]||t).filter(x=>x.length>2);
    if(!tokens.length)return 0;
    const titleTokens=new Set(cut(title).map(t=>aliases[t]||t));
    const present=tokens.filter(t=>titleTokens.has(t));
    if(present.length!==tokens.length)return 0;
    if(tokens.length===1&&tokens[0].length<4)return 0;
    // A single generic word does not justify an unrelated product family.
    if(tokens.length===1 && /^wasser$/.test(tokens[0]) && !/wasser/.test(productNorm))return 0;
    return tokens.length>1?82:65;
  }
  function isValidDiscount(p){
    const price=Number(p?.price),reference=Number(p?.wasPrice);
    return price>0&&Number.isFinite(price)&&reference>price&&((reference-price)/reference)>=0.10&&(reference-price)>=0.20;
  }
  function hasCurrentValidity(p,date){
    const today=date||new Date().toISOString().slice(0,10);
    return (!p?.until||String(p.until).slice(0,10)>=today) && (!p?.starts||String(p.starts).slice(0,10)<=today);
  }
  function catalogItems(state){return Array.isArray(state.catalog)?state.catalog:[];}
  function listItems(state){return Array.isArray(state.shopping?.items)?state.shopping.items:[];}
  function purchaseFrequency(state){
    const counts=new Map();
    for(const r of state.receipts||[])for(const x of r.items||[]){const key=identity(x.name);if(!key)continue;const days=counts.get(key)||new Set();days.add(r.date);counts.set(key,days);}
    return counts;
  }
  function bestMatch(product,items){
    let max=0,best=null;
    for(const item of items){const score=matchScore(item,product);if(score>max){max=score;best=item;}}
    return max>=65?{item:best,score:max}:null;
  }
  function recommendations(state,products,{today,store}={}){
    const open=listItems(state).filter(i=>i.status==='open');
    const known=catalogItems(state).filter(i=>i.active!==false);
    const purchases=purchaseFrequency(state);
    const entries=[];const seen=new Set();
    for(const product of products||[]){
      const price=Number(product.price);if(!(price>0)||!hasCurrentValidity(product,today)||!product.name)continue;
      const matchedList=bestMatch(product,open), matchedCatalog=bestMatch(product,known);
      if(!matchedList&&!matchedCatalog)continue;
      const match=matchedList||matchedCatalog,kind=matchedList?'list':null;
      const history=(purchases.get(identity(match.item.name))||new Set()).size;
      // Off-list products must have credible savings AND an actual household relevance.
      if(!kind&&(!isValidDiscount(product)||!(match.item.kind==='stamm'||history>=2)))continue;
      const category=kind?'list':(history>=3?'stock':'relevant');
      const key=identity(match.item.name);
      if(seen.has(key)){
        const prev=entries.find(e=>e.key===key);
        if(prev&&isValidDiscount(product)&&!isValidDiscount(prev.product))prev.product=product;
        continue;
      }
      seen.add(key);
      entries.push({key,category,product,item:match.item,score:match.score,history,discount:isValidDiscount(product),store});
    }
    const rank={list:0,stock:1,relevant:2};
    return entries.sort((a,b)=>rank[a.category]-rank[b.category]||Number(b.discount)-Number(a.discount)||b.score-a.score||a.item.name.localeCompare(b.item.name,'de')).slice(0,18);
  }
  function addItem(state,name,preferredStore){
    const clean=String(name||'').trim().slice(0,130);
    if(!clean)return false;
    const shopping=state.shopping;if(!shopping?.id)return false;
    if(listItems(state).some(x=>identity(x.name)===identity(clean)))return false;
    // A known Bedarf item becomes selected; otherwise append as one-off.
    const known=catalogItems(state).find(x=>identity(x.name)===identity(clean));
    if(known&&known.kind==='bedarf'){
      if(!Array.isArray(state.selected))state.selected=[];
      if(!state.selected.includes(known.id))state.selected.push(known.id);
    }else {
      // An inactive staple or an unknown product is added for this week only.
      if(!Array.isArray(state.oneOff))state.oneOff=[];
      if(!state.oneOff.some(x=>identity(x.name)===identity(clean)))state.oneOff.push({name:clean,amount:''});
    }
    // Preserve the user's existing store preference, even if a promo was spotted elsewhere.
    return true;
  }
  return {stores,links,normalize,identity,matchScore,isValidDiscount,hasCurrentValidity,recommendations,addItem};
});
