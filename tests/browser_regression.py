"""Browser regressions for the standalone simulator; see tests/README.md."""
import argparse, hashlib, json, os, pathlib, shutil, sys, tempfile, urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--source',type=pathlib.Path,default=ROOT/'index.html')
parser.add_argument('--report',type=pathlib.Path)
parser.add_argument('--engine',choices=['chromium','firefox','webkit'],default='chromium')
parser.add_argument('--device',choices=['desktop','iphone','android'],default='desktop')
parser.add_argument('--only',default='',help='Comma-separated scenario names')
args=parser.parse_args()
SOURCE=args.source.resolve()
CDN=pathlib.Path(os.environ.get('HTML2CANVAS_PATH',str(pathlib.Path(tempfile.gettempdir())/'zzz-html2canvas-1.4.1.min.js')))
if not CDN.exists():
    with urllib.request.urlopen('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',timeout=30) as response:
        library=response.read()
    CDN.write_bytes(library)
assert hashlib.sha256(CDN.read_bytes()).hexdigest() == 'e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb', 'Unexpected html2canvas checksum'

BASELINE=pathlib.Path(tempfile.gettempdir())/'zzz-production-0478.html'
if not BASELINE.exists():
    url='https://raw.githubusercontent.com/zzzuserA/zzzteamsimulator/0478b3adf4aa4ef4880384968d61f019a5fb4989/index.html'
    with urllib.request.urlopen(url,timeout=30) as response:BASELINE.write_bytes(response.read())
assert hashlib.sha256(BASELINE.read_bytes()).hexdigest()=='1ec84ba1a65bab81ab6b025a5038816a3ebdc1d4f26fa51046bb1cfe1a2b5a0a'

FONT_DIR=pathlib.Path(tempfile.gettempdir())/'zzz-fonts'
FONT_DIR.mkdir(exist_ok=True)
for weight,name in [(500,'Medium'),(700,'Bold'),(900,'Black')]:
    font=FONT_DIR/f'{weight}.ttf'
    if not font.exists():
        url=f'https://raw.githubusercontent.com/google/fonts/main/ofl/zenkakugothicnew/ZenKakuGothicNew-{name}.ttf'
        with urllib.request.urlopen(url,timeout=30) as response:font.write_bytes(response.read())


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def handle(self):
        try:super().handle()
        except (BrokenPipeError,ConnectionResetError):pass

results=[]
def eq(actual, expected):
    assert actual==expected, f'expected {expected!r}, got {actual!r}'
def add_agent(page,name='検証エージェント'):
    page.locator('#addCharacter').click();page.locator('#chooseAgentAdd').click()
    page.locator('#newName').fill(name);page.locator('#newImage').set_input_files(ROOT/'image.agent/エージェント (1).webp');page.locator('#saveAdd').click()
    page.wait_for_timeout(100)
def add_boo(page,name='検証ボンプ'):
    page.locator('#addCharacter').click();page.locator('#chooseBangbooAdd').click()
    page.locator('#newBangbooName').fill(name);page.locator('#newBangbooImage').set_input_files(ROOT/'image.agent/エージェント (1).webp');page.locator('#saveBangbooAdd').click()
    page.wait_for_timeout(100)
def agent(page,i): page.locator(f'[data-agent="{i}"] strong').click()
def team(page,i): page.locator(f'[data-team="{i}"] .teamhead').click()
def group_persistence(p,d):
    p.locator('#addGroup').click();agent(p,0);p.reload();eq(p.locator('.team').count(),12);eq(p.locator('[data-slot="9,0"] strong').count(),1)
def reduced_group(p,d):
    agent(p,0);p.locator('#removeGroup').click();p.reload();eq(p.locator('.team').count(),6);eq(p.locator('[data-slot="0,0"] strong').count(),1)
def custom_boo(p,d):
    add_boo(p);p.reload();p.locator('#bangbooMode').click();eq(p.locator('[data-bangboo]').count(),42)
def cost_persistence(p,d):
    p.locator('#duplicateCostToggle').click();p.reload();eq(p.locator('#duplicateCostToggle').inner_text(),'重複分コスト除外:ON')
def delete_cancel(p,d):
    add_agent(p);add_boo(p);p.locator('[data-delete-custom-bangboo="0"]').click();p.locator('#cancelDelete').click()
    p.locator('#agentMode').click();p.locator('[data-delete-custom="0"]').click();p.locator('#confirmDelete').click()
    eq(p.evaluate('customAgents.length'),0);eq(p.evaluate('customBangboos.length'),1)
