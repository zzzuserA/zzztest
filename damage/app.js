import {baseFields,mainFields,subFields,buffFields,kinds,custom,agent,action,calculate,skillDamage,reactionDamage,damageDetails} from './engine.js';

import {catalog,skillGroups,findAgent,effectiveLevel,attackRate,levelLabel,skillName} from './catalog.js';

import {attributes,weapons,weaponByName,weaponLevels,discSets,discLayouts,discSelection,gearLabels,attackAttribute} from './equipment.js';
import {maxSubRolls} from './optimizer.js';
import {luminizeRows,reactionRows,voidflareAttribute} from './reactions.js';

import {assetFor} from './visual-assets.js';
let allocationWorker=null;
let activeRow=-1;
const $ = id => document.getElementById(id);
const storageKey = 'zzz-damage-lab-v1';
const number = new Intl.NumberFormat('ja-JP',{maximumFractionDigits:0});
const decimal = new Intl.NumberFormat('ja-JP',{maximumFractionDigits:2});
const detailNumber = new Intl.NumberFormat('ja-JP',{maximumFractionDigits:6});
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
let reactionSource=0;
let voidflareChoices=[-1,-1,-1];
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
      <button class="add" id="open-skills" ${entry?'':'disabled'}>スキル別ダメージ</button>
    </div>
    <p class="hint agent-hint">${entry?`参照データあり / ${entry.skills.length}項目`:'キャラを選ぶと、基礎ステータスとレベル別のスキル倍率を使えます。'}</p>`;
}
function directSkill(entry,skill){
  return skill.group!=='core'&&!(entry.id==='1221'&&skill.label.includes('追加ダメージ倍率'));
}
function damageColumns(values){
  return values.map((value,i)=>`<span class="skill-estimate"><small>${i?'ブレイク中':'通常時'}</small><b>${value===null?'—':fmt(value)}</b></span>`).join('');
}
const selectedVoidflares=()=>voidflareChoices.filter(source=>source!==-1);
const specialRows=()=>skillGroup==='luminize'?luminizeRows(current().agents,slot,selectedVoidflares()):reactionRows(current().agents,slot,reactionSource);
const detailButton=(id,key,title)=>`<button type="button" class="quiet detail-toggle" data-damage-detail="${escape(key)}" aria-controls="${escape(id)}" aria-expanded="false" aria-label="${escape(title)}の計算詳細">計算詳細</button>`;
const detailPanel=id=>`<section class="damage-detail" id="${escape(id)}" aria-label="計算詳細" hidden></section>`;

function renderDamageDetails(results){
  if(!results.length)return '<p class="hint">現在の設定で計算できる倍率や参照データがありません。</p>';
  const term=value=>Array.isArray(value)?`${escape(value[0])}（${detailNumber.format(value[1])}）`:
    typeof value==='number'?detailNumber.format(value):escape(value);
  return `<p class="hint">倍率は小数で表示します（450% = 4.5）。途中の表示値は最大6桁まで丸めています。</p>
    ${results.map(({label,total,steps})=>`<section class="damage-detail-phase"><h4>${label} · ${fmt(total)}</h4>
      <ol>${steps.map(({label,value,terms,operator=''})=>`<li><strong>${escape(label)}</strong>
        <span>${terms.map(term).join(operator)} = ${detailNumber.format(value)}</span></li>`).join('')}</ol></section>`).join('')}`;
}

function toggleDamageDetails(button,getDetails){
  const panel=$(button.getAttribute('aria-controls'));
  if(panel.hidden)panel.innerHTML=renderDamageDetails(getDetails());
  panel.hidden=!panel.hidden;
  button.setAttribute('aria-expanded',!panel.hidden);
}

function showSkills() {
  const a=current().agents[slot];
  const entry=findAgent(a);
  if(!entry) return;
  const groups=Object.entries(skillGroups).filter(([id])=>entry.skills.some(row=>row.group===id));
  if(entry.specialty==='異常')groups.push(['reaction','状態異常・特殊ダメージ']);
  if(entry.id==='1581')groups.push(['luminize','耀変ダメージ']);
  if(entry.specialty==='鋭御'&&entry.skills.some(row=>row.label.includes('重傷')))groups.push(['sharp-special','鋭御・重傷']);
  if(!groups.some(([id])=>id===skillGroup)) skillGroup=groups[0][0];
  const rows=entry.skills.filter(row=>skillGroup==='sharp-special'?row.label.includes('重傷'):row.group===skillGroup);
  const reaction=skillGroup==='reaction';
  const luminize=skillGroup==='luminize';
  const specialDamage=reaction||luminize;
  const agents=current().agents;
  const active=specialDamage?0:effectiveLevel(a,rows[0]);
  const reactionOptions=specialDamage?specialRows():[];
  const voidflareSources=luminize?agents.flatMap((member,i)=>
    voidflareAttribute(agents,slot,i)?[[String(i),member.name]]:[]):[];
  const max=skillGroup==='core'?7:16;
  const selected=previewLevel||active;
  $('skill-dialog-title').textContent=entry.name+'のスキル別ダメージ';
  $('skill-body').innerHTML=`
    <p class="hint">${escape([entry.attribute,entry.specialty,entry.rarity].filter(Boolean).join(' · '))} / M${a.mindscape??0}。1回分の推定ダメージです。会心のある技は期待値で表示します。</p>
    <div class="skill-levels">${groups.filter(([id])=>Object.hasOwn(skillGroups,id)).map(([id,label])=>`<label class="field"><span>${label}</span>
      <select data-train="${id}" aria-label="${label}の育成レベル">${Array.from({length:id==='core'?7:12},(_,i)=>
        option(String(i+1),levelLabel(id,i+1),String(a.levels?.[id]??(id==='core'?7:12)))).join('')}</select>
    </label>`).join('')}</div>
    <div class="skill-filters">
      <label class="field"><span>技の種類</span><select id="skill-group">${groups.map(([id,label])=>option(id,label,skillGroup)).join('')}</select></label>
      ${reaction?`<label class="field"><span>下地の状態異常を付与するキャラ</span><select id="reaction-source">${agents.map((m,i)=>option(String(i),m.name,String(reactionSource))).join('')}</select></label>`:luminize?'':`<label class="field"><span>倍率の表示レベル</span><select id="preview-level">
        ${option('0','育成設定に連動（'+levelLabel(skillGroup,active)+'）',String(previewLevel))}
        ${Array.from({length:max},(_,i)=>option(String(i+1),levelLabel(skillGroup,i+1),String(previewLevel))).join('')}
      </select></label>`}
    </div>
    ${reaction?'<p class="hint">混沌は下地の状態異常の基礎値に、固定倍率（通常450%、霜烈600%）と残存分を足した倍率を掛けます。下の「基本倍率」は残存分を含まない値、「残存分が最大」は下地の付与直後の値です。複数キャラの蓄積割合や未対応の固有補正は手動で調整してください。</p>':''}
    ${luminize?`<div class="field-grid">${voidflareChoices.map((choice,i)=>`<label class="field"><span>虚光 ${i+1} の付与元</span>
      <select id="voidflare-${i}" data-voidflare="${i}">${option('-1','なし',String(choice))}${voidflareSources.map(([value,name])=>option(value,name,String(choice))).join('')}</select></label>`).join('')}</div>
      <p class="hint">${voidflareSources.length?'昇華を起こした味方を虚光ごとに選択してください。同じ味方を複数回選べます。':'編成に昇華を起こす味方を追加してください。'} 各キャラの現在の設定値で試算します。凸で得る特殊「虚光」は対象外です。</p>`:''}
    <div class="skill-list">${specialDamage?reactionOptions.map(row=>{
      const id='detail-skill-'+row.id;
      return `<div class="skill-row"><div><strong>${escape(row.name)}</strong><small>${luminize?`Lv. ${row.level} · スキル倍率 ${dec(row.baseRate)}%`:`${escape(agents[row.source].name)}を参照${row.id.startsWith('disorder-')?' · '+dec(row.amount)+'%':''}`}</small>
        ${row.amount==null?'':detailButton(id,row.id,row.name)}</div>
        ${damageColumns(reactionDamage(current(),slot,row))}<button type="button" class="add" data-reaction="${row.id}" aria-label="${escape(row.name)}を追加" ${row.amount==null?'disabled':''}>追加</button>${detailPanel(id)}</div>`;
    }).join('')||'<p class="hint">状態異常の下地になるキャラを選んでください。</p>':rows.map(row=>{
      const value=row.rates[selected-1];
      const title=skillName(row);
      const direct=directSkill(entry,row);
      const detail=(value==null?'倍率資料なし':dec(value)+'%')+(direct?'':' · 補正値');
      const id='detail-skill-'+row.id;
      return `<div class="skill-row"><div><strong>${escape(title)}</strong><small>${detail}</small>
        ${value==null||!direct?'':detailButton(id,row.id,title)}</div>
        ${damageColumns(direct?skillDamage(current(),slot,row,selected):[null,null])}
        <button type="button" class="add" data-skill="${row.id}" aria-label="${escape(title)}を追加" ${value==null||!direct?'disabled':''}>追加</button>${detailPanel(id)}</div>`;
    }).join('')}</div>
    <div class="skill-foot"><p class="hint">追加した技は編成の「スキル・ダメージ」に入ります。</p>
      <p class="hint"><a href="${escape(entry.sources.wiki)}" target="_blank" rel="noreferrer">日本語Wiki ↗</a>${entry.sources.fandom?` · <a href="${escape(entry.sources.fandom)}" target="_blank" rel="noreferrer">Fandom ↗</a>`:''}</p></div>`;
}
function diskGroup(title,which,fields,values) {
  return `<section class="edit-group"><h3>${title}</h3><div class="field-grid">${fields.map(([label,increment],i)=>
    field(`${label} <small>× ${increment}</small>`,values[i]??0,`${which}.${i}`,{max:which==='main'?3:100,step:1})
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
    <section class="edit-group"><h3>常時バフ・デバフの手入力</h3><div class="field-grid">
    ${buffFields.map(([key,label])=>field(label,a.buffs[key],`buffs.${key}`,{min:-1000000})).join('')}
    </div></section>
    <section class="edit-group"><h3>戦闘時ステータス</h3><div class="field-grid" id="combat-stats"></div></section>`;
}
function showEquipment() {
  allocationWorker?.terminate();
  allocationWorker=null;
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
      <p class="hint">条件付きの効果は、適用したい値をビルドのバフ・デバフ欄に入力してください。</p>`:''}
    </section>
    <section class="edit-group gear-group">
      <h3>ドライバディスク</h3>
      <div class="switch disk-switch" role="group" aria-label="ディスクのセット構成">
        <button type="button" data-disc-layout="pair" aria-pressed="${selection.mode==='pair'}">4セット ＋ 2セット</button>
        <button type="button" data-disc-layout="trio" aria-pressed="${selection.mode==='trio'}">2セット × 3</button>
      </div>
      <div class="disc-choices">${sizes.map((size,i)=>pickerButton('disc',selection.names[i]??'',size+'セット'+(selection.mode==='trio'?' '+(i+1):''),i,selection.names[i])).join('')}</div>
      <p class="hint">メインステータスはビルド欄で設定できます。</p>
      ${e.discs?'<p class="hint">以前のディスクメイン効果を適用中</p><button type="button" class="quiet" id="use-manual-discs">メイン効果を手入力に切り替え</button>':''}
    </section>
    ${diskGroup('ディスクのサブステータス（振り数）','sub',subFields,a.sub)}
    <section class="edit-group allocation">
      <div class="allocation-controls">
        ${field('有効ステータス数（合計振り数）',a.subBudget??Math.min(maxSubRolls,a.sub.reduce((sum,n)=>sum+(n??0),0)),'subBudget',{max:maxSubRolls,step:1})}
        <button type="button" class="add" id="optimize-substats">最大ダメージに自動配分</button>
      </div>
      <p class="hint">現在の合計 <strong id="sub-roll-total">0</strong> 振り。S級ディスクの初期値・強化1回をそれぞれ1振りとして換算します。</p>
      <p class="hint">登録済みのスキル・回数で編成の合計ダメージが最大になるよう、選択中のキャラの振り数を置き換えます。ディスク1枚ごとの付与制限は考慮しません。</p>
      <p id="allocation-status" class="hint" role="status"></p>
    </section>`;
}
function showEnemy() {
  const e=current().enemy;
  $('enemy-content').innerHTML=`<div class="field-grid edit-group">
    ${field('敵の防御力',e.def,'def')}
    ${field('共通のダメージ耐性 %',e.res,'res',{min:-100,max:100})}
    ${field('ブレイク弱体倍率 %',e.stun,'stun',{max:1000})}
  </div><div class="field-grid edit-group">
  ${attributes.map(attr=>field(attr+'のダメージ耐性 %',e.damageRes?.[attr]??'','damageRes.'+attr,{min:-100,max:100,label:attr+'のダメージ耐性'})).join('')}
  </div><p class="hint inner-hint">属性ごとに手入力できます。空欄には共通値が使われます。弱点は負の数で入力してください。</p>`;
}
function rotationSlots(){
  $('rotation-slots').innerHTML=current().agents.map((a,i)=>`
    <button type="button" class="${palette[i]}" data-rotation-slot="${i}" aria-pressed="${i===slot}">${itemImage('agent',findAgent(a)?.id??'')}<span>${escape(a.name||'枠 '+(i+1))}</span></button>`).join('');
  $('rotation-add-skill').disabled=!findAgent(editAgent());
}
function editRotationRow(index){
  activeRow=activeRow===index?-1:index;
  for(const el of $('rotation').querySelectorAll('[data-row]')){
    const open=Number(el.dataset.row)===activeRow;
    el.querySelector('.rot-edit').hidden=!open;
    el.querySelector('[data-expand-row]').setAttribute('aria-expanded',open);
    el.classList.toggle('rot-open',open);
  }
}

function showRotation() {
  const {actions,agents}=current();
  rotationSlots();
  $('rotation').innerHTML=actions.map((a,i)=>{
    const linked=linkedAction(a);
    const catalogRate=a.catalog?attackRate(agents[a.slot],a):null;
    const measured=a.kind==='fixed';
    const reaction=a.kind==='reaction';
    const voidflares=a.reaction?.voidflares;
    const who=linked?special[a.kind]:a.slot;
    const amountLabel=measured?'1回のダメージ':linked?'参照値への倍率 %':'倍率 %';
    return `<article class="rot-row ${palette[who]}${i===activeRow?' rot-open':''}" data-row="${i}">
      <div class="rot-overview">
        <button type="button" class="rot-expand" data-expand-row="${i}" aria-expanded="${i===activeRow}" aria-controls="rot-edit-${i}">
          <span class="rotation-order">${String(i+1).padStart(2,'0')}</span>${itemImage('agent',findAgent(agents[who])?.id??'')}
          <span class="rot-title"><small>${escape(agents[who].name)}</small><strong id="row-name-${i}">${escape(a.name)}</strong></span>
          <span class="rot-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="rot-dmg"><small>行動合計</small><strong id="row-total-${i}"></strong><small id="row-unit-${i}"></small></div>
      </div>
      <div class="rot-edit" id="rot-edit-${i}" ${i===activeRow?'':'hidden'}>
      <div class="rot-cell"><input aria-label="行動名 ${i+1}" placeholder="行動名" maxlength="42" data-key="name" value="${escape(a.name)}">
      <select data-key="slot" aria-label="担当エージェント ${i+1}" ${linked||a.catalog||reaction?'disabled':''}>${agents.map((m,j)=>option(String(j),m.name||'エージェント '+(j+1),String(who))).join('')}</select></div>
      <div class="rot-cell"><select data-key="kind" aria-label="ダメージ種類 ${i+1}">${Object.entries(kinds).filter(([k])=>reaction?k==='reaction':(Object.hasOwn(special,k)||k==='reaction')?k===a.kind:!a.catalog||k!=='fixed').map(([k,name])=>option(k,name,a.kind)).join('')}</select>
      ${linked||measured?`<span class="rot-static">${linked?'参照式の条件':'補正を適用済み'}</span>`:
      `<select data-key="phase" aria-label="敵の状態 ${i+1}">${option('normal','通常時',a.phase)}${option('stun','ブレイク中',a.phase)}</select>`}</div>
      <div class="rot-cell rot-quantity">
      ${reaction?`<small>${voidflares?'虚光 '+escape(voidflares.map(source=>agents[source]?.name??'—').join(' / ')):'下地 '+escape(agents[a.reaction.source]?.name??'—')}</small>`:a.catalog?`<label><small id="row-rate-${i}">${amountLabel}</small>
      <select data-rate-level aria-label="技のレベル ${i+1}" ${catalogRate?'':'disabled'}>
        ${option('0','育成設定に連動',String(a.catalog.level||0))}
        ${catalogRate?.skill.rates.map((rate,j)=>option(String(j+1),levelLabel(catalogRate.skill.group,j+1)+(rate==null?'（資料なし）':''),String(a.catalog.level||0))).join('')??''}
      </select></label>`:`<label><small>${amountLabel}</small>${numeric(a.amount,'amount',{label:amountLabel+' '+(i+1)})}</label>`}
      <label><small>回数</small>${numeric(a.count,'count',{step:1,max:10000,label:'発動回数 '+(i+1)})}</label></div>
      <div class="rot-meta">
        ${reaction?'':`<label class="field"><span>攻撃属性</span><select data-key="attribute" aria-label="攻撃属性 ${i+1}">${option('','自動（'+(attackAttribute({},findAgent(agents[a.slot]),catalogRate?.skill)||'共通耐性')+'）',a.attribute??'')}${attributes.map(attr=>option(attr,attr,a.attribute)).join('')}</select></label>`}
        ${a.catalog&&catalogRate?.amount==null?`<button type="button" class="quiet" data-use-manual="${i}">倍率を手入力</button>`:''}
      </div>
        <div class="rot-actions">
          ${detailButton('detail-action-'+i,String(i),a.name||'行動 '+(i+1))}
          <button type="button" class="quiet" data-move-row="-1" ${i===0?'disabled':''}>↑ 上へ</button>
          <button type="button" class="quiet" data-move-row="1" ${i===actions.length-1?'disabled':''}>↓ 下へ</button>
          <button type="button" class="quiet" data-copy-row>複製</button>
          <button type="button" class="quiet" data-remove="${i}" aria-label="行動 ${i+1} を削除">削除</button>
        </div>
        ${detailPanel('detail-action-'+i)}
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
  $('contributions').innerHTML=report.byAgent.map((n,i)=>{
    const percent=report.total>0?100*n/report.total:0;
    return `<div class="contribution ${palette[i]}"><div><span>${escape(current().agents[i].name||'エージェント '+(i+1))}</span><strong>${fmt(n)}</strong></div><div class="track" aria-hidden="true"><i style="width:${percent}%"></i></div></div>`;
  }).join('');
  $('comparison').innerHTML=`<div><span>編成 A</span><strong>${fmt(a)}</strong></div><div><span>編成 B</span><strong>${fmt(b)}</strong></div><div class="delta"><span>B − A</span><strong>${delta>0?'+':''}${fmt(delta)} ${relative}</strong></div>`;
  report.rows.forEach((r,i)=>{
    const a=current().actions[i];
    const rate=a.catalog?attackRate(current().agents[a.slot],a):null;
    const rateLabel=$('row-rate-'+i);
    if(rateLabel) rateLabel.textContent=rate?.amount==null?'倍率資料なし':levelLabel(rate.skill.group,rate.level)+' · '+dec(rate.amount)+'%';
    $('row-name-'+i).textContent=a.name||'名称未設定';
    $('row-total-'+i).textContent=r.each===null?'—':fmt(r.total);
    $('row-unit-'+i).textContent=r.each===null?(linkedAction(a)?'参照編成と異なります':rate?'このLvの倍率資料なし':'参照した技の資料なし'):fmt(r.each)+' / 回（平均）';
    const detail=$('detail-action-'+i);
    if(detail&&!detail.hidden)detail.innerHTML=renderDamageDetails(damageDetails(current(),{index:i}));
  });
  const m=report.members[slot];
  const display=[['攻撃力',m.atk],['HP',m.hp],['防御力',m.ownDef],['会心率 %',m.rawCr*100],['会心ダメージ %',m.cd*100],['異常マスタリー',m.ap],['異常掌握',m.am],['透徹力',m.sheer],['防御補正 %',m.def*100]];
  $('combat-stats').innerHTML=display.map(([label,n])=>`<div class="stat"><span>${label}</span><strong>${dec(n)}</strong></div>`).join('');
  $('sub-roll-total').textContent=editAgent().sub.reduce((sum,n)=>sum+(n??0),0);
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
  save();
  showResult();
}
function normalize(event,resolve) {
  const el=event.target;
  if(el.type!=='number'||!el.dataset.key) return;
  const [group,key]=el.dataset.key.split('.');
  const target=resolve(el);
  el.value=(key===undefined?target[group]:target[group]?.[key])??(group==='damageRes'?'':el.defaultValue);
}
const editAgent=()=>current().agents[slot];
const editEnemy=()=>current().enemy;
const editAction=el=>current().actions[el.closest('[data-row]').dataset.row];
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
  reactionSource=slot;
  voidflareChoices=[-1,-1,-1];
  showSkills();
  $('skill-dialog').showModal();
});
$('close-skills').addEventListener('click',()=>$('skill-dialog').close());
$('skill-body').addEventListener('change',event=>{
  const el=event.target;
  const group=el.dataset.train;
  if(group){
    (editAgent().levels??={})[group]=Number(el.value);
    if(skillGroup!=='luminize')skillGroup=group;
    previewLevel=0;
    save();showResult();showSkills();
    $('skill-body').querySelector(`[data-train="${group}"]`).focus();
  } else if(el.hasAttribute('data-voidflare')||el.id==='skill-group'||el.id==='preview-level'||el.id==='reaction-source'){
    if(el.id==='skill-group') {
      skillGroup=el.value;
      previewLevel=0;
    } else if(el.hasAttribute('data-voidflare'))voidflareChoices[Number(el.dataset.voidflare)]=Number(el.value);
    else if(el.id==='reaction-source')reactionSource=Number(el.value);
    else previewLevel=Number(el.value);
    showSkills();
    $(el.id).focus();
  }
});
$('skill-body').addEventListener('click',event=>{
  const detail=event.target.closest('[data-damage-detail]');
  if(detail){
    const id=detail.dataset.damageDetail;
    toggleDamageDetails(detail,()=>{
      if(skillGroup==='reaction'||skillGroup==='luminize'){
        const reaction=specialRows().find(row=>row.id===id);
        return damageDetails(current(),{slot,reaction});
      }
      const a=editAgent();
      const skill=findAgent(a).skills.find(row=>row.id===id);
      return damageDetails(current(),{slot,skill,level:previewLevel||effectiveLevel(a,skill)});
    });
    return;
  }
  const reactionButton=event.target.closest('[data-reaction]');
  if(reactionButton){
    const voidflares=skillGroup==='luminize'?selectedVoidflares():null;
    const choice=specialRows().find(r=>r.id===reactionButton.dataset.reaction);
    if(choice?.amount==null)return;
    activeRow=current().actions.length;
    const refs=voidflares?{voidflares}:{source:choice.source};
    current().actions.push({...action(slot,choice.name,'reaction'),reaction:{id:choice.id,...refs,agentId:findAgent(editAgent()).id}});
    save();showRotation();showResult();
    reactionButton.textContent='追加済み';
    return;
  }
  const button=event.target.closest('[data-skill]');
  if(!button) return;
  const a=editAgent();
  const entry=findAgent(a);
  const skill=entry.skills.find(row=>row.id===button.dataset.skill);
  const level=previewLevel||effectiveLevel(a,skill);
  if(skill.rates[level-1]==null) return;
  const name=skillName(skill);
  activeRow=current().actions.length;
  current().actions.push({...action(slot,name,skill.kind),
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
  rows.push(action(slot));
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
$('rotation').addEventListener('click',event=>{
  const detail=event.target.closest('[data-damage-detail]');
  if(detail){toggleDamageDetails(detail,()=>damageDetails(current(),{index:Number(detail.dataset.damageDetail)}));return;}
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
$('equipment-content').addEventListener('input',event=>setInput(event,editAgent));
$('equipment-content').addEventListener('focusout',event=>normalize(event,editAgent));

$('equipment-content').addEventListener('click',event=>{
  if(event.target.id!=='optimize-substats')return;
  const status=$('allocation-status');
  const input=$('equipment-content').querySelector('[data-key="subBudget"]');
  const budget=readInput(input);
  if(budget===null){
    status.textContent='有効ステータス数を入力してください。';
    input.focus();
    return;
  }
  allocationWorker?.terminate();
  const scenario=current();
  const agentSlot=slot;
  const snapshot=JSON.stringify(scenario);
  const button=event.target;
  const worker=new Worker(new URL('./optimizer-worker.js',import.meta.url),{type:'module'});
  allocationWorker=worker;
  button.disabled=true;
  status.textContent='最大ダメージになる配分を計算中…';
  function finish(){
    worker.terminate();
    if(allocationWorker===worker)allocationWorker=null;
    button.disabled=false;
  }
  worker.addEventListener('message',({data:counts})=>{
    finish();
    if(current()!==scenario||slot!==agentSlot||JSON.stringify(scenario)!==snapshot){
      if(status.isConnected)status.textContent='設定が変わりました。もう一度実行してください。';
      return;
    }
    if(!counts){
      status.textContent='このキャラのステータスを使うスキルを追加してください。';
      return;
    }
    scenario.agents[agentSlot].sub=counts;
    scenario.agents[agentSlot].subBudget=budget;
    save();showEquipment();showResult();
    $('allocation-status').textContent=budget+'振りを配分しました。';
    $('optimize-substats').focus();
  });
  worker.addEventListener('error',()=>{
    finish();
    status.textContent='自動配分を完了できませんでした。';
  });
  worker.postMessage({scenario,slot:agentSlot,budget});
});
show();
