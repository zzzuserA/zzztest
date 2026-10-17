const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const nodes=new Map(),storage=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{value:['specialty','rarity','bangbooAttribute'].includes(id)?'all':'',dataset:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},setAttribute(){},querySelector(){return node(id+'child')},querySelectorAll(){return []},click(){this.onclick?.({target:this})}});return nodes.get(id)}
const ctx={console,setTimeout(){},clearTimeout(){},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:node,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},documentElement:{clientWidth:1100,clientHeight:900}},window:{},URL,Blob,Map,Set};vm.createContext(ctx);
for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(match[1].trim())vm.runInContext(match[1],ctx);
let count=0;function check(code){assert(vm.runInContext(code,ctx),code);count++}
check('teams.length===9 && teams.every(t=>t.every(x=>x===null))');
check('AGENTS.length>50 && BANGBOOS.length>30');
check('(()=>{add(0);return teams[0][0][1]===AGENTS[0][1]})()');
check('!canAdd(AGENTS[0])');check('load()[0][0][1]===teams[0][0][1]');
check('(()=>{teams=Array.from({length:9},()=>[null,null,null]);const a=AGENTS.find(a=>a[2]==="支援");teams[0][0]=a;active=1;return !canAdd(a)})()');
check('(()=>{active=3;return canAdd(teams[0][0])})()');
check('(()=>{teams[3][0]=teams[0][0];active=6;return !canAdd(teams[0][0])})()');
check('validAgentLayout()');
check('(()=>{teams[6][0]=teams[0][0];const r=enforceMatrixAgentRules();return r.length===1&&teams[6][0]===null})()');
check('(()=>{teams=Array.from({length:9},()=>[null,null,null]);teams[0][0]=AGENTS[0];performTeamDrop("agent","0,0",{dataset:{slot:"1,1"}},null);return !teams[0][0]&&teams[1][1][1]===AGENTS[0][1]})()');
check('(()=>{teams[1][0]=AGENTS[1];performTeamDrop("agent","1,0",{dataset:{slot:"1,1"}},null);return teams[1][1][1]===AGENTS[1][1]&&teams[1][0][1]===AGENTS[0][1]})()');
check('(()=>{bangboos[0]=BANGBOOS[0];performTeamDrop("bangboo","0",null,{dataset:{bangbooSlot:"3"}});return bangboos[3][1]===BANGBOOS[0][1]&&!bangboos[0]})()');
check('loadBangboos()[3][1]===BANGBOOS[0][1]');
for(let m=0;m<=6;m++)for(let w=0;w<=4;w++){check(`agentCost(['','test','強攻','S'],{char:${m}})===${m+1}`);check(`weaponCost({weapon:${w},weaponType:'limited'},['','test','強攻','S'])===${w+1}`)}
check('weaponCost({weapon:4,weaponType:"恒常"},AGENTS[0])===0');
check('weaponCost({weapon:4,weaponType:"permanent"},AGENTS[0])===0');
check('(()=>{noOverlap=false;teams[4][0]=teams[1][0];$("ruleToggle").onclick();return noOverlap&&validAgentLayout()})()');
check('(()=>{const before=showConv;$("convDisplayToggle").onclick();return showConv!==before})()');
check('(()=>{const before=showBangboo;$("bangbooToggle").onclick();return showBangboo!==before})()');
check('(()=>{$("confirmReset").onclick();return teams.every(t=>t.every(x=>!x))&&bangboos.every(x=>!x)})()');
console.log(`${count} logic checks passed (DOM stub; not a browser test)`);
