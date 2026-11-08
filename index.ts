// A small read-only German recipe inspiration feed. Source: Chefkoch public RSS.
// The function is deliberately limited to one hard-coded public RSS URL.
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'};
const decode = (str: string) => String(str).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(\d+);|&#x([0-9a-f]+);/gi,(x,dec,hex)=>({ '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' ' }[x] ?? (dec?String.fromCodePoint(Number(dec)):hex?String.fromCodePoint(parseInt(hex,16)):x)));
const value = (xml:string,tag:string) => decode(xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]||'').trim();
const text = (s:string) => decode(s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')).trim();
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST erforderlich'}),{status:405,headers:cors});
  try{
    const response=await fetch('https://www.chefkoch.de/recipe-of-the-day/rss',{headers:{'Accept':'application/rss+xml, application/xml, text/xml'},signal:AbortSignal.timeout(9000)});
    if(!response.ok)throw Error('Chefkoch RSS meldet HTTP '+response.status);
    const xml=await response.text();if(xml.length>1_000_000)throw Error('RSS-Antwort zu groß');
    const recipes=[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,24).map(m=>{
      const item=m[1],url=value(item,'link'),title=text(value(item,'title'));
      const image=item.match(/<enclosure[^>]*\burl="([^"]+)"/i)?.[1]||item.match(/<media:content[^>]*\burl="([^"]+)"/i)?.[1]||'';
      return {title:title.slice(0,160),url,description:text(value(item,'description')).slice(0,220),image:image.startsWith('https://')?image:'',source:'Chefkoch'};
    }).filter(r=>{try{return r.title&&new URL(r.url).hostname.endsWith('.chefkoch.de')}catch{return false}}).slice(0,18);
    return new Response(JSON.stringify({recipes,updatedAt:new Date().toISOString()}),{headers:{...cors,'Cache-Control':'public, max-age=900'}});
  }catch(err){return new Response(JSON.stringify({error:err instanceof Error?err.message:'RSS nicht erreichbar'}),{status:502,headers:cors});}
});
