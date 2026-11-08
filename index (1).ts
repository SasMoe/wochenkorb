// Read-only ALDI Süd product search. Unofficial and may fail when the store changes its API.
// dm and Lidl are intentionally linked to their official offer pages instead of scraped.
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'};
const numeric=(raw:string)=>{const match=raw.replace(/\s/g,'').match(/(\d+(?:[.,]\d{1,2})?)/);return match?Number(match[1].replace(',','.')):0;};
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST erforderlich'}),{status:405,headers:cors});
  try{
    const body=await req.json();if(body.store!=='aldi-sued'||typeof body.query!=='string'||body.query.trim().length<2||body.query.length>60)throw Error('Ungültige ALDI-Suche');
    const params=new URLSearchParams({serviceType:'walk-in',servicePoint:'B384',currency:'EUR',limit:'30',offset:'0',sort:'relevance',q:body.query.trim()});
    const response=await fetch('https://api.aldi-sued.de/v3/product-search?'+params,{signal:AbortSignal.timeout(9000)});
    if(!response.ok)throw Error('ALDI-Schnittstelle HTTP '+response.status);
    const data=await response.json();if(!Array.isArray(data?.data))throw Error('ALDI-Antwortformat wurde geändert');
    const products=data.data.slice(0,30).map((p:Record<string,unknown>)=>{
      const price=p.price as Record<string,unknown>||{},amount=Number(price.amountRelevant??price.amount??0)/100;
      const wasPriceLabel=String(price.wasPriceDisplay||'');
      return {name:String(p.name||'').slice(0,130),brand:String(p.brandName||'').slice(0,80),price:amount,priceLabel:String(price.amountRelevantDisplay||amount.toFixed(2)+' €'),wasPrice:numeric(wasPriceLabel),wasPriceLabel,sku:String(p.sku||'')};
    }).filter(p=>p.name&&p.price>0);
    return new Response(JSON.stringify({products,source:'ALDI Süd öffentliches Produktsystem',checkedAt:new Date().toISOString(),note:'Unverbindlicher Onlinepreis, Filialbestand unbekannt'}),{headers:{...cors,'Cache-Control':'private, max-age=300'}});
  }catch(err){return new Response(JSON.stringify({error:err instanceof Error?err.message:'Abfrage nicht möglich'}),{status:502,headers:cors});}
});
