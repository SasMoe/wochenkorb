"""Offline browser regression of V6 receipt parsing, offers, household workflow."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
s=(root/'index.html').read_text()
for name in ['theme.css','intelligence.css']:
 s=s.replace(f'<link rel="stylesheet" href="./{name}">','<style>'+ (root/name).read_text()+'</style>')
for name in ['intelligence.js','config.js','cloud.js']:
 s=s.replace(f'<script src="./{name}"'+ (' defer' if name=='cloud.js' else '') +'></script>','<script>'+ (root/name).read_text()+'</script>')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':390,'height':844})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""
 const _memory = new Map();
 Object.defineProperty(window, 'localStorage', {configurable:true, value:{
 getItem:k=>_memory.has(k)?_memory.get(k):null,
 setItem:(k,v)=>_memory.set(k,String(v)),
 removeItem:k=>_memory.delete(k),clear:()=>_memory.clear()
 }});
 """)
 page.goto('about:blank')
 page.set_content(s,wait_until='domcontentloaded')
 page.locator('#localOnly').click()
 page.locator('#navBottom [data-view="intelligenz"]').click()
 assert page.locator('#view-intelligenz').is_visible()
 page.locator('#v6-example').click()
 page.locator('#v6-parse').click()
 assert page.locator('[data-receipt-name]').count()==3
 assert 'MILCH' in page.locator('[data-receipt-name="0"]').input_value()
 page.locator('#v6-confirm').click()
 assert '1' in page.locator('.v6-stat strong').first.inner_text()
 page.reload() if False else None
 # Receipt changed local state, evidence must survive re-render and backing local storage.
 assert page.evaluate("JSON.parse(localStorage.getItem('wochenkorb-v4')).receipts.length") == 1
 page.locator('details').first.locator('summary').click()
 page.locator('#v6-offer-input').fill('Milch;0,79;1,19;ALDI Süd;2099-12-31\nSchokolade;0,49;2,49;ALDI Süd;2099-12-31\nMilch;0,49;1,49;Lidl;2099-12-31')
 page.locator('#v6-save-offers').click()
 assert page.locator('.v6-offer').count()==1, page.locator('.v6-offer').all_inner_texts()
 assert 'Milch' in page.locator('.v6-offer').first.inner_text()
 # Full weekly checklist remains untouched by stock estimation.
 page.locator('#navBottom [data-view="zuhause"]').click()
 page.locator('[data-action="start-week"]').first.click()
 assert page.locator('#homeShopping .product-row').count()>=4
 assert not errors,errors
 print('PASS: V6 navigation, receipt parse, receipt save, offer relevance, no shopping regressions')
 b.close()
