"""Additional browser regressions, loaded by browser_regression.py."""
def state(p):return p.evaluate('JSON.stringify({teams,bangboos})')
def history_roundtrip(p,before,after):
    p.locator('#undoMove').click();eq(state(p),before)
    p.locator('#redoMove').click();eq(state(p),after)
def agent_add_remove_history(p,d):
    before=state(p);agent(p,0);after=state(p);history_roundtrip(p,before,after)
    p.locator('[data-slot="0,0"]').click();removed=state(p);eq(removed,before);history_roundtrip(p,after,removed)
    p.locator('#undoMove').click();p.reload();eq(state(p),after)
def boo_add_remove_history(p,d):
    before=state(p);p.locator('#bangbooMode').click();p.locator('[data-bangboo="0"] strong').click();after=state(p);history_roundtrip(p,before,after)
    p.locator('[data-bangboo-slot="0"]').click();removed=state(p);eq(removed,before);history_roundtrip(p,after,removed)
def history_branch(p,d):
    agent(p,0);agent(p,1);p.locator('#undoMove').click();agent(p,2)
    eq(p.locator('#redoMove').is_disabled(),True)
    eq(p.locator('[data-slot="0,1"] strong').inner_text(),p.evaluate('AGENTS[2][1]'))
def mixed_history(p,d):
    start=state(p);agent(p,0);agent(p,1);p.locator('#bangbooMode').click();p.locator('[data-bangboo="0"] strong').click()
    p.locator('[data-slot="0,0"]').drag_to(p.locator('[data-slot="0,1"]'));end=state(p)
    for _ in range(4):p.locator('#undoMove').click()
    eq(state(p),start)
    for _ in range(4):p.locator('#redoMove').click()
    eq(state(p),end)
def agent_move_history(p,d):
    agent(p,0);before=state(p);p.locator('[data-slot="0,0"]').drag_to(p.locator('[data-slot="1,1"]'));after=state(p)
    assert before!=after;history_roundtrip(p,before,after)
def boo_move_history(p,d):
    p.locator('#bangbooMode').click();p.locator('[data-bangboo="0"] strong').click();before=state(p)
    p.locator('[data-bangboo-slot="0"]').drag_to(p.locator('[data-bangboo-slot="1"]'));after=state(p)
    assert before!=after;history_roundtrip(p,before,after)
def team_swap_history(p,d):
    agent(p,0);p.locator('#bangbooMode').click();p.locator('[data-bangboo="0"] strong').click();before=state(p)
    p.locator('[data-team="0"] .teamhead').dblclick();eq(p.locator('.swap-source').count(),1)
    p.locator('[data-team="1"] .teamhead').click();after=state(p)
    eq(p.locator('[data-slot="1,0"] strong').count(),1);eq(p.locator('[data-bangboo-slot="1"] strong').count(),1)
    eq(p.locator('.swap-source').count(),0);history_roundtrip(p,before,after)
def team_swap_cancel(p,d):
    agent(p,0);before=state(p);p.locator('[data-team="0"] .teamhead').dblclick();p.locator('[data-team="0"] .teamhead').click()
    eq(p.locator('.swap-source').count(),0);eq(state(p),before)
def team_swap_invalid(p,d):
    p.locator('#specialty').select_option('支援');idx=p.locator('[data-agent]').first.get_attribute('data-agent')
    agent(p,idx);team(p,3);agent(p,idx);before=state(p);undo=p.evaluate('moveUndo.length')
    p.locator('[data-team="3"] .teamhead').dblclick();p.locator('[data-team="1"] .teamhead').click()
    eq(state(p),before);eq(p.evaluate('moveUndo.length'),undo)
def history_keyboard(p,d):
    before=state(p);agent(p,0);after=state(p)
    p.locator('#undoMove').press('Control+z');eq(state(p),before)
    p.locator('#redoMove').press('Control+Shift+z');eq(state(p),after)
    p.locator('#search').fill('abc');p.locator('#search').press('Control+z');eq(state(p),after)
