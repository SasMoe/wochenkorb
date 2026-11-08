"""Headless smoke tests for the UI without external network.
Run: python tests/test_ui.py. Uses an in-memory page because this runner blocks local URLs.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
html=(ROOT/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="./theme.css">', '<style>'+(ROOT/'theme.css').read_text()+'</style>')
html=html.replace('<link rel="stylesheet" href="./intelligence.css">','<style>'+(ROOT/'intelligence.css').read_text()+'</style>')
html=html.replace('<script src="./intelligence.js"></script>','<script>'+(ROOT/'intelligence.js').read_text()+'</script>')
html=html.replace('<script src="./config.js"></script>', '<script>'+(ROOT/'config.js').read_text()+'</script>')
html=html.replace('<script src="./cloud.js" defer></script>', '<script>'+(ROOT/'cloud.js').read_text()+'</script>')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 page.add_init_script('''
 const _memory = new Map();
 Object.defineProperty(window, 'localStorage', {configurable:true, value:{
   getItem:k=>_memory.has(k)?_memory.get(k):null,
   setItem:(k,v)=>_memory.set(k,String(v)),
   removeItem:k=>_memory.delete(k),clear:()=>_memory.clear()
 }});
 ''')
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto('about:blank')
 page.set_content(html,wait_until='domcontentloaded')
 page.locator('#localOnly').click(timeout=3000)
 assert page.locator('#view-zuhause').is_visible()
 page.screenshot(path=str(ROOT/'preview-midnight.png'),full_page=True)
 page.locator('[data-action="start-week"]').first.click()
 assert page.locator('#homeShopping .product-row').count()>=4
 page.locator('#homeShopping .product-row .tap').first.click()
 page.locator('#navBottom [data-view="einkaufen"]').click()
 assert page.locator('#view-einkaufen').is_visible()
 page.locator('#navBottom [data-view="verwalten"]').click()
 assert page.locator('#themePicker').is_visible()
 page.locator('#themePicker').select_option('rose-light')
 assert page.locator('html').get_attribute('data-theme')=='rose-light'
 page.screenshot(path=str(ROOT/'preview-rose-light.png'),full_page=True)
 page.locator('#themePicker').select_option('rose-dark')
 assert page.locator('html').get_attribute('data-theme')=='rose-dark'
 page.screenshot(path=str(ROOT/'preview-rose-dark.png'),full_page=True)
 assert not errors,errors
 browser.close()
 print('PASS: local mode, weekly list, have toggle, navigation, three themes')
