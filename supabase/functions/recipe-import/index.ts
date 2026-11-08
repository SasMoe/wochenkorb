/** Authenticated, SSRF-restricted import of public schema.org Recipe data.
 *  Deploy: supabase functions deploy recipe-import
 *  Supports a curated list of common recipe hosts; never scrapes arbitrary URLs.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors: Record<string,string>={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Content-Type':'application/json;charset=utf-8',
};
const domains=[
  'chefkoch.de','lecker.de','essen-und-trinken.de','einfachbacken.de',
  'eatsmarter.de','kuechengoetter.de','rewe.de','springlane.de',
  'allrecipes.com','bbcgoodfood.com','thekitchn.com','seriouseats.com',
  'schrotundkorn.de','gaumenfreundin.de','familienkost.de','emmikochteinfach.de',
  'sallys-blog.de','zuckerjagdwurst.com','eat.de','backenmachtgluecklich.de'
];
function isAllowed(raw:string):URL {
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Nur HTTPS-Rezeptlinks ohne Zugangsdaten sind erlaubt.');
  const host=url.hostname.toLowerCase();
  if(!domains.some(domain=>host===domain||host.endsWith('.'+domain)))throw Error('Diese Rezept-Website wird noch nicht unterstützt. Zutaten können alternativ als Text importiert werden.');
  return url;
}
function findRecipe(value:unknown, depth=0):Record<string,unknown>|null {
  if(depth>12||!value||typeof value!=='object')return null;
  if(Array.isArray(value)) { for(const child of value){const r=findRecipe(child,depth+1);if(r)return r;} return null; }
  const obj=value as Record<string,unknown>;
  const type=obj['@type'];
  if((Array.isArray(type)?type:[type]).some(t=>typeof t==='string'&&/^(?:https?:\/\/schema\.org\/)?Recipe$/i.test(t)))return obj;
  for(const [k,v] of Object.entries(obj)) {
    if(k==='publisher'||k==='author'||k==='image')continue;
    if(typeof v==='object'&&v){const found=findRecipe(v,depth+1);if(found)return found;}
  }
  return null;
}
function parseRecipe(html:string):Record<string,unknown>|null {
  const tags=html.matchAll(/<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script\s*>/ig);
  for(const m of tags){
    try {const found=findRecipe(JSON.parse(m[1].trim()));if(found)return found;}
    catch { /* Invalid JSON-LD block, try the next one. */ }
  }
  return null;
}
async function fetchLimited(raw:string):Promise<string> {
  let url=isAllowed(raw);
  for(let redirects=0;redirects<4;redirects++) {
    const res=await fetch(url,{redirect:'manual',headers:{'User-Agent':'Wochenkorb-Recipe-Importer/1.0 (+schema.org)','Accept':'text/html,application/xhtml+xml'}});
    if([301,302,303,307,308].includes(res.status)) {
      const location=res.headers.get('location');if(!location)throw Error('Weiterleitung ohne Ziel');
      url=isAllowed(new URL(location,url).toString());continue;
    }
    if(!res.ok)throw Error('Die Rezeptseite antwortete mit HTTP '+res.status);
    const type=res.headers.get('content-type')||'';
    if(!/text\/html|application\/xhtml\+xml/i.test(type))throw Error('Die URL liefert keine HTML-Rezeptseite.');
    if(Number(res.headers.get('content-length')||0)>2_000_000)throw Error('Rezeptseite ist zu groß.');
    if(!res.body)throw Error('Keine Antwort erhalten.');
    const reader=res.body.getReader();let total=0;const chunks:Uint8Array[]=[];
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      total+=value.byteLength;
      if(total>2_000_000){await reader.cancel();throw Error('Rezeptseite ist zu groß.');}
      chunks.push(value);
    }
    const joined=new Uint8Array(total);let offset=0;
    for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
    return new TextDecoder().decode(joined);
  }
  throw Error('Zu viele Weiterleitungen.');
}
function respond(data:unknown,status=200):Response {return new Response(JSON.stringify(data),{status,headers:cors});}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return respond({error:'Nur POST erlaubt'},405);
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return respond({error:'Anmeldung erforderlich'},401);
  const endpoint=Deno.env.get('SUPABASE_URL');
  const anonKey=Deno.env.get('SUPABASE_ANON_KEY');
  if(!endpoint||!anonKey)return respond({error:'Serverkonfiguration fehlt'},503);
  const db=createClient(endpoint,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await db.auth.getUser(auth.slice(7));
  if(authError||!user)return respond({error:'Anmeldung ungültig'},401);
  try {
    const {url}=await req.json();if(typeof url!=='string'||url.length>2000)throw Error('Ungültiger Rezeptlink');
    const html=await fetchLimited(url);
    const recipe=parseRecipe(html);
    if(!recipe||!recipe.name||!Array.isArray(recipe.recipeIngredient)||!recipe.recipeIngredient.length)
      throw Error('Keine vollständigen Schema.org-Rezeptdaten gefunden.');
    // Return only data required by the app, never remote HTML/scripts.
    return respond({recipe:{name:recipe.name,description:recipe.description,
      image:recipe.image,recipeYield:recipe.recipeYield,
      recipeIngredient:recipe.recipeIngredient,recipeInstructions:recipe.recipeInstructions}});
  } catch(e) {return respond({error:e instanceof Error?e.message:'Import fehlgeschlagen'},422);}
});