def history_reload_and_reset(p,d):
    agent(p,0);p.reload();eq(p.locator('#undoMove').is_disabled(),True)
    agent(p,1);p.locator('#clearTeam').click();eq(p.locator('#undoMove').is_disabled(),True)
    agent(p,2);p.locator('#addGroup').click();eq(p.locator('#undoMove').is_disabled(),True)
def history_display_toggles(p,d):
    before=state(p);agent(p,0);after=state(p)
    p.locator('#convDisplayToggle').click();p.locator('#bangbooToggle').click()
    history_roundtrip(p,before,after)
def history_limit(p,d):
    p.evaluate('()=>{for(let i=0;i<55;i++){const before=moveSnapshot();teams[0][0]=i%2?null:AGENTS[0];recordMove(before)}render()}')
    eq(p.evaluate('moveUndo.length'),50)
    for _ in range(50):p.locator('#undoMove').click()
    eq(p.locator('#undoMove').is_disabled(),True);eq(p.evaluate('moveRedo.length'),50)
def narrow_layout(p,d):
    for w in [320,375,390,768,1024,1440]:
        p.set_viewport_size({'width':w,'height':844})
        eq(p.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),True)
        eq(p.locator('#undoMove').is_visible(),True)
def empty_press_highlight(p,d):
    team(p,1)
    for selector in ['[data-slot="0,0"]','[data-bangboo-slot="0"]']:
        loc=p.locator(selector);loc.scroll_into_view_if_needed();box=loc.bounding_box()
        p.mouse.move(box['x']+8,box['y']+8);p.mouse.down()
        color=loc.evaluate('(el)=>getComputedStyle(el).borderColor');p.mouse.up()
        assert color not in ['rgb(255, 216, 0)','rgb(255, 224, 88)'],color
        team(p,1)
def export_names_and_controls(p,d):
    agent(p,9);p.locator('[data-team="0"] .teamhead').dblclick()
    eq(p.locator('.swap-source').evaluate('(x)=>getComputedStyle(x).animationName'),'teamSwapPulse')
    eq(p.locator('.swap-source').evaluate('(x)=>getComputedStyle(x).outlineStyle'),'none')
    p.evaluate('ensureHtml2Canvas()')
    p.evaluate('''()=>{const original=window.html2canvas;window.html2canvas=(target,options)=>{const old=options.onclone;options.onclone=doc=>{old(doc);const root=doc.getElementById('teams');window.exportCheck={controls:root.querySelectorAll('.moveActions').length,selected:root.querySelectorAll('.active,.swap-source').length,names:Array.from(root.querySelectorAll('.slot strong')).map(el=>{const range=doc.createRange();range.selectNodeContents(el);const b=el.getBoundingClientRect(),t=range.getBoundingClientRect();return {left:t.left-b.left,right:b.right-t.right,text:el.textContent}})};};return original(target,options)}}''')
    p.locator('#saveGroupImage').click();expect(p.locator('#groupImageModal')).to_have_class('modal show')
    result=p.evaluate('exportCheck');eq(result['controls'],0);eq(result['selected'],0)
    for item in result['names']:assert item['left']>=1.9 and item['right']>=1.9,item
    p.screenshot(path=str(ROOT/'tests'/f'export-{args.engine}-{args.device}.png'))
def touch_double_tap(p,d):
    if args.device=='desktop':return
    agent(p,0);loc=p.locator('[data-team="0"] .teamhead');loc.tap();loc.tap()
    eq(p.locator('.swap-source').count(),1);p.locator('[data-team="1"] .teamhead').tap();eq(p.locator('[data-slot="1,0"] strong').count(),1)
def quota_history(p,d):
    agent(p,0);before=state(p)
    p.evaluate("()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')}}")
    p.locator('#undoMove').click()
    eq(state(p),before);eq(p.evaluate('moveSaving'),False)
