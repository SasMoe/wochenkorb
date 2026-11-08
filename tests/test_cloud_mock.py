"""Mock-only client integration smoke test. Does not replace a live Supabase test."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html=(ROOT/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="./theme.css">','<style>'+(ROOT/'theme.css').read_text()+'</style>')
html=html.replace('<script src="./config.js"></script>','''<script>
window.WOCHENKORB_CONFIG={supabaseUrl:'https://test123.supabase.co',supabasePublishableKey:'sb_publishable_TEST'};
window.__calls=[];
const mock={auth:{getSession:async()=>({data:{session:{access_token:'fake'}}}),getUser:async()=>({data:{user:{id:'u1',email:'user@test.de'}}}),onAuthStateChange:()=>{},signOut:async()=>({})},
 from(table){return {select(){return this},eq(){return this},then(resolve){resolve({data:[],error:null})},maybeSingle:async()=>({data:table==='household_members'?{household_id:'h1',role:'owner'}:{theme:'rose-light'},error:null}),single:async()=>({data:{content:defaultState(),revision:0},error:null}),upsert:async(rows)=>{window.__calls.push({table,rows});return {error:null}}}},
 rpc:async(name,args)=>{window.__calls.push({name,args});return {data:1,error:null}},
 channel(){return {on(){return this},subscribe(){return this}}},removeChannel:async()=>{} };
window.supabase={createClient:()=>mock};
</script>''')
html=html.replace('<script src="./cloud.js" defer></script>','<script>'+(ROOT/'cloud.js').read_text()+'</script>')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''const _memory=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>_memory.has(k)?_memory.get(k):null,setItem:(k,v)=>_memory.set(k,String(v)),removeItem:k=>_memory.delete(k),clear:()=>_memory.clear()}});''')
 page.goto('about:blank');page.set_content(html,wait_until='domcontentloaded')
 try:
  page.wait_for_function("!document.getElementById('authGate').classList.contains('visible') && document.querySelector('#accountInfo').textContent.includes('user@test.de')",timeout=4000)
 except Exception as ex:
  print('ERRORS',errors,'AUTH',page.locator('#authMessage').inner_text(),'STATE',page.locator('#cloudStatus').inner_text(),'INFO',page.locator('#accountInfo').inner_text());raise
 assert page.locator('html').get_attribute('data-theme')=='rose-light'
 page.locator('[data-action="start-week"]').first.click()
 page.wait_for_timeout(900)
 calls=page.evaluate('window.__calls')
 assert any(c.get('name')=='save_household_state' for c in calls),calls
 page.locator('#homeShopping .product-row .tap').first.click()
 page.wait_for_timeout(100)
 calls=page.evaluate('window.__calls')
 assert any(c.get('table')=='item_statuses' for c in calls),calls
 assert not errors,errors
 browser.close()
 print('PASS: mock auth, household loading, preference, cloud document save, status upsert')