def duplicate_agent(p,d):
    name=p.locator('[data-agent="0"] strong').inner_text();add_agent(p,name);eq(p.evaluate('customAgents.length'),0)
def same_image(p,d):
    add_boo(p,'ボンプA');p.locator('[data-bangboo="0"] strong').click()
    add_boo(p,'ボンプB');p.locator('[data-bangboo="0"] strong').click()
    p.locator('[data-delete-custom-bangboo="0"]').click();p.locator('#confirmDelete').click()
    eq(p.locator('[data-bangboo-slot="0"] strong').inner_text(),'ボンプA')
def boo_group_confirm(p,d):
    team(p,8);p.locator('#bangbooMode').click();p.locator('[data-bangboo="0"] strong').click();p.locator('#removeGroup').click()
    eq(len(d),1);eq(p.locator('.team').count(),9)
def literal_agent(p,d):
    add_agent(p,'<b>テスト</b>');eq(p.locator('[data-agent="0"] strong').inner_text(),'<b>テスト</b>')
def literal_boo(p,d):
    add_boo(p,'<b>テスト</b>');eq(p.locator('[data-bangboo="0"] strong').inner_text(),'<b>テスト</b>')
def literal_weapon(p,d):
    p.locator('[data-conv="0"]').click();p.locator('#weaponName').fill('<b>音動機</b>');p.locator('#saveConv').click()
    eq(p.locator('[data-agent="0"] .meta2').inner_text(),'M0<b>音動機</b>W1')
def native_drag(p,d):
    agent(p,0);p.locator('[data-slot="0,0"]').drag_to(p.locator('[data-slot="0,1"]'))
    eq(p.locator('[data-slot="0,1"] strong').count(),1)
    p.locator('[data-slot="0,1"]').click();eq(p.locator('[data-slot="0,1"] strong').count(),0)
def pointer_cancel(p,d):
    agent(p,0)
    p.locator('[data-slot="0,0"]').scroll_into_view_if_needed()
    a=p.locator('[data-slot="0,0"]').bounding_box();b=p.locator('[data-slot="0,1"]').bounding_box()
    props={'pointerType':'touch','pointerId':7,'clientX':a['x']+10,'clientY':a['y']+10,'bubbles':True}
    p.locator('[data-slot="0,0"]').dispatch_event('pointerdown',props)
    props.update(clientX=b['x']+10,clientY=b['y']+10)
    p.locator('[data-slot="0,0"]').dispatch_event('pointermove',props)
    p.locator('[data-slot="0,0"]').dispatch_event('pointercancel',props)
    eq(p.locator('[data-slot="0,0"] strong').count(),1)
def export_retry(p,d):
    p.locator('#saveGroupImage').click()
    p.wait_for_function("document.getElementById('status').textContent.includes('読み込めません')")
    p.context._cdn_fail=False
    p.locator('#saveGroupImage').click()
    expect(p.locator('#groupImageModal')).to_have_class('modal show',timeout=3000)
def normal_features(p,d):
    eq(p.locator('[data-agent]').count(),62)
    p.locator('#search').fill('アンビー');eq(p.locator('[data-agent]').count(),2);p.locator('#search').fill('')
    p.locator('#rarity').select_option('A');assert p.locator('[data-agent]').count()>0
    assert all('A級' in x for x in p.locator('[data-agent] .meta').all_text_contents());p.locator('#rarity').select_option('all')
    agent(p,0);agent(p,1);agent(p,2);eq(p.locator('.team.active').get_attribute('data-team'),'1')
    p.locator('[data-conv="0"]').click();p.locator('#charConv').select_option('2');p.locator('#weaponConv').select_option('2');p.locator('#saveConv').click()
    eq(p.locator('[data-slot="0,0"] .meta2').inner_text(),'M2W3')
    p.reload();eq(p.locator('[data-slot="0,0"] .meta2').inner_text(),'M2W3')
    p.locator('#convDisplayToggle').click();eq(p.locator('.teamCost').count(),0);p.locator('#convDisplayToggle').click()
    p.locator('#bangbooToggle').click();eq(p.locator('#bangbooMode').is_disabled(),True);p.locator('#bangbooToggle').click()
    p.locator('#bangbooMode').click();p.locator('#bangbooAttribute').select_option('氷');assert p.locator('[data-bangboo]').count()>0
    p.locator('#reset').click();p.locator('#cancelReset').click();eq(p.locator('.slot:not(.empty)').count(),3)
    p.locator('#reset').click();p.locator('#confirmReset').click();eq(p.locator('.slot:not(.empty)').count(),0)
