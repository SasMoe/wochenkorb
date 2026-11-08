from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html=(ROOT/'index.html').read_text()
for name in ['theme.css','intelligence.css','v7.css']:
    html=html.replace(f'<link rel="stylesheet" href="./{name}">',f'<style>{(ROOT/name).read_text()}</style>')
for name in ['intelligence.js','v7.js','config.js','cloud.js']:
    html=html.replace(f'<script src="./{name}"></script>',f'<script>{(ROOT/name).read_text()}</script>')
    html=html.replace(f'<script src="./{name}" defer></script>',f'<script>{(ROOT/name).read_text()}</script>')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':400,'height':850})
    errs=[]
    page.on('pageerror',lambda e: errs.append(str(e)))
    page.add_init_script("""
      const _memory = new Map();
      Object.defineProperty(window, 'localStorage', {configurable:true, value:{
      getItem:k=>_memory.has(k)?_memory.get(k):null,
      setItem:(k,v)=>_memory.set(k,String(v)),
      removeItem:k=>_memory.delete(k), clear:()=>_memory.clear()
      }});
    """)
    page.goto('about:blank')
    page.set_content(html,wait_until='domcontentloaded')
    page.locator('#localOnly').click()
    page.locator('[data-view="intelligenz"]').last.click()
    assert page.locator('#v7-stores').count()==1
    assert page.locator('#v7-stores a').count()==3
    page.locator('#navBottom [data-view="rezepte"]').click()
    page.evaluate('''() => {window.WochenkorbCloudClient={functions:{invoke: async (name,{body}) => ({data: name==='recipe-feed'?{recipes:[{title:'Kartoffelsuppe',description:'Mit Kartoffeln',source:'Chefkoch',url:'https://www.chefkoch.de/rezepte/123/kartoffelsuppe.html'}]}:{products:[{name:'Kaffee',price:5.49,wasPrice:8.99,priceLabel:'5,49 €',wasPriceLabel:'8,99 €'}]}})}};}''')
    page.evaluate("() => loadRemote()")
    page.wait_for_timeout(150)
    assert page.locator('#remoteRecipes').get_by_text('Kartoffelsuppe').count()==1,page.locator('#remoteMessage').inner_text()
    page.locator('[data-v7-import]').click()
    assert page.locator('#importDialog').is_visible()
    assert page.locator('#importForm [name="url"]').input_value().startswith('https://www.chefkoch.de/')
    page.locator('#importDialog [data-action="close-dialog"]').first.click()
    page.locator('[data-view="intelligenz"]').last.click()
    page.locator('#v7-aldi-query').fill('Kaffee')
    page.locator('#v7-aldi-load').click()
    page.wait_for_timeout(150)
    assert page.locator('#v7-aldi-result').get_by_text('Kaffee').count()==1,page.locator('#v7-aldi-result').inner_text()
    assert page.locator('#v7-stores').count()==1
    assert not errs,errs
    browser.close()
    print('PASS: V7 retailer panel, German feed, recipe import handoff, ALDI mock lookup, no page errors')
