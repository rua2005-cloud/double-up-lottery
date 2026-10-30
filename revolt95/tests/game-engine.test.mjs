import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildStandalone} from '../build-standalone.mjs';
import {CONFIG,createGame,nextAction,autoCycles,continueChance,expectedStats,machineRate} from '../game-engine.mjs';
function seeded(seed){let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function near(a,b,eps=1e-8){assert.ok(Math.abs(a-b)<eps,`${a} differs from ${b}`);}
function superEntry(s,nextGDraw=0){
 nextAction(s,()=>0); // normal
 nextAction(s,()=>0); // CZ succeeds
 nextAction(s,()=>0); // revolution bonus enters AT
 for(let i=0;i<2;i++)nextAction(s,()=>0); // first two 75% continuations
 let n=0;nextAction(s,()=>++n===2?nextGDraw:0); // third win -> SUPER and select first SUPER set
 assert.equal(s.phase,'upper');
 assert.equal(s.rushSets,3);
 assert.equal(s.upperCap,.90);
}
test('theoretical RTP is exactly the new target at the 80-set limit',()=>{
 const x=expectedStats();
 near(x.expectedRate,97.99896605024216,1e-9);
 near(x.meanNormalSetGames,12.25);
 near(x.meanSuperSetGames,23.8);
 near(x.meanUpperSets,8.755012681221242);
 near(x.atChancePerCZ,.2931);
 near(x.superChancePerCycle,.1236515625);
 assert.equal(CONFIG.maxAtSets,80);
});
test('normal game and CZ probabilities remain unchanged',()=>{
 assert.deepEqual(CONFIG.normalG,[{g:5,p:.15},{g:35,p:.15},{g:160,p:.31},{g:300,p:.29},{g:375,p:.10}]);
 assert.deepEqual(CONFIG.normalG.map(x=>CONFIG.czWinByNormalG[x.g]),[.45,.5,.55,.7,.84]);
 const s=createGame(()=>0);
 nextAction(s,()=>0);
 assert.equal(s.phase,'cz');
 assert.equal(s.totalInput,15);
 assert.equal(s.gameCount,5);
 nextAction(s,()=>.999);
 assert.equal(s.phase,'normal');
 assert.equal(s.cycleCount,1);
});
test('normal RUSH remains 75% with 10/20/50G sets',()=>{
 assert.equal(CONFIG.normalRushContinue,.75);
 assert.deepEqual(CONFIG.setLengths,[{g:10,p:.85},{g:20,p:.125},{g:50,p:.025}]);
 assert.equal(CONFIG.netPerAtGame,9);
});
test('SUPER uses 85-90% and 10/20/50/100/200G sets',()=>{
 assert.equal(CONFIG.upperStart,.85);
 assert.equal(CONFIG.upperCap,.90);
 assert.equal(CONFIG.upperIncrement,.01);
 assert.deepEqual(CONFIG.upperSetLengths,[
  {g:10,p:.605},{g:20,p:.15},{g:50,p:.205},{g:100,p:.035},{g:200,p:.005}
 ]);
 near(CONFIG.upperSetLengths.reduce((a,x)=>a+x.p,0),1);
 const s=createGame(()=>0);superEntry(s);
 const rates=[.85,.86,.87,.88,.89,.90,.90];
 for(let i=0;i<rates.length;i++){
  near(continueChance(s),rates[i]);
  nextAction(s,()=>0);
 }
 assert.equal(s.super90Count,1);
 assert.equal(s.upperWins,7);
});
test('SUPER 100G and 200G are actually playable and pay +9 coins per G',()=>{
 for(const [draw,g] of [[.97,100],[.999,200]]){
  const s=createGame(()=>0);superEntry(s,draw);
  assert.equal(s.atSetG,g);
  const before=s.gameCount,bet=s.totalInput,out=s.totalOutput;
  nextAction(s,()=>.999); // no continuation
  assert.equal(s.gameCount-before,g);
  assert.equal(s.totalInput-bet,3*g);
  assert.equal(s.totalOutput-out,12*g);
  assert.equal(s.lastAt.net,9*g);
  assert.equal(s.detailRows[0]['superSet'+g],1);
 }
});
test('80th AT set pays out and forcibly ends without a continuation draw',()=>{
 const s=createGame(()=>0);superEntry(s);
 for(let i=0;i<77;i++)nextAction(s,()=>0);
 assert.equal(s.phase,'normal');
 assert.equal(s.cycleCount,1);
 assert.equal(s.max80Count,1);
 assert.equal(s.super90Count,1);
 assert.equal(s.maxRushGain,80*10*9);
 assert.equal(s.lastAt.set,80);
 assert.equal(s.lastAt.capReached,true);
 assert.equal(s.lastAt.success,false);
 assert.equal(s.detailRows[0].rushSets,3);
 assert.equal(s.detailRows[0].superSets,77);
 assert.equal(s.detailRows[0].max80Reached,true);
 assert.equal(s.detailRows[0].superAttempts.reduce((a,b)=>a+b,0),76);
});
test('a loaded old 80+ set state cannot play an 81st set',()=>{
 const s=createGame(()=>0);superEntry(s);
 s.rushSets=83;
 const before=s.gameCount;
 nextAction(s,()=>0);
 assert.equal(s.gameCount,before);
 assert.equal(s.phase,'normal');
 assert.equal(s.max80Count,1);
});
test('AUTO preserves bets, payouts, bankroll, G, cycle details, and set counts',()=>{
 const s=createGame(seeded(8));autoCycles(s,600,seeded(123));
 assert.equal(s.cycleCount,600);
 assert.equal(s.totalOutput-s.totalInput,s.net);
 assert.equal(s.bank,CONFIG.initialBank+s.net);
 assert.equal(s.lastActionGames,s.gameCount);
 for(const k of ['input','output','net']){
  const field=k==='input'?'totalInput':k==='output'?'totalOutput':'net';
  assert.equal(s.detailRows.reduce((a,r)=>a+r[k],0),s[field]);
 }
 for(const row of s.detailRows){
  assert.equal(row.rushSets+row.superSets,
    [10,20,50,100,200].reduce((a,g)=>a+(row['set'+g]||0),0));
  assert.ok(row.rushSets+row.superSets<=80);
 }
});
test('AUTO is exactly reproducible by manual play with the same seeded RNG',()=>{
 const aRand=seeded(456),bRand=seeded(456),a=createGame(aRand),b=createGame(bRand);
 autoCycles(a,500,aRand);
 while(b.cycleCount<500)nextAction(b,bRand);
 for(const key of ['gameCount','cycleCount','net','totalInput','totalOutput','upperCount','super90Count','max80Count']){
  assert.equal(a[key],b[key],key);
 }
});
test('long-run results approach 98% on seeded runs',()=>{
 const s=createGame(seeded(10));
 autoCycles(s,140000,seeded(98765));
 const r=machineRate(s);
 assert.ok(Math.abs(r-97.99896605024216)<1.5,`observed ${r}`);
});

test('offline HTML contains exactly the current game and executes only after DOM markup',()=>{
  const html=readFileSync(new URL('../standalone.html',import.meta.url),'utf8');
  assert.equal(html,buildStandalone());
  const bodyStart=html.indexOf('<body'),jsStart=html.indexOf('<script>'),bodyEnd=html.lastIndexOf('</body>');
  assert.ok(bodyStart>=0&&bodyStart<jsStart&&jsStart<bodyEnd,'script must be inside the end of body');
  assert.ok(html.indexOf('id="playButton"')<jsStart,'all controls must exist before app starts');
  assert.ok(html.includes('maxAtSets:80')&&html.includes('upperStart:.85'),'the current game engine must be embedded');
  assert.equal((html.match(/<script>/g)||[]).length,1,'exactly one executable inline script');
});
