import {weapons,discStats,discSets,enemyProfiles} from './equipment-data.js';

export {weapons,discStats,discSets,enemyProfiles};
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
export function equipmentStats(agent,info) {
  const config=agent.equipment??{};
  const weapon=weaponByName.get(config.weapon);
  const level=weaponLevels.indexOf(config.weaponLevel??60);
  const stats={};
  const add=(key,value)=>{if(key&&Number.isFinite(value))stats[key]=(stats[key]??0)+value;};
  if(weapon&&weapon.base[level]!=null){
    add(weapon.baseKind==='atk'?'weaponAtk':'weaponDef',weapon.base[level]);
    add(weaponSubs[weapon.subName],weapon.sub[level]);
    if(info?.specialty===weapon.role){
      for(const [index,key] of steadyWeaponEffects[weapon.name]??[]){
        add(key,weapon.passives[index]?.[1][(config.refine??1)-1]);
      }
    }
  }
  for(const piece of config.discs??[]) add(piece.main,discValue(piece));
  const counts=equippedSetCounts(config);
  for(const [name,count] of Object.entries(counts)){
    if(count<2)continue;
    const [,key,value]=setByName.get(name);
    add(key,value);
    if(count<4)continue;
    for(const [stat,bonus] of steadyFour[name]??[])add(stat,bonus);
    if(name==='夜明けの紀行'&&baseAttribute(info?.attribute)==='エーテル')add('cd',30);
  }
  return {stats,counts,weapon};
}
export function damageBonusForAttack(gear,attribute,type) {
  return (gear['element:'+attribute]??0)+(gear[type]??0)+
    (type==='dash'||type==='after'?(gear.dashAfter??0):0);
}