NEW_TESTS=[agent_add_remove_history,boo_add_remove_history,history_branch,mixed_history,agent_move_history,boo_move_history,team_swap_history,team_swap_cancel,team_swap_invalid,history_keyboard,history_reload_and_reset,history_display_toggles,history_limit,narrow_layout,empty_press_highlight,export_names_and_controls,touch_double_tap,quota_history]

def font_resize_names(p,d):
    agent(p,9)
    for width in [320,1440,375]:
        p.set_viewport_size({'width':width,'height':844});p.wait_for_timeout(150)
        for selector in ['.slot strong','#chars .char strong']:
            failures=p.locator(selector).evaluate_all('(xs)=>xs.filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>({text:x.textContent,width:x.clientWidth,scroll:x.scrollWidth,font:getComputedStyle(x).fontSize}))')
            eq(failures,[])
    assert p.evaluate("document.fonts.check('900 12px \"Zen Kaku Gothic New\"')")
def quota_edit_rollback(p,d):
    agent(p,0);before=state(p);history=p.evaluate('moveUndo.length')
    p.evaluate("()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')}}")
    agent(p,1);eq(state(p),before);eq(p.evaluate('moveUndo.length'),history)
    p.locator('[data-slot="0,0"]').click();eq(state(p),before)
    p.locator('[data-slot="0,0"]').drag_to(p.locator('[data-slot="1,0"]'));eq(state(p),before)
    eq(p.evaluate('moveSaving'),False)
def partial_storage_rollback(p,d):
    agent(p,0);before=state(p)
    p.evaluate("()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='zzz-team-bangboo-v1')throw new DOMException('full','QuotaExceededError');return original.call(this,k,v)}}")
    p.locator('[data-team="0"] .teamhead').dblclick();p.locator('[data-team="1"] .teamhead').click()
    eq(state(p),before);eq(p.evaluate('JSON.stringify(load())'),p.evaluate('JSON.stringify(teams)'))
def large_export(p,d):
    p.set_viewport_size({'width':900,'height':1000})
    for _ in range(6):p.locator('#addGroup').click()
    p.locator('#saveGroupImage').click();expect(p.locator('#groupImageModal')).to_have_class('modal show',timeout=15000)
    shape=p.locator('#groupImagePreview').evaluate('(x)=>({w:x.naturalWidth,h:x.naturalHeight})')
    assert shape['w']>0 and shape['h']>0,shape
    assert shape['w']*shape['h']<16777216,shape
NEW_TESTS += [font_resize_names,quota_edit_rollback,partial_storage_rollback,large_export]

def editing_cancels_swap(p,d):
    p.locator('[data-team="0"] .teamhead').dblclick();agent(p,0)
    eq(p.locator('.swap-source').count(),0)
    p.locator('[data-team="0"] .teamhead').dblclick()
    p.locator('[data-slot="0,0"]').drag_to(p.locator('[data-slot="1,0"]'))
    eq(p.locator('.swap-source').count(),0)
NEW_TESTS += [editing_cancels_swap]

def production_upgrade_persistence(p,d):
    p.goto(BASE+'/baseline.html',wait_until='load');agent(p,0)
    p.locator('[data-conv="0"]').click();p.locator('#charConv').select_option('4');p.locator('#weaponConv').select_option('3');p.locator('#saveConv').click()
    add_agent(p,'移行検証エージェント');agent(p,0);add_boo(p,'移行検証ボンプ');p.locator('[data-bangboo="0"] strong').click()
    p.locator('#ruleToggle').click();p.locator('#duplicateCostToggle').click();p.locator('#addGroup').click()
    before=p.evaluate('JSON.stringify({teams,bangboos,convData,customAgents,customBangboos,noOverlap,showConv,showDuplicateCost})')
    p.goto(BASE+'/index.html',wait_until='load')
    eq(p.evaluate('JSON.stringify({teams,bangboos,convData,customAgents,customBangboos,noOverlap,showConv,showDuplicateCost})'),before)
    eq(p.locator('#undoMove').is_disabled(),True)
NEW_TESTS += [production_upgrade_persistence]