def rules(p,d):
    agent(p,0);team(p,3);eq(p.locator('[data-agent="0"]').get_attribute('class'),'char used')
    p.locator('#ruleToggle').click();agent(p,0);eq(p.locator('.slot:not(.empty)').count(),2)
    p.locator('#ruleToggle').click();eq(p.locator('.slot:not(.empty)').count(),1)
    p.locator('#specialty').select_option('支援');card=p.locator('[data-agent]').first;idx=card.get_attribute('data-agent');card.locator('strong').click()
    team(p,6);p.locator(f'[data-agent="{idx}"] strong').click();eq(p.evaluate('validAgentLayout()'),True)
    p.locator('#duplicateCostToggle').click();eq(p.evaluate('allGroupsDuplicateCost() <= allGroupsCost()'),True)
def export(p,d):
    agent(p,0);p.locator('#saveGroupImage').click();expect(p.locator('#groupImageModal')).to_have_class('modal show')
    with p.expect_download() as download: p.locator('#downloadGroupImage').click()
    assert pathlib.Path(download.value.path()).read_bytes().startswith(b'\x89PNG')
    p.locator('#closeGroupImage').click()
def group_limits(p,d):
    for _ in range(6):p.locator('#addGroup').click()
    eq(p.locator('.team').count(),27);p.reload();eq(p.locator('.team').count(),27)
    p.locator('#addGroup').click();eq(p.locator('.team').count(),27);eq(len(d),1)
    for _ in range(8):p.locator('#removeGroup').click()
    eq(p.locator('.team').count(),3);p.reload();eq(p.locator('.team').count(),3)
    p.locator('#removeGroup').click();eq(p.locator('.team').count(),3);eq(len(d),2)
def legacy_data(p,d):
    p.evaluate("localStorage.setItem(OLD_KEY,JSON.stringify([[AGENTS[0],null,null],...Array.from({length:8},()=>[null,null,null])]));localStorage.removeItem(KEY);localStorage.setItem(CUSTOM_BANGBOO_KEY,JSON.stringify([['data:image/png;base64,','旧ボンプ']]))")
    p.reload();eq(p.locator('[data-slot="0,0"] strong').count(),1);eq(p.evaluate('customBangboos.length'),1)
def cost_totals(p,d):
    agent(p,0);p.locator('[data-conv="0"]').click();p.locator('#charConv').select_option('2');p.locator('#weaponConv').select_option('2');p.locator('#saveConv').click()
    eq(p.locator('[data-team="0"] .teamCost').inner_text(),'6 Cost')
    p.locator('#ruleToggle').click();team(p,3);agent(p,0);eq(p.locator('.allCost').inner_text(),'Total: 12 Cost')
    p.locator('#duplicateCostToggle').click();eq(p.locator('.allCost').inner_text(),'Total: 6 Cost')
    p.reload();eq(p.locator('.allCost').inner_text(),'Total: 6 Cost')
def legal_touch_drag(p,d):
    p.set_viewport_size({'width':390,'height':844});agent(p,0)
    p.locator('[data-slot="0,0"]').scroll_into_view_if_needed()
    a=p.locator('[data-slot="0,0"]').bounding_box();b=p.locator('[data-slot="0,1"]').bounding_box()
    c=p.context.new_cdp_session(p) if args.engine=='chromium' else None
    if c:
        c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':a['x']+15,'y':a['y']+15}]})
        c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':b['x']+15,'y':b['y']+15}]})
        c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    else:
        src=p.locator('[data-slot="0,0"]');props={'pointerType':'touch','pointerId':7,'bubbles':True,'clientX':a['x']+15,'clientY':a['y']+15}
        src.dispatch_event('pointerdown',props);props.update(clientX=b['x']+15,clientY=b['y']+15);src.dispatch_event('pointermove',props);src.dispatch_event('pointerup',props)
    eq(p.locator('[data-slot="0,1"] strong').count(),1);eq(p.locator('[data-slot="0,0"] strong').count(),0)
    p.wait_for_timeout(500)
    p.locator('[data-slot="0,1"]').click();eq(p.locator('.slot:not(.empty)').count(),0)
