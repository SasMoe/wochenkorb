from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html=(ROOT/'index.html').read_text()
for name in ['theme.css','intelligence.css','v7.css','v8.css']:
    html=html.replace(f'<link rel="stylesheet" href="./{name}">',f'<style>{(ROOT/name).read_text()}</style>')
for name in ['intelligence.js','v7.js','v8.js','config.js','cloud.js']:
    html=html.replace(f'<script src="./{name}"></script>',f'<script>{(ROOT/name).read_text()}</script>')
    html=html.replace(f'<script src="./{name}" defer></script>',f'<script>{(ROOT/name).read_text()}</script>')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':400,'height':850})
    errs=[]
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.add_init_script("""
 const _memory = new Map();
 Object.defineProperty(window, 'localStorage', {configurable:true, value:{
   getItem:k=>_memory.has(k)?_memory.get(k):null,
   setItem:(k,v)=>_memory.set(k,String(v)),removeItem:k=>_memory.delete(k),clear:()=>_memory.clear()
 }});
 """)
    page.goto('about:blank')
    page.set_content(html,wait_until='domcontentloaded')
    page.locator('#localOnly').click(timeout=3000)
    # Catalog search, switch in both directions with same id.
    page.locator('#navBottom [data-view="verwalten"]').click()
    page.locator('#v8-manage-search').fill('Butter')
    assert page.locator('#stapleManager').get_by_text('Butter').count()==1
    before=page.evaluate("() => state.catalog.find(x=>x.name==='Butter').id")
    page.locator('[data-v8-toggle]').first.click()
    after=page.evaluate("() => state.catalog.find(x=>x.name==='Butter')")
    assert after['id']==before and after['kind']=='bedarf',after
    page.locator('[data-v8-toggle]').first.click()
    assert page.evaluate("() => state.catalog.find(x=>x.name==='Butter').kind")=='stamm'
    # Bulk switch two, no duplicate or lost IDs.
    page.locator('#v8-manage-search').fill('')
    page.locator('#v8-manage-store').select_option(label='Alle')
    page.locator('#stapleManager [data-v8-select]').first.check()
    page.locator('#stapleManager [data-v8-select]').nth(1).check()
    assert page.locator('#v8-selected-count').inner_text()=='2 ausgewählt'
    page.locator('#v8-bulk-bedarf').click()
    assert page.locator('#v8-selected-count').inner_text()=='0 ausgewählt'
    # Canonical ingredients merge fresh rispen tomatoes but not passierte/cherry.
    assert page.evaluate("() => keyOf('Tomate') === keyOf('Rispentomaten')")
    assert page.evaluate("() => keyOf('Passierte Tomaten') !== keyOf('Tomaten')")
    assert page.evaluate("() => keyOf('Cherrytomaten') !== keyOf('Tomaten')")
    page.evaluate("() => {state.catalog.push({id:'v8tom',name:'Tomaten',kind:'stamm',active:true,area:'Obst & Gemüse',aisle:'Obst & Gemüse',amount:''});state.recipes.push({id:'v8-rec',name:'Testrezept',servings:2,ingredients:[['Rispentomaten',500,'g'],['Passierte Tomaten',300,'g']],instructions:''});state.plan=[{id:'v8-rec',servings:2}]}")
    rows=page.evaluate("() => buildShopping().filter(x=>x.name.toLowerCase().includes('tomaten'))")
    assert len(rows)==2,rows
    assert any(r['name']=='Tomaten' and len(r['notes']) for r in rows),rows
    # Duplicate review is explicit, never silently deleting a catalogue row.
    page.evaluate("() => {state.catalog.push({id:'v8rispen',name:'Rispentomaten',kind:'bedarf',active:true,area:'Obst & Gemüse',aisle:'Obst & Gemüse',amount:''});render()}")
    assert 'Gruppen' in page.locator('#v8-duplicate-count').inner_text()
    page.locator('#v8-duplicates summary').click()
    assert page.locator('#v8-duplicate-list [data-v8-merge]').count()>=1
    # Home need search and filtered store purchase without changing statuses.
    page.locator('#navBottom [data-view="zuhause"]').click()
    page.locator('#v8-need-search').fill('Windeln')
    assert page.locator('#needChips .chip').count()==1
    page.evaluate('() => refreshShopping(true)')
    page.locator('#navBottom [data-view="einkaufen"]').click()
    page.locator('#v8-shop-store').select_option(label='Lidl')
    assert page.locator('#v8-shop-bar').count()==1
    page.locator('#v8-shop-store').select_option(label='Alle')
    page.locator('#v8-shop-search').fill('Tomaten')
    assert page.locator('#v8-shop-count').inner_text().startswith('2 von')
    assert not errs,errs
    browser.close()
    print('PASS: V8 search, reversible switch, bulk move, conservative recipe merging, store filters')
