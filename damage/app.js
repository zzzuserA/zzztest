import {baseFields,mainFields,subFields,buffFields,kinds,custom,agent,action,calculate,mabRows} from './engine.js';

import {catalog,skillGroups,findAgent,effectiveLevel,attackRate,levelLabel,skillName} from './catalog.js';

import {attributes,weapons,weaponByName,weaponLevels,discSets,discLayouts,discSelection,gearLabels,enemyProfiles,attackAttribute} from './equipment.js';
import {blankEffect,timedStats} from './timeline.js';
import {automaticEffects,effectPresets} from './effect-presets.js';

import {assetFor} from './visual-assets.js';
let effectIndex=0;
let activeRow=-1;
const $ = id => document.getElementById(id);
const storageKey = 'zzz-damage-lab-v1';
const number = new Intl.NumberFormat('ja-JP',{maximumFractionDigits:0});
const decimal = new Intl.NumberFormat('ja-JP',{maximumFractionDigits:2});
const secondsFmt=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:3});
const fmt = n => number.format(n);
const dec = n => decimal.format(n);
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slotNames = ['01','02','03'];
const palette = ['mint','blue','violet'];
const special = {yaoN:1,turbulence:2,yaoV:2};
const linkedAction = a => Object.hasOwn(special,a.kind);
let scenarios=[custom(),custom()];
let side=0;
let slot=0;
let skillGroup='basic';
let previewLevel=0;
try {
  const data = JSON.parse(localStorage.getItem(storageKey));
  if(data?.scenarios?.length===2) {
    data.scenarios.forEach(calculate);
    scenarios=data.scenarios;
    side=data.side===1?1:0;
  }
} catch {}
const current = () => scenarios[side];
function save() {
  try { localStorage.setItem(storageKey,JSON.stringify({scenarios,side})); } catch {}
}
function announce(text) { $('status').textContent=text; }
function numeric(value,key,config={}) {
  const {min=0,max=100000000000,step='any',label=''}=config;
  return `<input type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" value="${value??''}" data-key="${key}"${label?` aria-label="${label}"`:''}>`;
}
function field(label,value,key,config) { return `<label class="field"><span>${label}</span>${numeric(value,key,config)}</label>`; }
function option(value,text,selected) { return `<option value="${escape(value)}"${value===selected?' selected':''}>${escape(text)}</option>`; }
function itemImage(kind,key,extra='') {
  const src=assetFor(kind,key);
  return src?'<img class="item-image '+extra+'" src="'+src+'" alt="" loading="lazy" decoding="async">':'<span class="item-image placeholder '+extra+'" aria-hidden="true">＋</span>';
}
function pickerButton(kind,value,label,index='',suffix=''){
  return `<button type="button" class="visual-choice" data-picker="${kind}" data-pick-index="${index}">
    ${itemImage(kind,value)}<span><small>${label}</small><strong>${escape(suffix||'画像から選ぶ')}</strong></span><b aria-hidden="true">⌄</b>
  </button>`;
}
let pickerKind='agent', pickerIndex=0;
function pickerRows(){
  if(pickerKind==='agent')return catalog.map(x=>[x.id,x.name,[x.attribute,x.specialty,x.rarity].filter(Boolean).join(' · '),x.fullName]);
  if(pickerKind==='weapon')return weapons.map(w=>[w.name,w.name,w.rank+'級 · '+w.role,w.role]);
  return discSets.map(([name,key,value])=>[name,name,'2セット　'+(gearLabels[key]??(key.startsWith('element:')?key.slice(8)+'ダメージ %':''))+' +'+value]);
}
function renderPicker(){
  const e=editAgent().equipment;
  const selection=discSelection(e);
  const active=pickerKind==='agent'?findAgent(editAgent())?.id:pickerKind==='weapon'?e?.weapon:selection.names[pickerIndex];
  const reserved=pickerKind==='disc'?selection.names.filter((_,i)=>i!==pickerIndex):[];
  const query=$('picker-search').value.trim().normalize('NFKC').toLowerCase();
  const rows=pickerRows().filter(row=>row.join(' ').normalize('NFKC').toLowerCase().includes(query));
  const cards=items=>items.map(([id,name,meta])=>`
    <button type="button" class="pick-card" data-pick-value="${escape(id)}" aria-pressed="${id===active}" ${reserved.includes(id)?'disabled':''}>
      ${itemImage(pickerKind,id)}<strong>${escape(name)}</strong><small>${escape(reserved.includes(id)?'別枠で選択中':meta)}</small>
    </button>`).join('');
  const role=pickerKind==='weapon'?findAgent(editAgent())?.specialty:null;
  let content;
  if(role){
    const matching=rows.filter(row=>row[3]===role);
    const others=rows.filter(row=>row[3]!==role);
    content=(matching.length?`<h3 class="picker-section">${escape(role)}の音動機</h3>${cards(matching)}`:'')+
      (others.length?`<h3 class="picker-section">その他の特性</h3>${cards(others)}`:'');
  } else content=cards(rows);
  $('picker-grid').innerHTML=content||'<p class="hint">該当する項目がありません。</p>';
  $('picker-count').textContent=rows.length+'件';
}
function openPicker(button){
  pickerKind=button.dataset.picker;
  pickerIndex=Number(button.dataset.pickIndex||0);
  $('picker-title').textContent={agent:'エージェントを選ぶ',weapon:'音動機を選ぶ',disc:'ディスクセットを選ぶ'}[pickerKind];
  $('picker-clear').textContent=pickerKind==='agent'?'手入力のエージェントを使用':'選択を外す';
  $('picker-search').value='';
  renderPicker();
  $('picker-dialog').showModal();
  $('picker-search').focus();
}
function selectCatalogAgent(value){
  const info=catalog.find(entry=>entry.id===value);
  const prev=editAgent();
  if(info&&findAgent(prev)?.id!==value){
    const next=agent(info.name);
    next.agentId=info.id;
    next.base={...next.base,...Object.fromEntries(Object.entries(info.stats).filter(([,v])=>v!==null)),weaponAtk:0};
    if(info.specialty==='命破')next.base.sheerAtk=30;
    current().agents[slot]=next;
    announce(info.name+'の基礎値を読み込みました');
  } else if(!info)prev.agentId='';
}
function chooseVisual(value){
  const a=editAgent();
  if(pickerKind==='agent')selectCatalogAgent(value);
  else {
    const e=(a.equipment??={});
    if(pickerKind==='weapon')e.weapon=value;
    else {
      const selection=discSelection(e);
      if(value&&selection.names.some((name,i)=>i!==pickerIndex&&name===value))return;
      selection.names[pickerIndex]=value;
      e.discSelection=selection;
    }
  }
  $('picker-dialog').close();
  save();show();
  document.querySelector(`[data-picker="${pickerKind}"][data-pick-index="${pickerKind==='disc'?pickerIndex:''}"]`)?.focus();
}

