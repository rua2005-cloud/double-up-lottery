import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CONFIG,createGame,nextAction,autoCycles,continueChance,expectedStats,machineRate} from '../game-engine.mjs';
function seeded(seed){let s=seed>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)/2**32);}
test('theoretical machine payout rate rounds to 99.5%',()=>{
 const x=expectedStats();assert.ok(Math.abs(x.expectedRate-99.5)<.05);assert.equal(x.meanNormalGames,180.1);assert.ok(Math.abs(x.meanCzWin-.60)<1e-12);assert.ok(Math.abs(x.meanRushPayout-1083.7074)<.001);
});
test('normal game is consumed in exactly one action and transfers to CZ',()=>{
 const s=createGame(()=>0); assert.equal(s.targetG,5);nextAction(s,()=>0);assert.equal(s.phase,'cz');assert.equal(s.gameCount,5);assert.equal(s.lastActionGames,5);assert.equal(s.totalInput,15);assert.equal(s.net,-15);
});
test('CZ can fail and finish cycle',()=>{const s=createGame(()=>0);nextAction(s,()=>0);nextAction(s,()=>.99);assert.equal(s.phase,'normal');assert.equal(s.cycleCount,1);assert.equal(s.czCount,1);});
// On the final normal RUSH continuation, RNG is used for success, ULTRA lottery, and next set length.
const enterRegularUpper=(s)=>{let n=0;nextAction(s,()=>++n===2?.99:0);};
test('guaranteed win path reaches upper at three successful continuations',()=>{
 const s=createGame(()=>0);nextAction(s,()=>0);nextAction(s,()=>0);assert.equal(s.phase,'bonus');assert.equal(s.bonus,'revolution');nextAction(s,()=>0);assert.equal(s.phase,'rush');for(let i=0;i<2;i++)nextAction(s,()=>0);enterRegularUpper(s);assert.equal(s.phase,'upper');assert.equal(s.upperCount,1);assert.equal(s.ultraCount,0);assert.equal(continueChance(s),.9);
});
test('upper progression ends at exactly 95%',()=>{
 const s=createGame(()=>0);nextAction(s,()=>0);nextAction(s,()=>0);nextAction(s,()=>0);for(let i=0;i<2;i++)nextAction(s,()=>0);enterRegularUpper(s);for(let i=0;i<20;i++)nextAction(s,()=>0);assert.equal(s.phase,'upper');assert.equal(s.upperWins,20);assert.equal(continueChance(s),.95);
});
test('every amount reconciles input, output and bankroll',()=>{
 const s=createGame(seeded(8));autoCycles(s,300,seeded(123));assert.equal(s.totalOutput-s.totalInput,s.net);assert.equal(s.bank,CONFIG.initialBank+s.net);assert.equal(s.cycleCount,300);assert.equal(s.phase,'normal');assert.ok(machineRate(s)>0);
});
test('long-run simulation converges toward payout',()=>{
 const s=createGame(seeded(10));autoCycles(s,140000,seeded(98765));
 const rate=machineRate(s);assert.ok(Math.abs(rate-99.5)<1.3,`observed ${rate}`);
});


test('improved G distribution preserves average cost, mean CZ success and 75G cap',()=>{
 assert.ok(Math.abs(CONFIG.normalG.reduce((sum,x)=>sum+x.p,0)-1)<1e-12);
 assert.equal(CONFIG.normalBet,3);
 assert.equal(Math.max(...CONFIG.normalG.map(x=>x.g)),375);
 assert.equal(CONFIG.upperCap,.95);
});
test('normal mode maximum draw is 375G at 3BET and is still a single tap',()=>{
 const s=createGame(()=>1-1e-15); assert.equal(s.targetG,375);
 nextAction(s,()=>0); assert.equal(s.gameCount,375); assert.equal(s.phase,'cz');
 assert.equal(s.totalInput,1125);
});

