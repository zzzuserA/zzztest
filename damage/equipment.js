import {weapons,discStats,discSets} from './equipment-data.js';

export {weapons,discStats,discSets};
export const attributes=['物理','炎','氷','電気','エーテル','風','流明'];
export const weaponLevels=[0,10,20,30,40,50,60];
export const setByName=new Map(discSets.map(item=>[item[0],item]));
export const weaponByName=new Map(weapons.map(item=>[item.name,item]));
export const discMains=[
  ['hpFlat'],['atkFlat'],['defFlat'],
  ['atkPct','hpPct','defPct','cr','cd','ap'],
  ['atkPct','hpPct','defPct','pen',...attributes.map(attr=>'element:'+attr)],
  ['atkPct','hpPct','defPct','am','impact','energy'],
];
export const gearLabels={hpFlat:'HP固定値',atkFlat:'攻撃力固定値',defFlat:'防御力固定値',hpPct:'HP %',atkPct:'攻撃力 %',defPct:'防御力 %',
  cr:'会心率 %',cd:'会心ダメージ %',ap:'異常マスタリー',am:'異常掌握 %',impact:'衝撃力 %',energy:'エネルギー自動回復 %',pen:'貫通率 %',element:'属性ダメージ %'};
export const discReference='https://wikiwiki.jp/zenless/ドライバディスク/セット効果';
export const fourPieceConditions={
  '混沌のヘヴィメタル':'侵蝕のダメージ発生ごとに会心ダメージをさらに+5.5%、最大6重。',
  'スイング・ジャズ':'連携・終結の発動後、チームの与ダメージ+15%。',
  '獣牙のヘヴィメタル':'強撃を受けた敵への装備者の与ダメージ+35%。',
  'ホルモン・パンク':'接敵中に操作キャラになると、攻撃力+25%。',
  '霹靂のヘヴィメタル':'感電中の敵がいる間、攻撃力+28%。',
  'ショックスター・ディスコ':'通常・ダッシュ・回避反撃のメインターゲットへのブレイク値+20%。',
  'ウッドペッカー・エレクトロ':'通常・回避反撃・強化特殊で会心を出すごとに、対応する効果1重につき攻撃力+9%。',
  'ソウル・ロック':'被弾でHPが減ると、被ダメージ-40%。',
  '炎獄のヘヴィメタル':'熱傷中の敵に攻撃が当たると、会心率+28%。',
  'パファー・エレクトロ':'終結の発動後、攻撃力+15%。',
  '極地のヘヴィメタル':'凍結・砕氷の発生後、通常・ダッシュ攻撃の与ダメージをさらに+20%。',
  'フリーダム・ブルース':'強化特殊が命中すると、装備者と同じ属性の敵の状態異常蓄積耐性-20%。',
  'ケイオス・ジャズ':'控え中と出場直後、強化特殊・支援攻撃の与ダメージ+20%。',
  'プロト・パンク':'パリィ支援・回避支援の発動後、チームの与ダメージ+15%。',
  '折枝の刀歌':'凍結・砕氷の発生後、会心率+12%。',
  '静寂のアストラ':'クイック支援で出場したメンバーの与ダメージ+8%×天籟の重数（最大3重）。',
  'シャドウハーモニー':'装備者と同じ属性の追加・ダッシュ攻撃が当たると、1重あたり攻撃力・会心率+4%、最大3重。',
  '「パエトーン」の歌':'味方の強化特殊発動で装備者の異常マスタリー+45Pt。別の味方が発動した場合はエーテル与ダメージ+25%。',
  '雲嶽は我に似たり':'強化特殊・連携・終結の発動ごとに会心率+4%、最大3重。3重で透徹ダメージ+10%。',
  '大山を統べる者':'撃破役の装備者が強化特殊・連携を発動すると全員の会心ダメージ+15%。装備者の会心率50%以上でさらに+15%。',
  '暁に咲く花':'強攻役の装備者が強化特殊・終結を発動すると、通常攻撃の与ダメージをさらに+20%。',
  '月光騎士の讃歌':'支援役の装備者が強化特殊・終結を発動すると、チームの与ダメージ+18%。',
  '純白の行歌':'エーテルベールの効果中は会心率+10%。強攻役の装備者が展開・延長すると会心率と攻撃力がさらに+10%。',
  '流光のアリア':'通常攻撃命中で異常マスタリー+36Pt。敵のブレイク発生で装備者の与ダメージ+25%。',
  '雪うさぎワンダーランド':'防護役の強化特殊か味方のパリィ・回避支援で、全員の与ダメージ+6%、最大3重。',
  '獄中の手記':'装備者が狂咲を起こすと異常マスタリー+48Pt。凍結を起こすと状態異常・混沌ダメージ+16%。',
  '風鳴りのサロン':'強化特殊で異常マスタリー+25Pt、最大2重。装備者が風化を起こすと与ダメージ+18%。',
  '夜明けの紀行':'強化特殊・終結の発動後、攻撃力+10%。',
  '契る翼の運命':'入場・交代出場後および控え中は異常マスタリー+50Pt。流明の装備者は異常ダメージ+15%。',
};
const weaponSubs={'HP':'hpPct','攻撃力':'atkPct','防御力':'defPct','会心率':'cr','会心ダメージ':'cd','異常マスタリー':'ap',
  '異常掌握':'am','貫通率':'pen','衝撃力':'impact','エネルギー自動回復':'energy','エネルギー獲得効率':'energyGain'};