function showRoster() {
  $('roster').innerHTML=current().agents.map((a,i)=>`
    <button type="button" class="member ${palette[i]}" data-slot="${i}" aria-pressed="${i===slot}">
      ${itemImage('agent',findAgent(a)?.id??'','party-avatar')}
      <span class="member-text"><small>AGENT ${slotNames[i]}</small><strong>${escape(a.name||'エージェント '+(i+1))}</strong></span>
      <span class="member-arrow" aria-hidden="true">↗</span>
    </button>`).join('');
}
function showAgentControls() {
  const a=current().agents[slot];
  const entry=findAgent(a);
  $('agent-controls').innerHTML=`
    <div class="agent-tools">
      ${pickerButton('agent',entry?.id??'','エージェント', '',entry?.name)}
      <label class="field"><span>心象映画</span>
        <select id="mindscape" ${entry?'':'disabled'}>${Array.from({length:7},(_,i)=>option(String(i),'M'+i,String(a.mindscape??0))).join('')}</select>
      </label>
      <button class="add" id="open-skills" ${entry?'':'disabled'}>技一覧・レベル設定</button>
    </div>
    <p class="hint agent-hint">${entry?`参照データあり / ${entry.skills.length}項目`:'キャラを選ぶと、基礎ステータスとレベル別のスキル倍率を使えます。'}</p>`;
}
function showSkills() {
  const a=current().agents[slot];
  const entry=findAgent(a);
  if(!entry) return;
  const groups=Object.entries(skillGroups).filter(([id])=>entry.skills.some(row=>row.group===id));
  if(!groups.some(([id])=>id===skillGroup)) skillGroup=groups[0][0];
  const rows=entry.skills.filter(row=>row.group===skillGroup);
  const active=effectiveLevel(a,rows[0]);
  const max=skillGroup==='core'?7:16;
  const selected=previewLevel||active;
  $('skill-dialog-title').textContent=entry.name+'のスキル';
  $('skill-body').innerHTML=`
    <p class="hint">${escape([entry.attribute,entry.specialty,entry.rarity].filter(Boolean).join(' · '))} / M${a.mindscape??0}。育成レベルを変えると、追加済みの技も再計算します。</p>
    <div class="skill-levels">${groups.map(([id,label])=>`<label class="field"><span>${label}</span>
      <select data-train="${id}" aria-label="${label}の育成レベル">${Array.from({length:id==='core'?7:12},(_,i)=>
        option(String(i+1),levelLabel(id,i+1),String(a.levels?.[id]??(id==='core'?7:12)))).join('')}</select>
    </label>`).join('')}</div>
    <div class="skill-filters">
      <label class="field"><span>技の種類</span><select id="skill-group">${groups.map(([id,label])=>option(id,label,skillGroup)).join('')}</select></label>
      <label class="field"><span>倍率の表示レベル</span><select id="preview-level">
        ${option('0','育成設定に連動（'+levelLabel(skillGroup,active)+'）',String(previewLevel))}
        ${Array.from({length:max},(_,i)=>option(String(i+1),levelLabel(skillGroup,i+1),String(previewLevel))).join('')}
      </select></label>
    </div>
    <div class="skill-list">${rows.map(row=>{
      const value=row.rates[selected-1];
      const title=skillName(row);
      return `<div class="skill-row"><div><strong>${escape(title)}</strong><small>${row.source.split('+').map(source=>({wiki:'日本語Wiki',fandom:'Fandom'})[source]).join(' / ')}</small></div>
        <b>${value==null?'資料なし':dec(value)+'%'}</b>
        <button type="button" class="add" data-skill="${row.id}" aria-label="${escape(title)}を追加" ${value==null?'disabled':''}>追加</button></div>`;
    }).join('')}</div>
    <div class="skill-foot"><p class="hint">追加した技は編成の「ローテーション」に入ります。</p>
      <p class="hint"><a href="${escape(entry.sources.wiki)}" target="_blank" rel="noreferrer">日本語Wiki ↗</a>${entry.sources.fandom?` · <a href="${escape(entry.sources.fandom)}" target="_blank" rel="noreferrer">Fandom ↗</a>`:''}</p></div>`;
}
function diskGroup(title,which,fields,values) {
  return `<section class="edit-group"><h3>${title}</h3><div class="field-grid">${fields.map(([label,increment],i)=>
    field(`${label} <small>× ${increment}</small>`,values[i],`${which}.${i}`,{max:which==='main'?3:100,step:1})
  ).join('')}</div></section>`;
}
function showBuild() {
  const a=current().agents[slot];
  $('build-content').innerHTML=`
    <section class="edit-group"><div class="edit-top"><h3>基礎値</h3><label class="field"><span>エージェント名</span><input maxlength="36" value="${escape(a.name)}" data-key="name"></label></div>
      <div class="field-grid">${baseFields.map(([key,label])=>field(key==='atk'&&a.base.weaponAtk!==undefined?'キャラの基礎攻撃力':label,a.base[key]??(key==='ownDef'?findAgent(a)?.stats.ownDef:undefined)??(key==='critSeverity'?250:''),`base.${key}`)).join('')}
      ${a.base.weaponAtk!==undefined?field('音動機の基礎攻撃力',a.base.weaponAtk,'base.weaponAtk'):''}</div>
    </section>
    ${a.equipment?.discs?'<p class="hint">以前のディスクメイン効果を引き継いでいます。入力方法は音動機・ディスク欄から切り替えられます。</p>':diskGroup('ディスクメインステータスの個数','main',mainFields,a.main)}
    ${diskGroup('ディスクサブステータスのヒット数','sub',subFields,a.sub)}
    <section class="edit-group"><h3>常時バフ・デバフの手入力</h3><div class="field-grid">
    ${buffFields.map(([key,label])=>field(label,a.buffs[key],`buffs.${key}`,{min:-1000000})).join('')}
    </div></section>
    <section class="edit-group"><h3>戦闘時ステータス</h3><div class="field-grid" id="combat-stats"></div></section>`;
}
function showEquipment() {
  const a=current().agents[slot];
  const e=a.equipment??{};
  const info=findAgent(a);
  const weapon=weaponByName.get(e.weapon);
  const selection=discSelection(e);
  const sizes=discLayouts[selection.mode];
  const weaponLevel=e.weaponLevel??60;
  const refine=e.refine??1;
  const wIndex=weaponLevels.indexOf(weaponLevel);
  $('equipment-content').innerHTML=`
    <section class="edit-group gear-group">
      <h3>音動機 <small>S / A</small></h3>
      <div class="gear-row">
        ${pickerButton('weapon',weapon?.name??'','装備する音動機','',weapon?.name)}
        <label class="field"><span>音動機レベル</span><select data-weapon="weaponLevel" ${weapon?'':'disabled'}>${weaponLevels.map(n=>option(String(n),'Lv. '+n,String(weaponLevel))).join('')}</select></label>
        <label class="field"><span>改造段階</span><select data-weapon="refine" ${weapon?'':'disabled'}>${[1,2,3,4,5].map(n=>option(String(n),'★'+n,String(refine))).join('')}</select></label>
      </div>
      ${weapon?`<p class="hint">基礎${weapon.baseKind==='ownDef'?'防御力':'攻撃力'} ${dec(weapon.base[wIndex])} / ${escape(weapon.subName)} ${weapon.sub[wIndex]==null?'資料なし':dec(weapon.sub[wIndex])}${weapon.role!==info?.specialty?' · 特性不一致または未設定のためパッシブ無効':''}</p>
      <div class="gear-chips">${weapon.passives.map(([label,values])=>`<span>${escape(label)} <b>${values[refine-1]==null?'資料なし':dec(values[refine-1])}</b></span>`).join('')}</div>
      <p class="hint">パッシブ欄は効果量の参照値です。行動で変わる効果は、行動の「時限効果」で確認できます。</p>`:''}
    </section>
    <section class="edit-group gear-group">
      <h3>ドライバディスク</h3>
      <div class="switch disk-switch" role="group" aria-label="ディスクのセット構成">
        <button type="button" data-disc-layout="pair" aria-pressed="${selection.mode==='pair'}">4セット ＋ 2セット</button>
        <button type="button" data-disc-layout="trio" aria-pressed="${selection.mode==='trio'}">2セット × 3</button>
      </div>
      <div class="disc-choices">${sizes.map((size,i)=>pickerButton('disc',selection.names[i]??'',size+'セット'+(selection.mode==='trio'?' '+(i+1):''),i,selection.names[i])).join('')}</div>
      <p class="hint">セット効果を適用します。メイン・サブのステータスはビルドで設定できます。</p>
      ${e.discs?'<p class="hint">以前のディスクメイン効果を適用中</p><button type="button" class="quiet" id="use-manual-discs">メイン効果を手入力に切り替え</button>':''}
    </section>`;
}
function showEnemy() {
  const e=current().enemy;
  $('enemy-content').innerHTML=`<div class="field-grid edit-group">
    <label class="field"><span>敵の耐性プリセット</span><select id="enemy-preset">${option('','手入力 / プリセットを選択',e.profile??'')}${enemyProfiles.map(([name,weak,resist],i)=>option(String(i),name+' · 弱点 '+(weak.join('・')||'なし')+' / 耐性 '+(resist.join('・')||'なし'),e.profile)).join('')}</select></label>
    ${field('敵の防御力',e.def,'def')}
    ${field('共通のダメージ耐性 %',e.res,'res',{min:-100,max:100})}
    ${field('ブレイク弱体倍率 %',e.stun,'stun',{max:1000})}
    ${field('想定戦闘時間（秒）',e.seconds,'seconds',{max:3600})}
    ${field('基準MAB（初回の異常発動ライン）',e.mab??0,'mab')}
  </div><div class="edit-group resist-group"><div class="resist-head" aria-hidden="true"><span>属性</span><span>ダメージ耐性 %</span><span>異常蓄積耐性 %</span><span>手入力した蓄積 Pt</span><span>発動済み回数</span><span>発動ライン到達率</span></div>
  ${attributes.map(attr=>`<div class="resist-row"><b>${attr}</b>
    ${field('ダメージ耐性 %',e.damageRes?.[attr]??'','damageRes.'+attr,{min:-100,max:100,label:attr+'のダメージ耐性'})}
    ${field('異常蓄積耐性 %',e.anomalyRes?.[attr]??0,'anomalyRes.'+attr,{min:-100,max:100,label:attr+'の異常蓄積耐性'})}
    ${field('蓄積 Pt',e.gauge?.[attr]??0,'gauge.'+attr,{label:attr+'の蓄積 Pt'})}
    ${field('発動済み回数',e.anomalyCount?.[attr]??0,'anomalyCount.'+attr,{step:1,max:10,label:attr+'の発動済み回数'})}
    <span class="gauge-progress" data-gauge="${attr}">—</span></div>`).join('')}
  </div><p class="hint inner-hint">ダメージ耐性の空欄には共通値が使われます。弱点は負の数です。MABは敵ごとに入力し、蓄積耐性を適用した入力Ptが次の発動ラインの何％かを表示します。物理は基準の1.2倍、風は0.5倍です。同属性の発動済み回数に応じて必要量が1回につき2%、最大20%増えます。戦闘時間はDPSに使います。</p>`;
}
function showEffects() {
  const a=current().actions[effectIndex];
  const member=current().agents[a.slot];
  const available=effectPresets(member);
  const matching=automaticEffects({...a,autoEffects:true},member);
  const targets=[['self','担当者のみ'],['team','チーム全体／敵'],...current().agents.map((m,i)=>[String(i),m.name])];
  $('effect-title').textContent=a.name+'の時限効果';
  $('effect-body').innerHTML=`
    <p class="hint">この行動の各発動を起点にします。命中後の効果は次の命中から有効です。同時刻は行の上から順に処理し、終了時刻ちょうどで効果が切れます。</p>
    ${matching.length?`<section class="edit-group">
      <label class="check-field"><input id="auto-effects" type="checkbox" ${a.autoEffects===false?'':'checked'}>条件に合う効果を自動適用</label>
      ${matching.map(p=>`<p class="hint">${escape(p.name)} · ${p.duration}秒 · ${escape(p.condition)} <a href="${escape(p.source)}" target="_blank" rel="noreferrer">出典 ↗</a></p>`).join('')}
    </section>`:''}
    <section class="edit-group effect-tools">
      <label class="field"><span>効果プリセット</span><select id="effect-preset">${option('','条件に合う効果を選択','')}${available.map(p=>option(p.id,p.name+' · '+p.condition,'')).join('')}</select></label>
      <button type="button" id="add-effect" class="add">＋ 手入力の効果</button>
    </section>
    ${(a.effects??[]).map((rule,i)=>`<section class="edit-group timed-effect" data-effect="${i}">
      <div class="effect-heading"><input data-effect-key="name" aria-label="効果名" maxlength="72" placeholder="効果名" value="${escape(rule.name)}">
      <button class="remove" type="button" data-delete-effect aria-label="効果を削除">×</button></div>
      ${rule.source?`<p class="hint">${escape(rule.condition??'')} <a href="${escape(rule.source)}" target="_blank" rel="noreferrer">出典 ↗</a></p>`:''}
      <div class="field-grid">
        <label class="field"><span>効果</span><select data-effect-key="stat">${Object.entries(timedStats).map(([k,n])=>option(k,n,rule.stat)).join('')}</select></label>
        ${rule.weapon?`<div class="stat"><span>音動機の★に連動</span><strong>${weaponByName.get(rule.weapon)?.passives[rule.weaponRow]?.[1][(member.equipment?.refine??1)-1]??'資料なし'}</strong></div>`:field('1重の効果量',rule.amount,'amount',{min:-1000000,max:1000000})}
        <label class="field"><span>効果の対象</span><select data-effect-key="target">${targets.map(([k,n])=>option(k,n,rule.target)).join('')}</select></label>
        <label class="field"><span>対象の攻撃属性</span><select data-effect-key="attribute">${option('','全属性',rule.attribute)}${attributes.map(n=>option(n,n,rule.attribute)).join('')}</select></label>
        ${field('持続（秒）',rule.duration,'duration',{max:3600})}
        ${field('発動までの遅延（秒）',rule.delay,'delay',{max:3600})}
        ${field('重複上限',rule.stacks,'stacks',{min:1,max:20,step:1})}
        ${field('再発動間隔（秒）',rule.cooldown,'cooldown',{max:3600})}
        <label class="field"><span>持続時間の更新</span><select data-effect-key="mode">${option('refresh','全スタックを更新',rule.mode)}${option('independent','スタックごとに管理',rule.mode)}</select></label>
        <label class="field"><span>ダメージ計算との順序</span><select data-effect-key="timing">${option('after','命中後',rule.timing)}${option('before','命中前',rule.timing)}</select></label>
      </div>
    </section>`).join('')}
    ${a.effects?.length?'':'<p class="hint">ほかのキャラや装備効果も、発動させる行動に手入力で追加できます。</p>'}`;
}
function rotationSlots(){
  $('rotation-slots').innerHTML=current().agents.map((a,i)=>`
    <button type="button" class="${palette[i]}" data-rotation-slot="${i}" aria-pressed="${i===slot}">${itemImage('agent',findAgent(a)?.id??'')}<span>${escape(a.name||'枠 '+(i+1))}</span></button>`).join('');
  $('rotation-add-skill').disabled=!findAgent(editAgent());
}
function editRotationRow(index,scroll=false){
  if(scroll)activeRow=index;
  else activeRow=activeRow===index?-1:index;
  for(const el of $('rotation').querySelectorAll('[data-row]')){
    const open=Number(el.dataset.row)===activeRow;
    el.querySelector('.rot-edit').hidden=!open;
    el.querySelector('[data-expand-row]').setAttribute('aria-expanded',open);
    el.classList.toggle('rot-open',open);
  }
  if(scroll){
    const target=$('rotation').querySelector(`[data-expand-row="${index}"]`);
    target?.scrollIntoView({block:'nearest'});
    target?.focus({preventScroll:true});
  }
}
function showRotationBoard(report){
  const {agents,actions,enemy}=current();
  if(!report.events.length){
    $('rotation-board').innerHTML='<p class="hint">技を追加すると、発動時刻をここに表示します。</p>';
    return;
  }
  const windows=new Map();
  for(const e of report.events){
    for(const hit of e.triggers){
      if(!windows.has(hit.name))windows.set(hit.name,[]);
      windows.get(hit.name).push(hit);
    }
  }
  const farthest=report.events.reduce((n,e)=>Math.max(n,e.time,...e.triggers.map(x=>x.until)),Math.max(1,enemy.seconds));
  const rough=farthest/8;
  const magnitude=10**Math.floor(Math.log10(rough));
  const step=([1,2,5,10].find(n=>n*magnitude>=rough)??10)*magnitude;
  const duration=Math.ceil(farthest/step)*step;
  const pct=time=>Number((100*time/duration).toFixed(6))+'%';
  const tickCount=Math.round(duration/step);
  const axis=Array.from({length:tickCount+1},(_,i)=>`<span style="--left:${pct(i*step)}">${secondsFmt.format(i*step)}秒</span>`).join('');
  const lanes=agents.map((a,i)=>{
    const byTime=new Map();
    for(const e of report.events.filter(hit=>hit.slot===i)){
      if(!byTime.has(e.time))byTime.set(e.time,[]);
      byTime.get(e.time).push(e);
    }
    return `<div class="board-lane ${palette[i]}"><span class="board-label">${itemImage('agent',findAgent(a)?.id??'')}<b>${escape(a.name)}</b></span><div class="board-track">
      ${[...byTime.entries()].map(([time,hits])=>{
        const rows=[...new Set(hits.map(hit=>hit.index))];
        const title=rows.map(index=>actions[index].name).join('、');
        const count=hits.reduce((n,hit)=>n+hit.multiplicity,0);
        return `<button type="button" class="board-hit" data-board-rows="${rows.join(',')}" style="--left:${pct(time)}" title="${escape(title)}" aria-label="${secondsFmt.format(time)}秒 ${escape(title)}">${count>1?count:'●'}</button>`;
      }).join('')}</div></div>`;
  }).join('');
  const effects=[...windows.entries()].map(([name,segments])=>{
    const spans=[];
    for(const segment of [...segments].sort((a,b)=>a.start-b.start)){
      const last=spans.at(-1);
      if(last&&segment.start<=last.until)last.until=Math.max(last.until,segment.until);
      else spans.push({...segment});
    }
    return `<div class="board-lane board-effect"><span class="board-label" title="${escape(name)}"><b>${escape(name)}</b></span><div class="board-track">${spans.map(s=>`<span class="effect-window" style="--left:${pct(s.start)};--width:${pct(s.until-s.start)}" title="${secondsFmt.format(s.start)}〜${secondsFmt.format(s.until)}秒"></span>`).join('')}</div></div>`;
  }).join('');
  $('rotation-board').innerHTML=`<div class="board-scroll"><div class="sequence-board"><div class="board-lane"><span class="board-label">経過時間</span><div class="board-axis">${axis}</div></div>${lanes}${effects}</div></div>
    <p class="hint board-legend">● 行動を選択して編集　<span>━</span> バフ・デバフの効果時間</p>`;
}