def invalid_drag(p,d):
    p.locator('#specialty').select_option('支援');idx=p.locator('[data-agent]').first.get_attribute('data-agent')
    agent(p,idx);team(p,3);agent(p,idx)
    p.locator('[data-slot="3,0"]').drag_to(p.locator('[data-slot="1,0"]'))
    eq(p.locator('[data-slot="3,0"] strong').count(),1);eq(p.locator('[data-slot="1,0"] strong').count(),0)
def custom_delete(p,d):
    add_agent(p);agent(p,0);p.locator('[data-delete-custom="0"]').click();p.locator('#confirmDelete').click()
    eq(p.locator('.slot:not(.empty)').count(),0);eq(p.evaluate('customAgents.length'),0)
    p.reload();eq(p.locator('[data-agent]').count(),62)
def selected_team_reset(p,d):
    agent(p,0);team(p,1);agent(p,1);p.locator('#clearTeam').click()
    eq(p.locator('[data-slot="0,0"] strong').count(),1);eq(p.locator('[data-slot="1,0"] strong').count(),0)
TESTS=[group_persistence,reduced_group,custom_boo,cost_persistence,delete_cancel,duplicate_agent,same_image,boo_group_confirm,literal_agent,literal_boo,literal_weapon,native_drag,pointer_cancel,export_retry,normal_features,rules,export,group_limits,legacy_data,cost_totals,legal_touch_drag,invalid_drag,custom_delete,selected_team_reset]

def bangboo_drag(p,d):
    p.locator('#bangbooMode').click();p.locator('[data-bangboo="0"] strong').click()
    p.locator('[data-bangboo-slot="0"]').drag_to(p.locator('[data-bangboo-slot="1"]'))
    eq(p.locator('[data-bangboo-slot="1"] strong').count(),1)
    p.locator('[data-bangboo-slot="1"]').click();eq(p.locator('[data-bangboo-slot="1"] strong').count(),0)
def bangboo_cancel(p,d):
    p.locator('#bangbooMode').click();p.locator('[data-bangboo="0"] strong').click()
    src=p.locator('[data-bangboo-slot="0"]');dst=p.locator('[data-bangboo-slot="1"]')
    src.scroll_into_view_if_needed();a=src.bounding_box();b=dst.bounding_box()
    props={'pointerType':'touch','pointerId':7,'clientX':a['x']+10,'clientY':a['y']+10,'bubbles':True}
    src.dispatch_event('pointerdown',props);props.update(clientX=b['x']+10,clientY=b['y']+10)
    src.dispatch_event('pointermove',props);src.dispatch_event('pointercancel',props)
    eq(src.locator('strong').count(),1);eq(dst.locator('strong').count(),0)
    p.reload();eq(src.locator('strong').count(),1)
def bangboo_same_image_selected(p,d):
    add_boo(p,'ボンプA');p.locator('[data-bangboo="0"] strong').click()
    add_boo(p,'ボンプB');team(p,0)
    eq(p.locator('[data-bangboo="0"] .meta').inner_text(),'物理')
    eq(p.locator('[data-bangboo="1"] .meta').inner_text(),'物理・選択中')
def bangboo_delete_title(p,d):
    add_boo(p);p.locator('[data-delete-custom-bangboo="0"]').click()
    eq(p.locator('#deleteModal h2').inner_text(),'ボンプを削除')
def named_proto(p,d):
    add_agent(p,'__proto__');p.locator('[data-conv="0"]').click()
    p.locator('#charConv').select_option('2');p.locator('#weaponConv').select_option('2');p.locator('#saveConv').click()
    p.reload();eq(p.locator('[data-agent="0"] .meta2').inner_text(),'M2W3')
def stored_string_conv(p,d):
    p.evaluate("convData[AGENTS[0][1]]={char:'2',weapon:'2',weaponType:'limited'};saveConv()")
    p.reload();eq(p.locator('[data-agent="0"] .meta2').inner_text(),'M2W3')
def quota_add(p,d):
    p.evaluate("()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')}}")
    add_agent(p)
    eq(p.evaluate('customAgents.length'),0)
    assert len(d)>0 and '保存' in d[-1]
    eq(p.locator('#addModal').get_attribute('class'),'modal show')
def quota_add_boo(p,d):
    p.evaluate("()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')}}")
    add_boo(p)
    eq(p.evaluate('customBangboos.length'),0)
    assert len(d)>0 and '保存' in d[-1]