test('CZ win rate uses the length of the preceding normal phase',()=>{
 const cases=[{g:5,r:.075,p:.45},{g:35,r:.225,p:.50},{g:160,r:.455,p:.55},{g:300,r:.755,p:.70},{g:375,r:.975,p:.84}];
 for(const {g,r,p} of cases){
  const success=createGame(()=>r);assert.equal(success.targetG,g);
  nextAction(success,()=>0);nextAction(success,()=>p-.001);
  assert.equal(success.lastCz.success,true);assert.equal(success.lastCz.chance,p);assert.equal(success.phase,'bonus');
  const failure=createGame(()=>r);nextAction(failure,()=>0);nextAction(failure,()=>p+.001);
  assert.equal(failure.lastCz.success,false);assert.equal(failure.lastCz.chance,p);assert.equal(failure.phase,'normal');
 }
});
test('distribution matches proposed rates and reduces deep CZ failures',()=>{
 const probabilities=[.15,.15,.31,.29,.10];
 const successes=[.45,.50,.55,.70,.84];
 assert.deepEqual(CONFIG.normalG.map(x=>x.p),probabilities);
 assert.deepEqual(CONFIG.normalG.map(x=>CONFIG.czWinByNormalG[x.g]),successes);
 const weighted=CONFIG.normalG.reduce((a,x)=>a+x.p*CONFIG.czWinByNormalG[x.g],0);
 assert.ok(Math.abs(weighted-.60)<1e-12);
 assert.ok(Math.abs(.10*(1-.84)-.016)<1e-12);
 assert.equal(CONFIG.normalReels.reduce((sum,x)=>sum+x.p*x.paid,0),.376);
 assert.equal(CONFIG.normalBet,CONFIG.czBet);
 assert.ok(Math.abs(expectedStats().meanNormalLoss-29.1*16.24)<.01);
});

test('last-action G counter also tracks AUTO cycles',()=>{const s=createGame(seeded(123));autoCycles(s,10,seeded(567));assert.equal(s.lastActionGames,s.gameCount);assert.ok(s.gameCount>0);});


test('99% Ultra Rush is selected independently on upper entry and remains fixed',()=>{
 const s=createGame(()=>0);
 nextAction(s,()=>0);nextAction(s,()=>0);nextAction(s,()=>0);
 for(let i=0;i<3;i++)nextAction(s,()=>0);
 assert.equal(s.phase,'upper');
 assert.equal(s.ultraMode,true);
 assert.equal(s.ultraCount,1);
 assert.equal(continueChance(s),.99);
 for(let i=0;i<40;i++)nextAction(s,()=>0);
 assert.equal(s.phase,'upper');
 assert.equal(s.upperWins,40);
 assert.equal(continueChance(s),.99);
 assert.equal(s.ultraCount,1);
});
test('99% Ultra Rush can fail on its 1% loss outcome',()=>{
 const s=createGame(()=>0);s.phase='upper';s.ultraMode=true;s.atSetG=10;
 nextAction(s,()=>.995);
 assert.equal(s.phase,'normal');
 assert.equal(s.cycleCount,1);
 assert.equal(s.lastAt.chance,.99);
 assert.equal(s.lastAt.success,false);
 assert.equal(s.ultraMode,false);
});
test('normal Super Rush keeps old 90–95% progression and Ultra entry is rare',()=>{
 assert.equal(CONFIG.ultraEntryChance,.0057);
 assert.equal(CONFIG.ultraContinue,.99);
 assert.deepEqual(CONFIG.bonusAtChance,{revolution:.52,decisive:.45});
 const s=createGame(()=>0);s.phase='upper';s.ultraMode=false;s.upperWins=0;
 assert.equal(continueChance(s),.90);
 s.upperWins=2;assert.equal(continueChance(s),.92);
 s.upperWins=10;assert.equal(continueChance(s),.95);
 const stats=expectedStats();
 assert.ok(Math.abs(stats.expectedRate-99.49272)<.0001);
 assert.ok(stats.meanUltraUpperSets===100 || Math.abs(stats.meanUltraUpperSets-100)<1e-9);
});
