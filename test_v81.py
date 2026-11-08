from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
html=(ROOT/'index.html').read_text()
for name in ['theme.css','intelligence.css','v7.css','v8.css']:
    html=html.replace(f'<link rel="stylesheet" href="./{name}">',f'<style>{(ROOT/name).read_text()}</style>')
for name in ['intelligence.js','v7.js','v8.js','config.js','cloud.js']:
    html=html.replace(f'<script src="./{name}"></script>',f'<script>{(ROOT/name).read_text()}</script>')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='domcontentloaded')
    categories={
      'kl. Dose/n Tomaten, stückige (ca. 400 g)':('Speisekammer','Konserven'),
      'Stückige Tomaten (Dose)':('Speisekammer','Konserven'),
      'Passierte Tomaten':('Speisekammer','Konserven'),
      'Tomatenmark':('Speisekammer','Konserven'),
      '2 Dosen Mais':('Speisekammer','Konserven'),
      'TK Brokkoli':('Gefrierschrank','Tiefkühl'),
      'Tiefgefrorener Spinat':('Gefrierschrank','Tiefkühl'),
      'Frische Tomaten':('Obst & Gemüse','Obst & Gemüse'),
      'Rispentomaten':('Obst & Gemüse','Obst & Gemüse'),
      'Cherrytomaten':('Obst & Gemüse','Obst & Gemüse'),
      'Brokkoli':('Obst & Gemüse','Obst & Gemüse')
    }
    for name,expected in categories.items():
        result=page.evaluate('(name)=>guessCategories(name)',name)
        assert (result['area'],result['aisle'])==expected,(name,result,expected)
    expected=('Stückige Tomaten (Dose)',400,'g')
    for original in ['kl. Dose/n Tomaten, stückige (ca. 400 g)','1 kl. Dose/n Tomaten, stückige (ca. 400 g)']:
        v=page.evaluate('(name)=>parseIngredientLine(name)',original)
        assert tuple(v)==expected,(original,v)
    v=page.evaluate("() => parseIngredientLine('2 Dosen Tomaten, gehackte (400 g)')")
    assert v==['Gehackte Tomaten (Dose)',800,'g'],v
    v=page.evaluate('''() => {state.plan=[{id:'oldimport',servings:2}];state.recipes.push({id:'oldimport',name:'Altimport',servings:2,ingredients:[['kl. Dose/n Tomaten, stückige (ca. 400 g)',1,'Stk']],instructions:''});return buildShopping().filter(x=>x.name.includes('Tomaten'))}''')
    assert any(x['name']=='Stückige Tomaten (Dose)' and x['aisle']=='Konserven' and any('400 g' in note for note in x['notes']) for x in v),v
    assert not errors,errors
    browser.close()
print('PASS: Produktform, Dosentomaten, Mengen, Altimporte und getrennte Frische-/TK-Kategorien')