def agent_swap(p,d):
    agent(p,0);agent(p,1)
    p.locator('[data-slot="0,0"]').drag_to(p.locator('[data-slot="0,1"]'))
    eq(p.locator('[data-slot="0,0"] strong').inner_text(),'フィオニー')
    eq(p.locator('[data-slot="0,1"] strong').inner_text(),'セヴェリアン')
    p.reload();eq(p.locator('[data-slot="0,0"] strong').inner_text(),'フィオニー')
def bangboo_swap(p,d):
    p.locator('#bangbooMode').click()
    p.locator('[data-bangboo="0"] strong').click();p.locator('[data-bangboo="1"] strong').click()
    p.locator('[data-bangboo-slot="0"]').drag_to(p.locator('[data-bangboo-slot="1"]'))
    eq(p.locator('[data-bangboo-slot="0"] strong').inner_text(),'ウルトラネイヴ')
    p.reload();eq(p.locator('[data-bangboo-slot="1"] strong').inner_text(),'アリエル')
def bangboo_invalid_drag(p,d):
    p.locator('#ruleToggle').click();p.locator('#bangbooMode').click()
    p.locator('[data-bangboo="0"] strong').click();team(p,3);p.locator('[data-bangboo="0"] strong').click()
    p.locator('[data-bangboo-slot="3"]').drag_to(p.locator('[data-bangboo-slot="1"]'))
    eq(p.locator('[data-bangboo-slot="3"] strong').count(),1);eq(p.locator('[data-bangboo-slot="1"] strong').count(),0)
def every_cost_combination(p,d):
    failures=p.evaluate("""()=>{
      const bad=[];
      const permanent=new Set(['リナ','ライカン','猫又','「11号」','クレタ','グレース','ピュロイス']);
      for(const a of AGENTS)for(let c=0;c<=6;c++)for(let w=0;w<=4;w++)for(const type of ['limited','permanent','恒常']){
        convData[a[1]]={char:c,weapon:w,weaponType:type};
        const expected=(a[3]==='A'||permanent.has(a[1])?0:c+1)+(type==='limited'?w+1:0);
        if(unitCost(a)!==expected)bad.push([a[1],c,w,type,unitCost(a),expected]);
      }
      return bad;
    }""")
    eq(failures,[])
def permanent_roundtrip(p,d):
    for idx in [0,8,49,51,57,61]:
        for kind in ['limited','permanent']:
            p.locator(f'[data-conv="{idx}"]').click();p.locator('#charConv').select_option('6');p.locator('#weaponConv').select_option('4')
            p.locator('#weaponType').select_option(kind);p.locator('#saveConv').click();p.reload()
            expected=(0 if idx!=0 else 7)+(5 if kind=='limited' else 0)
            eq(p.evaluate(f'unitCost(AGENTS[{idx}])'),expected)
            p.locator(f'[data-conv="{idx}"]').click();eq(p.locator('#weaponType').input_value(),kind);p.locator('#cancelConv').click()
def old_images_and_names(p,d):
    p.evaluate("""()=>{
      const old=AGENTS.slice(0,3).map(a=>{const name=Object.keys(AGENT_NAME_ALIASES).find(n=>AGENT_NAME_ALIASES[n]===a[1]);return ['old.webp',name,a[2],a[3]]});
      localStorage.setItem(KEY,JSON.stringify([old,...Array.from({length:8},()=>[null,null,null])]));
      localStorage.setItem('zzz-team-bangboo-v1',JSON.stringify([['old.webp',BANGBOOS[0][1],'エーテル']]));
      localStorage.setItem('zzz-agent-conv-v2',JSON.stringify({[old[0][1]]:{char:2,weapon:1,weaponType:'恒常'}}));
    }""")
    p.reload();eq(p.locator('[data-slot="0,0"] strong').inner_text(),'セヴェリアン')
    eq(p.locator('[data-team="0"] .teamCost').inner_text(),'7 Cost')
    assert p.locator('#teams img').evaluate_all('(xs)=>xs.every(x=>x.complete&&x.naturalWidth>0)')
def all_images(p,d):
    eq(p.locator('[data-agent] img').count(),62)
    assert p.locator('[data-agent] img').evaluate_all('(xs)=>xs.every(x=>x.complete&&x.naturalWidth>0)')
    p.locator('#bangbooMode').click()
    p.wait_for_function("Array.from(document.querySelectorAll('[data-bangboo] img')).every(x=>x.complete&&x.naturalWidth>0)")
    eq(p.locator('[data-bangboo] img').count(),41)
