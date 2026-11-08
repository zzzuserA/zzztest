import {findAgent,attackRate} from './catalog.js';
import {attackAttribute,equippedSetCounts} from './equipment.js';
import {blankEffect} from './timeline.js';

const wiki='https://wikiwiki.jp/zenless/';
const support=wiki+'音動機/支援';
const discs=wiki+'ドライバディスク/セット効果';
const deepSea='https://wiki.hoyolab.com/pc/zzz/entry/85';

const effect=(id,name,stat,amount,duration,extra)=>({id,...blankEffect(),name,stat,amount,duration,...extra});
const team={target:'team'};
const presets=[
  effect('nicole-def','ニコ・からくり箱','def',40,3.5,{...team,agentId:'1031',source:wiki+'ニコ',coreValues:[20,25,30,34,36,38,40],condition:'力場または強化弾が命中'}),
  effect('nicole-ether','ニコ・狡兎三窟','elementDmg',25,3.5,{...team,agentId:'1031',attribute:'エーテル',source:wiki+'ニコ',condition:'追加能力が有効で、防御ダウンが発動'}),
  effect('lucy-tap','ルーシー・かっとばせ！（短押し・上限）','atkFlat',600,10,{...team,agentId:'1151',source:wiki+'ルーシー',condition:'ホームランの短押し。実際の攻撃力バフが上限未満なら効果量を調整'}),
  effect('lucy-hold','ルーシー・かっとばせ！（長押し・上限）','atkFlat',600,15,{...team,agentId:'1151',source:wiki+'ルーシー',condition:'ホームランの長押し。実際の攻撃力バフが上限未満なら効果量を調整'}),
  effect('caesar-shield','シーザー・栄光の盾','atkFlat',1000,60,{...team,agentId:'1071',coreValues:[40,125,240,400,650,900,1000],source:wiki+'シーザー',condition:'栄光の盾の所持者のみ。盾が途中で消える場合は持続を調整'}),
  effect('lycaon-ice','ライカン・フルメタル・レッグ','res',25,30,{...team,agentId:'1141',attribute:'氷',source:wiki+'ライカン',condition:'強化特殊スキルまたは支援突撃が命中'}),
  effect('lycaon-stun','ライカン・優雅なる狩人','stun',35,10,{...team,agentId:'1141',source:wiki+'ライカン',condition:'追加能力が有効で、ブレイク中の敵に命中。持続は残りブレイク時間に設定'}),
  effect('visitor-basic','ディープシー・ビジター・通常攻撃','cr',0,8,{weapon:'ディープシー・ビジター',weaponRow:1,source:deepSea,condition:'通常攻撃が命中'}),
  effect('visitor-dash','ディープシー・ビジター・氷ダッシュ攻撃','cr',0,15,{weapon:'ディープシー・ビジター',weaponRow:2,source:deepSea,condition:'ダッシュ攻撃で氷属性ダメージ'}),
  effect('bird-ap','鳥は夢へと羽ばたいて・異常マスタリー','ap',0,5,{weapon:'鳥は夢へと羽ばたいて',weaponRow:1,stacks:6,cooldown:0.5,source:wiki+'ビビアン',condition:'装備者がエーテル属性ダメージを与える'}),
  effect('vault','ザ・ボールト・チーム与ダメージ','dmg',0,2,{...team,weapon:'ザ・ボールト',weaponRow:0,source:support,condition:'強化特殊・連携・終結でエーテル属性ダメージ'}),
  effect('demon','恥じらう悪面・チーム攻撃力','atkCombat',0,12,{...team,weapon:'恥じらう悪面',weaponRow:1,stacks:4,source:support,condition:'装備者が強化特殊スキルを発動'}),
  effect('puffer','パファー・エレクトロ・攻撃力','atkCombat',15,12,{set:'パファー・エレクトロ',timing:'before',source:discs,condition:'4セット装備者が終結スキルを発動'}),
  effect('dawn','暁に咲く花・通常攻撃ダメージ','basicDmg',20,25,{set:'暁に咲く花',role:'強攻',timing:'before',source:discs,condition:'4セット装備の強攻が強化特殊または終結を発動'}),
  effect('lullaby','月光騎士の讃歌・チーム与ダメージ','dmg',18,25,{...team,set:'月光騎士の讃歌',role:'支援',timing:'before',source:discs,condition:'4セット装備の支援が強化特殊または終結を発動'}),
  effect('aria','流光のアリア・異常マスタリー','ap',36,8,{set:'流光のアリア',source:discs,condition:'4セット装備者の通常攻撃が命中'}),
  effect('salon','風鳴りのサロン・異常マスタリー','ap',25,40,{set:'風鳴りのサロン',stacks:2,timing:'before',source:discs,condition:'4セット装備者が強化特殊スキルを発動'}),
  effect('sky','夜明けの紀行・攻撃力','atkCombat',10,30,{set:'夜明けの紀行',timing:'before',source:discs,condition:'4セット装備者が強化特殊または終結を発動'}),
  effect('jazz','スイング・ジャズ・チーム与ダメージ','dmg',15,12,{...team,set:'スイング・ジャズ',source:wiki+'ライカン',condition:'4セット装備者が連携または終結を発動'}),
];
export function effectPresets(agent){
  const info=findAgent(agent);
  const id=info?.id;
  const counts=equippedSetCounts(agent.equipment);
  return presets.filter(p=>(!p.role||p.role===info?.specialty)&&
    (p.agentId&&p.agentId===id||p.weapon&&p.weapon===agent.equipment?.weapon||p.set&&counts[p.set]>=4))
    .map(p=>p.coreValues?{...p,amount:p.coreValues[(agent.levels?.core??7)-1]}:p);
}
export function automaticEffects(action,agent) {
  if(!action.catalog||action.autoEffects===false)return [];
  const rate=attackRate(agent,action);
  if(rate?.amount==null)return [];
  const {skill}=rate;
  const title=skill.title;
  const attr=attackAttribute(action,findAgent(agent),skill);
  return effectPresets(agent).filter(p=>{
    if(action.effects?.some(rule=>rule.id===p.id))return false;
    switch(p.id){
      case 'nicole-def':return /力場ダメージ倍率/.test(skill.label);
      case 'puffer':return /^終結スキル/.test(title);
      case 'dawn':
      case 'lullaby':
      case 'sky':return /^(強化特殊スキル|終結スキル)/.test(title);
      case 'salon':return /^強化特殊スキル/.test(title);
      case 'aria':return skill.group==='basic';
      case 'lycaon-ice':return /^(強化特殊スキル|支援突撃)/.test(title);
      case 'visitor-basic':return skill.group==='basic';
      case 'visitor-dash':return attr==='氷'&&/^ダッシュ攻撃/.test(title);
      case 'bird-ap':return attr==='エーテル'&&skill.group!=='core';
      case 'vault':return attr==='エーテル'&&/^(強化特殊スキル|連携スキル|終結スキル)/.test(title);
      case 'demon':return /^強化特殊スキル/.test(title);
      case 'jazz':return /^(連携スキル|終結スキル)/.test(title);
      default:return false;
    }
  });
}
