import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CONFIG,createGame,nextAction,autoCycles,continueChance,expectedStats,machineRate} from '../game-engine.mjs';
function seeded(seed){let s=seed>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)/2**32);}
test('theoretical machine payout rate rounds to 99.5%',()=>{
 const x=expectedStats();assert.ok(Math.abs(x.expectedRate-99.51286423)<.0001);assert.equal(x.meanNormalGames,29.1);assert.ok(Math.abs(x.meanRushPayout-1061.795)<.001);
});
test('normal game is consumed in exactly one action and transfers to CZ',()=>{
 const s=createGame(()=>0); assert.equal(s.targetG,1);nextAction(s,()=>0);assert.equal(s.phase,'cz');assert.equal(s.gameCount,1);assert.equal(s.totalInput,20);assert.equal(s.net,-20);
});
test('CZ can fail and finish cycle',()=>{const s=createGame(()=>0);nextAction(s,()=>0);nextAction(s,()=>.99);assert.equal(s.phase,'normal');assert.equal(s.cycleCount,1);assert.equal(s.czCount,1);});
test('guaranteed win path reaches upper at three successful continuations',()=>{
 const s=createGame(()=>0);nextAction(s,()=>0);nextAction(s,()=>0);assert.equal(s.phase,'bonus');assert.equal(s.bonus,'revolution');nextAction(s,()=>0);assert.equal(s.phase,'rush');for(let i=0;i<3;i++)nextAction(s,()=>0);assert.equal(s.phase,'upper');assert.equal(s.upperCount,1);assert.equal(continueChance(s),.9);
});
test('upper progression ends at exactly 95%',()=>{
 const s=createGame(()=>0);nextAction(s,()=>0);nextAction(s,()=>0);nextAction(s,()=>0);for(let i=0;i<3;i++)nextAction(s,()=>0);for(let i=0;i<20;i++)nextAction(s,()=>0);assert.equal(s.phase,'upper');assert.equal(s.upperWins,20);assert.equal(continueChance(s),.95);
});
test('every amount reconciles input, output and bankroll',()=>{
 const s=createGame(seeded(8));autoCycles(s,300,seeded(123));assert.equal(s.totalOutput-s.totalInput,s.net);assert.equal(s.bank,CONFIG.initialBank+s.net);assert.equal(s.cycleCount,300);assert.equal(s.phase,'normal');assert.ok(machineRate(s)>0);
});
test('long-run simulation converges toward payout',()=>{
 const s=createGame(seeded(10));autoCycles(s,140000,seeded(98765));
 const rate=machineRate(s);assert.ok(Math.abs(rate-99.51286423)<1.3,`observed ${rate}`);
});


test('new normal-mode G distribution totals 100%, keeps 20 BET and caps at 75G',()=>{
 assert.ok(Math.abs(CONFIG.normalG.reduce((sum,x)=>sum+x.p,0)-1)<1e-12);
 assert.equal(CONFIG.normalBet,20);
 assert.equal(Math.max(...CONFIG.normalG.map(x=>x.g)),75);
 assert.equal(CONFIG.upperCap,.95);
});
test('normal mode maximum draw is 75G and is still a single tap',()=>{
 const s=createGame(()=>1-1e-15); assert.equal(s.targetG,75);
 nextAction(s,()=>0); assert.equal(s.gameCount,75); assert.equal(s.phase,'cz');
 assert.equal(s.totalInput,1500);
});
