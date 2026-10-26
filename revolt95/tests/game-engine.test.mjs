import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CONFIG,createGame,nextAction,autoCycles,autoUntilUltra,continueChance,expectedStats,machineRate} from '../game-engine.mjs';
function seeded(seed){let s=seed>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)/2**32);}
test('theoretical machine payout rate rounds to 99.5%',()=>{
 const x=expectedStats();assert.ok(Math.abs(x.expectedRate-99.5)<.05);assert.equal(x.meanNormalGames,180.1);assert.ok(Math.abs(x.meanCzWin-.60)<1e-12);assert.ok(Math.abs(x.meanRushPayout-1083.80188)<.001);
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


// These deterministic helpers exercise the cross-cycle qualification rather than a random ULTRA hit.
const superFromNormal=s=>{assert.equal(s.phase,'normal');nextAction(s,()=>0);nextAction(s,()=>0);nextAction(s,()=>0);for(let i=0;i<3;i++)nextAction(s,()=>0);assert.equal(s.phase,'upper');};
const loseUpper=s=>{assert.equal(s.phase,'upper');nextAction(s,()=>.999);assert.equal(s.phase,'normal');};
test('first SUPER never triggers ULTRA, second consecutive SUPER gets 25% draw',()=>{
 const s=createGame(()=>0);
 superFromNormal(s);
 assert.equal(s.cycleSuperEntered,true);
 assert.equal(s.ultraMode,false);
 assert.equal(s.ultraCount,0);
 assert.equal(s.previousCycleSuper,false);
 loseUpper(s);
 assert.equal(s.previousCycleSuper,true);
 assert.equal(s.cycleSuperEntered,false);
 superFromNormal(s);
 assert.equal(s.ultraMode,true);
 assert.equal(s.ultraCount,1);
 assert.equal(s.upperWins,0);
 assert.equal(s.atSetG,10);
 assert.equal(continueChance(s),.95);
 assert.equal(s.lastAt.mode,'rush');
 assert.equal(s.lastAt.success,true);
 assert.equal(s.totalOutput-s.totalInput,s.net);
});
test('SUPER streak survives 3+ cycles and 25% lottery failure',()=>{
 const s=createGame(()=>0);
 superFromNormal(s);loseUpper(s);
 nextAction(s,()=>0);nextAction(s,()=>0);nextAction(s,()=>0);
 nextAction(s,()=>0);nextAction(s,()=>0);
 // third 75% draw, then 25% ULTRA lottery: 0.5 means lottery failure
 let n=0;nextAction(s,()=>++n===2?.5:0);
 assert.equal(s.phase,'upper');assert.equal(s.ultraMode,false);assert.equal(s.previousCycleSuper,true);
 loseUpper(s);
 assert.equal(s.previousCycleSuper,true);
 superFromNormal(s);
 assert.equal(s.ultraMode,true);
});
test('a cycle without SUPER resets ULTRA qualification',()=>{
 const s=createGame(()=>0);
 superFromNormal(s);loseUpper(s);
 nextAction(s,()=>0);nextAction(s,()=>.999); // CZ fails this cycle
 assert.equal(s.phase,'normal');
 assert.equal(s.previousCycleSuper,false);
 superFromNormal(s);
 assert.equal(s.ultraMode,false);
 assert.equal(s.ultraCount,0);
});
test('ULTRA has 95% continuation and its own 10/20/50/200G table',()=>{
 const s=createGame(()=>0);
 superFromNormal(s);loseUpper(s);superFromNormal(s);
 assert.deepEqual(CONFIG.ultraSetLengths,[{g:10,p:.60},{g:20,p:.25},{g:50,p:.14},{g:200,p:.01}]);
 assert.equal(CONFIG.ultraContinue,.95);
 assert.equal(continueChance(s),.95);
 // A continuation selects the 200G set only on a last-percentile length draw.
 let n=0;nextAction(s,()=>++n===1?0:.999);
 assert.equal(s.atSetG,200);
 assert.equal(s.upperWins,1);
 assert.equal(continueChance(s),.95);
 const before=s.gameCount;nextAction(s,()=>.999);
 assert.equal(s.gameCount-before,200);
 assert.equal(s.lastAt.net,1800);
 assert.equal(s.lastAt.chance,.95);
 assert.equal(s.lastAt.success,false);
 assert.equal(s.phase,'normal');
 assert.equal(s.previousCycleSuper,true);
});
test('new theoretical machine rate and ULTRA frequency',()=>{
 const x=expectedStats();
 assert.equal(CONFIG.ultraEntryChance,.25);
 assert.equal(CONFIG.ultraContinue,.95);
 assert.ok(Math.abs(x.expectedRate-99.49645483956)<1e-8);
 assert.ok(Math.abs(x.ultraChancePerCycle-0.00382242722717)<1e-10);
 assert.ok(Math.abs(x.meanUltraSetGames-20)<1e-10);
 assert.ok(Math.abs(x.meanUltraUpperSets-20)<1e-9);
});
test('one-tap AUTO stops before ULTRA first set after two consecutive SUPERs',()=>{
 const s=createGame(()=>0);
 const result=autoUntilUltra(s,40,()=>s.phase==='upper'&&s.lastAt?.mode==='upper'?.999:0);
 assert.deepEqual(result,{reached:true,actions:13});
 assert.equal(s.phase,'upper');
 assert.equal(s.ultraMode,true);
 assert.equal(s.ultraCount,1);
 assert.equal(s.upperCount,2);
 assert.equal(s.upperWins,0);
 assert.equal(s.lastAt.mode,'rush');
 assert.equal(s.rushSets,3);
 assert.equal(s.lastActionGames,s.gameCount);
 const prev=s.gameCount;assert.deepEqual(autoUntilUltra(s,600,()=>0),{reached:true,actions:0});
 assert.equal(s.gameCount,prev);
});
test('one-tap AUTO can pause and resume across the streak boundary',()=>{
 const s=createGame(()=>0);
 let last;
 let count=0;
 do{last=autoUntilUltra(s,2,()=>s.phase==='upper'&&s.lastAt?.mode==='upper'?.999:0);count+=last.actions;}while(!last.reached&&count<40);
 assert.equal(count,13);
 assert.equal(last.reached,true);
 assert.equal(s.ultraCount,1);
 assert.equal(s.lastAt.mode,'rush');
});
test('AUTO-to-ULTRA uses exactly the same random draws as manual play',()=>{
 const rngA=seeded(1234),rngB=seeded(1234);
 const auto=createGame(rngA),manual=createGame(rngB);
 const {reached,actions}=autoUntilUltra(auto,1000,rngA);
 for(let i=0;i<actions;i++)nextAction(manual,rngB);
 assert.equal(auto.phase,manual.phase);
 assert.equal(auto.gameCount,manual.gameCount);
 assert.equal(auto.net,manual.net);
 assert.equal(auto.totalInput,manual.totalInput);
 assert.equal(auto.totalOutput,manual.totalOutput);
 assert.equal(auto.czCount,manual.czCount);
 assert.equal(auto.cycleCount,manual.cycleCount);
 assert.equal(auto.upperWins,manual.upperWins);
 assert.equal(auto.ultraCount,manual.ultraCount);
 assert.equal(reached,auto.phase==='upper'&&auto.ultraMode);
 assert.equal(auto.totalOutput-auto.totalInput,auto.net);
});
test('AUTO-to-ULTRA validates its chunk size',()=>{
 const s=createGame(()=>0);
 for(const value of [0,-1,1.5,100001])assert.throws(()=>autoUntilUltra(s,value,()=>0),RangeError);
});