const steadyWeaponEffects={
  '恥じらう悪面':[[0,'element:氷']],
  'ディープシー・ビジター':[[0,'element:氷']],
  'あられ落つ星殿':[[0,'cd']],
  '複合コンパイラ':[[0,'atkCombat']],
  '鳥は夢へと羽ばたいて':[[0,'buildup']],
  '刻流の賢者':[[0,'buildup:電気']],
  '深紅の渇望':[[0,'cr'],[1,'element:電気'],[2,'sharp:電気']],
  '転生の炎翼':[[0,'ap'],[1,'element:炎']],
};
const steadyFour={
  '混沌のヘヴィメタル':[['cd',20]],
  'パファー・エレクトロ':[['ultimate',20]],
  '極地のヘヴィメタル':[['basic',20],['dash',20]],
  'ケイオス・ジャズ':[['element:炎',15],['element:電気',15]],
  '暁に咲く花':[['basic',20]],
  '棘まとう薔薇':[['dmg',15]],
};

export function baseAttribute(value='') {
  const text=String(value);
  return attributes.includes(text)?text:
    text.startsWith('霜烈')?'氷':text.startsWith('玄墨')?'エーテル':text.startsWith('凛刃')?'物理':'';
}
export function attackAttribute(action,info,skill){
  if(action.attribute)return baseAttribute(action.attribute);
  if(info?.id==='1191'&&skill&&(/鋭牙剪定法|^荒波$/.test(skill.title)||/回転斬撃/.test(skill.label)))return '物理';
  return baseAttribute(info?.attribute);
}
export function discValue(piece) {
  const key=piece.main?.startsWith('element:')?'element':piece.main;
  return discStats[key]?.[piece.rank]?.[piece.level]??null;
}
export function setCounts(pieces=[]) {
  const counts={};
  for(const {set} of pieces) {
    if(setByName.has(set)) counts[set]=(counts[set]??0)+1;
  }
  return counts;
}
export const discLayouts={pair:[4,2],trio:[2,2,2]};
export function equippedSetCounts(config={}){
  const selection=config.discSelection;
  if(!selection)return setCounts(config.discs);
  const sizes=discLayouts[selection.mode]??[];
  const counts={};
  sizes.forEach((size,i)=>{
    const name=selection.names[i];
    if(setByName.has(name)&&!Object.hasOwn(counts,name))counts[name]=size;
  });
  return counts;
}
export function discSelection(config={}){
  if(config.discSelection)return config.discSelection;
  const entries=Object.entries(setCounts(config.discs)).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]);
  return {mode:entries[0]?.[1]<4?'trio':'pair',names:entries.map(([name])=>name)};
}
export function equipmentStats(agent,info,record,{passives=false,setBonuses=false}={}) {
  const config=agent.equipment??{};
  const weapon=weaponByName.get(config.weapon);
  const level=weaponLevels.indexOf(config.weaponLevel??60);
  const stats={};
  const add=(key,value,source)=>{
    if(key&&Number.isFinite(value)){
      stats[key]=(stats[key]??0)+value;
      if(source&&value)record?.(source,key,value);
    }
  };
  if(weapon&&weapon.base[level]!=null){
    add(weapon.baseKind==='atk'?'weaponAtk':'weaponDef',weapon.base[level],'音動機の基礎値');
    add(weaponSubs[weapon.subName],weapon.sub[level],'音動機の上級ステータス');
    if(passives&&info?.specialty===weapon.role){
      for(const [index,key] of steadyWeaponEffects[weapon.name]??[]){
        add(key,weapon.passives[index]?.[1][(config.refine??1)-1],'音動機の効果');
      }
    }
  }
  for(const piece of config.discs??[]) add(piece.main,discValue(piece));
  const counts=equippedSetCounts(config);
  for(const [name,count] of Object.entries(counts)){
    if(count<2)continue;
    const [,key,value]=setByName.get(name);
    if(setBonuses)add(key,value,name+' 2セット');
    if(count<4||!passives)continue;
    for(const [stat,bonus] of steadyFour[name]??[])add(stat,bonus,name+' 4セット');
    if(name==='夜明けの紀行'&&baseAttribute(info?.attribute)==='エーテル')add('cd',30,name+' 4セット');
  }
  return {stats,counts,weapon};
}
export function damageBonusForAttack(gear,attribute,type) {
  return (gear['element:'+attribute]??0)+(gear[type]??0)+
    (type==='dash'||type==='after'?(gear.dashAfter??0):0);
}