function showRotation() {
  const {actions,agents}=current();
  rotationSlots();
  $('rotation').innerHTML=actions.map((a,i)=>{
    const linked=linkedAction(a);
    const catalogRate=a.catalog?attackRate(agents[a.slot],a):null;
    const auto=automaticEffects(a,agents[a.slot]);
    const measured=a.kind==='fixed';
    const who=linked?special[a.kind]:a.slot;
    const amountLabel=measured?'1回のダメージ':linked?'参照値への倍率 %':'倍率 %';
    return `<article class="rot-row ${palette[who]}${i===activeRow?' rot-open':''}" data-row="${i}">
      <div class="rot-overview">
        <button type="button" class="rot-expand" data-expand-row="${i}" aria-expanded="${i===activeRow}" aria-controls="rot-edit-${i}">
          <span class="rotation-order">${String(i+1).padStart(2,'0')}</span>${itemImage('agent',findAgent(agents[who])?.id??'')}
          <span class="rot-title"><small>${escape(agents[who].name)} · <span id="row-time-${i}">${secondsFmt.format(a.time??0)}秒</span></small><strong id="row-name-${i}">${escape(a.name)}</strong></span>
          <span class="rot-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="rot-dmg"><small>行動合計</small><strong id="row-total-${i}"></strong><small id="row-unit-${i}"></small></div>
      </div>
      <div class="rot-edit" id="rot-edit-${i}" ${i===activeRow?'':'hidden'}>
      <div class="rot-cell"><input aria-label="行動名 ${i+1}" placeholder="行動名" maxlength="42" data-key="name" value="${escape(a.name)}">
      <select data-key="slot" aria-label="担当エージェント ${i+1}" ${linked||a.catalog?'disabled':''}>${agents.map((m,j)=>option(String(j),m.name||'エージェント '+(j+1),String(who))).join('')}</select></div>
      <div class="rot-cell"><select data-key="kind" aria-label="ダメージ種類 ${i+1}">${Object.entries(kinds).filter(([k])=>Object.hasOwn(special,k)?k===a.kind:!a.catalog||k!=='fixed').map(([k,name])=>option(k,name,a.kind)).join('')}</select>
      ${linked||measured?`<span class="rot-static">${linked?'参照式の条件':'補正を適用済み'}</span>`:
      `<select data-key="phase" aria-label="敵の状態 ${i+1}">${option('normal','通常時',a.phase)}${option('stun','ブレイク中',a.phase)}</select>`}</div>
      <div class="rot-cell rot-quantity">
      ${a.catalog?`<label><small id="row-rate-${i}">${amountLabel}</small>
      <select data-rate-level aria-label="技のレベル ${i+1}" ${catalogRate?'':'disabled'}>
        ${option('0','育成設定に連動',String(a.catalog.level||0))}
        ${catalogRate?.skill.rates.map((rate,j)=>option(String(j+1),levelLabel(catalogRate.skill.group,j+1)+(rate==null?'（資料なし）':''),String(a.catalog.level||0))).join('')??''}
      </select></label>`:`<label><small>${amountLabel}</small>${numeric(a.amount,'amount',{label:amountLabel+' '+(i+1)})}</label>`}
      <label><small>回数</small>${numeric(a.count,'count',{step:1,max:10000,label:'発動回数 '+(i+1)})}</label></div>
      <div class="rot-meta">
        ${field('発動時刻（秒）',a.time??0,'time',{max:3600,label:'発動時刻 '+(i+1)})}
        ${field('繰り返し間隔（秒）',a.interval??0,'interval',{max:3600,label:'繰り返し間隔 '+(i+1)})}
        <label class="field"><span>攻撃属性</span><select data-key="attribute" aria-label="攻撃属性 ${i+1}">${option('','自動（'+(attackAttribute({},findAgent(agents[a.slot]),catalogRate?.skill)||'共通耐性')+'）',a.attribute??'')}${attributes.map(attr=>option(attr,attr,a.attribute)).join('')}</select></label>
        <button type="button" class="quiet effect-button" data-open-effect="${i}">時限効果 <span>${(a.effects?.length??0)+auto.length}</span></button>
        ${a.catalog&&catalogRate?.amount==null?`<button type="button" class="quiet" data-use-manual="${i}">倍率を手入力</button>`:''}
      </div>
        <div class="rot-actions">
          <button type="button" class="quiet" data-move-row="-1" ${i===0?'disabled':''}>↑ 上へ</button>
          <button type="button" class="quiet" data-move-row="1" ${i===actions.length-1?'disabled':''}>↓ 下へ</button>
          <button type="button" class="quiet" data-copy-row>複製</button>
          <button type="button" class="quiet" data-remove="${i}" aria-label="行動 ${i+1} を削除">削除</button>
        </div>
      </div>
    </article>`;
  }).join('')||'<p class="empty">行動を追加してダメージを計算できます。</p>';
}
function showResult() {
  const reports=scenarios.map(calculate);
  const report=reports[side];
  const [a,b]=reports.map(r=>r.total);
  const delta=b-a;
  const relative=a>0 ? `（${delta>0?'+':''}${dec(delta/a*100)}%）` : '';
  $('total').textContent=fmt(report.total);
  $('dps').textContent=report.dps===null?'—':fmt(report.dps);
  $('seconds').textContent=dec(current().enemy.seconds)+' 秒';
  $('contributions').innerHTML=report.byAgent.map((n,i)=>{
    const percent=report.total>0?100*n/report.total:0;
    return `<div class="contribution ${palette[i]}"><div><span>${escape(current().agents[i].name||'エージェント '+(i+1))}</span><strong>${fmt(n)}</strong></div><div class="track" aria-hidden="true"><i style="width:${percent}%"></i></div></div>`;
  }).join('');
  $('comparison').innerHTML=`<div><span>編成 A</span><strong>${fmt(a)}</strong></div><div><span>編成 B</span><strong>${fmt(b)}</strong></div><div class="delta"><span>B − A</span><strong>${delta>0?'+':''}${fmt(delta)} ${relative}</strong></div>`;
  report.rows.forEach((r,i)=>{
    const a=current().actions[i];
    const rate=a.catalog?attackRate(current().agents[a.slot],a):null;
    const effectCount=$('rotation').querySelector(`[data-row="${i}"] .effect-button span`);
    if(effectCount)effectCount.textContent=(a.effects?.length??0)+automaticEffects(a,current().agents[a.slot]).length;
    const rateLabel=$('row-rate-'+i);
    if(rateLabel) rateLabel.textContent=rate?.amount==null?'倍率資料なし':levelLabel(rate.skill.group,rate.level)+' · '+dec(rate.amount)+'%';
    $('row-name-'+i).textContent=a.name||'名称未設定';
    $('row-time-'+i).textContent=secondsFmt.format(a.time??0)+'秒';
    $('row-total-'+i).textContent=r.each===null?'—':fmt(r.total);
    $('row-unit-'+i).textContent=r.each===null?(linkedAction(a)?'参照編成と異なります':rate?'このLvの倍率資料なし':'参照した技の資料なし'):fmt(r.each)+' / 回（平均）';
  });
  const m=report.members[slot];
  const display=[['攻撃力',m.atk],['HP',m.hp],['防御力',m.ownDef],['会心率 %',m.rawCr*100],['会心ダメージ %',m.cd*100],['異常マスタリー',m.ap],['異常掌握',m.am],['透徹力',m.sheer],['防御補正 %',m.def*100]];
  $('combat-stats').innerHTML=display.map(([label,n])=>`<div class="stat"><span>${label}</span><strong>${dec(n)}</strong></div>`).join('');
  for(const r of mabRows(current().enemy)){
    const cell=$('enemy-content').querySelector(`[data-gauge="${r.attribute}"]`);
    if(cell)cell.textContent=r.progress===null?'—':dec(r.progress)+'% · '+dec(r.effective)+' / '+dec(r.threshold);
  }
  showRotationBoard(report);
  $('timeline-output').innerHTML=report.events.length?report.events.map(e=>{
    const a=current().actions[e.index];
    const names=e.names.map(x=>escape(x.name)+' ×'+x.stacks+'（'+secondsFmt.format(x.until)+'秒まで）');
    const triggers=e.triggers.map(x=>escape(x.name)+'（'+secondsFmt.format(x.start)+'〜'+secondsFmt.format(x.until)+'秒）');
    return `<div class="timeline-row"><time>${secondsFmt.format(e.time)} s</time><div><strong>${escape(a.name)}${e.multiplicity>1?' ×'+e.multiplicity:''}</strong><small>${names.join(' ・ ')||'有効な時限効果なし'}</small>${triggers.length?`<small class="timeline-trigger">発動・更新 ${triggers.join(' ・ ')}</small>`:''}</div><b>${e.damage===null?'—':fmt(e.damage*e.multiplicity)}</b></div>`;
  }).join('')+(report.eventCount>report.events.reduce((n,e)=>n+e.multiplicity,0)?'<p class="hint">時系列の先頭150件を表示しています。合計にはすべての行動が含まれます。</p>':''):'<p class="hint">行動を追加すると時系列を表示します。</p>';

}
function show() {
  $('select-a').setAttribute('aria-pressed',side===0);
  $('select-b').setAttribute('aria-pressed',side===1);
  $('copy').textContent=side===0?'A を B にコピー':'B を A にコピー';
  showRoster();showAgentControls();showBuild();showEquipment();showEnemy();showRotation();showResult();
}
function readInput(el) {
  if(el.type!=='number') return el.value;
  if(!Number.isFinite(el.valueAsNumber)) return null;
  const n=Math.max(Number(el.min),Math.min(Number(el.max),el.valueAsNumber));
  return el.step==='1'?Math.round(n):n;
}
function setInput(event,resolve) {
  const el=event.target;
  if(!el.dataset.key) return;
  const target=resolve(el);
  const [group,key]=el.dataset.key.split('.');
  const value=readInput(el);
  if(value===null){
    if(group==='damageRes'&&key!==undefined){delete target.damageRes?.[key];save();showResult();}
    return;
  }
  if(key===undefined) target[group]=group==='slot'?Number(value):value;
  else (target[group]??={})[key]=value;
  if(group==='damageRes'||group==='anomalyRes'){delete target.profile;$('enemy-preset').value='';}
  save();
  showResult();
}
function normalize(event,resolve) {
  const el=event.target;
  if(el.type!=='number'||!el.dataset.key) return;
  const [group,key]=el.dataset.key.split('.');
  const target=resolve(el);
  el.value=(key===undefined?target[group]:target[group]?.[key])??el.defaultValue;
}
const editAgent=()=>current().agents[slot];
const editEnemy=()=>current().enemy;
const editAction=el=>current().actions[el.closest('[data-row]').dataset.row];
function nextTime(){
  const actions=current().actions;
  if(!actions.length)return 0;
  const last=actions.reduce((time,a)=>Math.max(time,(a.time??0)+Math.max(0,a.count-1)*(a.interval??0)),0);
  return Math.min(3600,Math.round((last+1)*1000)/1000);
}
$('build-content').addEventListener('input',event=>{
  setInput(event,editAgent);
  if(event.target.dataset.key==='name') {
    showRoster();
    showRotation();
    showResult();
  }
});
$('enemy-content').addEventListener('input',event=>setInput(event,editEnemy));
$('rotation').addEventListener('input',event=>{
  if(event.target.hasAttribute('data-rate-level')) {
    editAction(event.target).catalog.level=Number(event.target.value);
    save();showResult();return;
  }
  setInput(event,editAction);
  if(['kind','slot','attribute'].includes(event.target.dataset.key)){
    const row=event.target.closest('[data-row]').dataset.row;
    showRotation();
    showResult();
    $('rotation').querySelector(`[data-row="${row}"] [data-key="${event.target.dataset.key}"]`).focus();
  }
});
for(const [id,resolver] of [['build-content',editAgent],['enemy-content',editEnemy],['rotation',editAction]]) {
  $(id).addEventListener('focusout',event=>normalize(event,resolver));
}
$('roster').addEventListener('click',event=>{
  const button=event.target.closest('button[data-slot]');
  if(!button) return;
  slot=Number(button.dataset.slot);
  const wantsPicker=event.target.closest('.party-avatar')||!findAgent(editAgent());
  if(!wantsPicker)$('build').open=true;
  showRoster();showAgentControls();showBuild();showEquipment();rotationSlots();showResult();
  const trigger=$('roster').querySelector(`[data-slot="${slot}"]`);
  trigger.focus();
  if(wantsPicker)openPicker($('agent-controls').querySelector('[data-picker="agent"]'));
});
$('agent-controls').addEventListener('change',event=>{
  if(event.target.id==='mindscape'){
    editAgent().mindscape=Number(event.target.value);
    save();showResult();
  }
});
$('agent-controls').addEventListener('click',event=>{
  if(event.target.id!=='open-skills') return;
  skillGroup='basic';
  previewLevel=0;
  showSkills();
  $('skill-dialog').showModal();
});
$('close-skills').addEventListener('click',()=>$('skill-dialog').close());
$('skill-body').addEventListener('change',event=>{
  const el=event.target;
  const group=el.dataset.train;
  if(group){
    (editAgent().levels??={})[group]=Number(el.value);
    skillGroup=group;
    previewLevel=0;
    save();showResult();showSkills();
    $('skill-body').querySelector(`[data-train="${group}"]`).focus();
  } else if(el.id==='skill-group'||el.id==='preview-level'){
    if(el.id==='skill-group') {
      skillGroup=el.value;
      previewLevel=0;
    } else previewLevel=Number(el.value);
    showSkills();
    $(el.id).focus();
  }
});
$('skill-body').addEventListener('click',event=>{
  const button=event.target.closest('[data-skill]');
  if(!button) return;
  const a=editAgent();
  const entry=findAgent(a);
  const skill=entry.skills.find(row=>row.id===button.dataset.skill);
  const level=previewLevel||effectiveLevel(a,skill);
  if(skill.rates[level-1]==null) return;
  const name=skillName(skill);
  activeRow=current().actions.length;
  current().actions.push({...action(slot,name,skill.kind),time:nextTime(),interval:1,
    catalog:{agentId:entry.id,skillId:skill.id,level:previewLevel}});
  save();showRotation();showResult();
  announce(name+'を行動に追加しました');
  button.textContent='追加済み';
});
for(const id of ['select-a','select-b']) $(id).addEventListener('click',event=>{
  side=Number(event.currentTarget.dataset.side);
  activeRow=-1;
  save();show();
});
$('copy').addEventListener('click',()=>{
  scenarios[1-side]=structuredClone(current());
  save();showResult();
  announce('比較先に編成をコピーしました');
});
$('new-lineup').addEventListener('click',()=>{
  const empty=custom();
  if(JSON.stringify(current())!==JSON.stringify(empty)&&!window.confirm('編集中の編成をクリアしますか？'))return;
  scenarios[side]=empty;
  activeRow=-1;
  slot=0;
  save();show();
  announce('空の編成を作成しました');
});
$('add').addEventListener('click',()=>{
  const rows=current().actions;
  activeRow=rows.length;
  rows.push({...action(slot),time:nextTime(),interval:1});
  save();showRotation();showResult();
  $('rotation').querySelector(`[data-row="${rows.length-1}"] input`).focus();
});
$('rotation-add-skill').addEventListener('click',()=>$('open-skills').click());
$('rotation-slots').addEventListener('click',event=>{
  const button=event.target.closest('[data-rotation-slot]');
  if(!button)return;
  slot=Number(button.dataset.rotationSlot);
  showRoster();showAgentControls();showBuild();showEquipment();rotationSlots();showResult();
  $('rotation-slots').querySelector(`[data-rotation-slot="${slot}"]`).focus();
});
$('rotation-board').addEventListener('click',event=>{
  const hit=event.target.closest('[data-board-rows]');
  if(hit){
    const rows=hit.dataset.boardRows.split(',').map(Number);
    editRotationRow(rows[(rows.indexOf(activeRow)+1)%rows.length],true);
  }
});
$('rotation').addEventListener('click',event=>{
  const expand=event.target.closest('[data-expand-row]');
  if(expand){editRotationRow(Number(expand.dataset.expandRow));return;}
  const move=event.target.closest('[data-move-row]');
  const copyRow=event.target.closest('[data-copy-row]');
  if(move||copyRow){
    const index=Number(event.target.closest('[data-row]').dataset.row);
    const {actions}=current();
    if(move){
      const destination=index+Number(move.dataset.moveRow);
      if(destination<0||destination>=actions.length)return;
      [actions[index],actions[destination]]=[actions[destination],actions[index]];
      activeRow=destination;
    } else {
      actions.splice(index+1,0,structuredClone(actions[index]));
      activeRow=index+1;
    }
    save();showRotation();showResult();
    $('rotation').querySelector(`[data-expand-row="${activeRow}"]`).focus();
    return;
  }
  const open=event.target.closest('[data-open-effect]');
  if(open){
    effectIndex=Number(open.dataset.openEffect);
    showEffects();
    $('effects-dialog').showModal();
    return;
  }
  const manual=event.target.closest('[data-use-manual]');
  if(manual){
    const a=current().actions[Number(manual.dataset.useManual)];
    delete a.catalog;
    a.amount=0;
    save();showRotation();showResult();
    $('rotation').querySelector(`[data-row="${manual.dataset.useManual}"] [data-key="amount"]`).focus();
    return;
  }
  const button=event.target.closest('button[data-remove]');
  if(!button) return;
  const index=Number(button.dataset.remove);
  current().actions.splice(index,1);
  if(activeRow===index)activeRow=-1;
  else if(activeRow>index)activeRow--;
  save();showRotation();showResult();
  ($('rotation').querySelector(`[data-expand-row="${index}"]`)??$('add')).focus();
});
$('equipment-content').addEventListener('change',event=>{
  const el=event.target;
  const a=editAgent();
  const config=(a.equipment??={});
  if(!el.dataset.weapon)return;
  config[el.dataset.weapon]=Number(el.value);
  save();showEquipment();showResult();
  $('equipment-content').querySelector(`[data-weapon="${el.dataset.weapon}"]`)?.focus();
});
$('equipment-content').addEventListener('click',event=>{
  const layout=event.target.closest('[data-disc-layout]');
  if(layout){
    const e=(editAgent().equipment??={});
    const old=discSelection(e);
    const mode=layout.dataset.discLayout;
    if(old.mode!==mode){
      const drafts=(e.discLayoutDrafts??={});
      drafts[old.mode]=old.names.slice();
      e.discSelection={mode,names:(drafts[mode]??old.names).slice(0,discLayouts[mode].length)};
      save();showEquipment();showResult();
      $('equipment-content').querySelector(`[data-disc-layout="${mode}"]`)?.focus();
    }
  } else if(event.target.id==='use-manual-discs'){
    const e=editAgent().equipment;
    e.discSelection??=discSelection(e);
    delete e.discs;
    save();showBuild();showEquipment();showResult();
    $('build').open=true;
  }
});
document.addEventListener('click',event=>{
  const picker=event.target.closest('[data-picker]');
  if(picker)openPicker(picker);
});
$('picker-search').addEventListener('input',renderPicker);
$('picker-grid').addEventListener('click',event=>{
  const card=event.target.closest('[data-pick-value]');
  if(card&&!card.disabled)chooseVisual(card.dataset.pickValue);
});
$('picker-clear').addEventListener('click',()=>chooseVisual(''));
$('picker-close').addEventListener('click',()=>$('picker-dialog').close());
$('enemy-content').addEventListener('change',event=>{
  if(event.target.id!=='enemy-preset'||!event.target.value)return;
  const e=editEnemy();
  const entry=enemyProfiles[Number(event.target.value)];
  if(!entry)return;
  const [,weak,resist]=entry;
  e.profile=event.target.value;
  e.damageRes=Object.fromEntries(attributes.map(attr=>[attr,weak.includes(attr)?-20:resist.includes(attr)?20:0]));
  e.anomalyRes={...e.damageRes};
  save();showEnemy();showResult();
  $('enemy-preset').focus();
});
$('close-effects').addEventListener('click',()=>$('effects-dialog').close());
$('effect-body').addEventListener('input',event=>{
  const el=event.target;
  const a=current().actions[effectIndex];
  if(el.id==='auto-effects')a.autoEffects=el.checked;
  else if(el.dataset.key||el.dataset.effectKey){
    const r=a.effects[el.closest('[data-effect]').dataset.effect];
    const value=readInput(el);
    if(value===null)return;
    r[el.dataset.key??el.dataset.effectKey]=value;
  } else return;
  save();showResult();
});
$('effect-body').addEventListener('focusout',event=>{
  const el=event.target;
  if(el.type!=='number'||!el.dataset.key)return;
  const rule=current().actions[effectIndex].effects[el.closest('[data-effect]').dataset.effect];
  el.value=rule[el.dataset.key];
});
$('effect-body').addEventListener('change',event=>{
  if(event.target.id!=='effect-preset'||!event.target.value)return;
  const a=current().actions[effectIndex];
  const preset=effectPresets(current().agents[a.slot]).find(p=>p.id===event.target.value);
  if(!preset)return;
  const effects=(a.effects??=[]);
  if(!effects.some(p=>p.id===preset.id))effects.push({...preset});
  save();showEffects();showResult();
  $('effect-preset').focus();
});
$('effect-body').addEventListener('click',event=>{
  const a=current().actions[effectIndex];
  if(event.target.id==='add-effect'){
    (a.effects??=[]).push(blankEffect());
    save();showEffects();showResult();
    $('effect-body').querySelector('.timed-effect:last-of-type [data-effect-key="name"]')?.focus();
  } else if(event.target.hasAttribute('data-delete-effect')){
    a.effects.splice(Number(event.target.closest('[data-effect]').dataset.effect),1);
    save();showEffects();showResult();
    $('add-effect').focus();
  }
});
show();