def delete_agent_cancel(p,d):
    add_agent(p);add_boo(p);p.locator('#agentMode').click()
    p.locator('[data-delete-custom="0"]').click();p.locator('#cancelDelete').click()
    p.locator('#bangbooMode').click();p.locator('[data-delete-custom-bangboo="0"]').click();p.locator('#confirmDelete').click()
    eq(p.evaluate('customAgents.length'),1);eq(p.evaluate('customBangboos.length'),0)
def touch_tap(p,d):
    agent(p,0);p.locator('[data-slot="0,0"]').scroll_into_view_if_needed()
    box=p.locator('[data-slot="0,0"]').bounding_box();c=p.context.new_cdp_session(p) if args.engine=='chromium' else None
    if c:
        c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+15,'y':box['y']+15}]})
        c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    else:p.locator('[data-slot="0,0"]').click()
    eq(p.locator('[data-slot="0,0"] strong').count(),0)
def mobile_modal(p,d):
    p.set_viewport_size({'width':390,'height':600});p.locator('#addCharacter').click();p.locator('#chooseAgentAdd').click()
    p.locator('#saveAdd').click();eq(len(d),1)

EXTRA=[bangboo_drag,bangboo_cancel,bangboo_same_image_selected,bangboo_delete_title,named_proto,stored_string_conv,quota_add,quota_add_boo,agent_swap,bangboo_swap,bangboo_invalid_drag,every_cost_combination,permanent_roundtrip,old_images_and_names,all_images,delete_agent_cancel,touch_tap,mobile_modal]

TESTS+=EXTRA
exec((ROOT/'tests'/'interaction_cases.py').read_text())
TESTS+=NEW_TESTS
if args.only:TESTS=[fn for fn in TESTS if fn.__name__ in args.only.split(',')]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as pw:
        launch={'headless':True}
        if args.engine=='chromium':launch['executable_path']=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
        launch['timeout']=15000
        browser=getattr(pw,args.engine).launch(**launch)
        for fn in TESTS:
            options={'viewport':{'width':1280,'height':900}}
            if args.device!='desktop':options.update(pw.devices['iPhone 13' if args.device=='iphone' else 'Pixel 7'])
            ctx=browser.new_context(**options);ctx._cdn_fail=fn==export_retry
            def route(r):
                u=r.request.url
                if 'cdn.jsdelivr.net' in u:
                    if ctx._cdn_fail:r.abort('failed')
                    else:r.fulfill(path=CDN,content_type='application/javascript',headers={'Access-Control-Allow-Origin':'*'})
                elif 'fonts.googleapis.com' in u and FONT_DIR.exists():
                    css=''.join(f'@font-face{{font-family:"Zen Kaku Gothic New";font-weight:{w};src:url("{BASE}/test-font-{w}.ttf")}}' for w in [500,700,900])
                    r.fulfill(body=css,content_type='text/css')
                elif '/test-font-' in u:
                    r.fulfill(path=FONT_DIR/(u.split('test-font-')[1]),content_type='font/ttf')
                elif u.endswith('/baseline.html'):r.fulfill(path=BASELINE,content_type='text/html')
                elif u.endswith('/index.html'):r.fulfill(path=SOURCE,content_type='text/html')
                else:r.continue_()
            ctx.route('**/*',route)
            page=ctx.new_page();page.set_default_timeout(5000);page.set_default_navigation_timeout(15000);dialogs=[];errors=[]
            page.on('dialog',lambda x:(dialogs.append(x.message),x.dismiss()))
            page.on('pageerror',lambda e:errors.append(str(e)))
            try:
                page.goto(BASE+'/index.html',wait_until='load');page.evaluate('document.fonts.ready');fn(page,dialogs)
                assert not errors,errors
                result={'test':fn.__name__,'engine':args.engine,'device':args.device,'result':'PASS'}
            except Exception as e:result={'test':fn.__name__,'engine':args.engine,'device':args.device,'result':'FAIL','detail':str(e)[:550]}
            print(json.dumps(result,ensure_ascii=False),flush=True);results.append(result);ctx.close()
        browser.close()
finally:
    server.shutdown();server.server_close()
if args.report:
    args.report.write_text(json.dumps(results,ensure_ascii=False,indent=2))
failed=sum(r['result']=='FAIL' for r in results)
print(f'{len(results)-failed}/{len(results)} passed; {failed} failed')
sys.exit(1 if failed else 0)

