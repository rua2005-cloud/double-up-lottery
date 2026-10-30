import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CONFIG,createGame,nextAction,autoCycles,continueChance,expectedStats,machineRate} from '../game-engine.mjs';
function seeded(seed){let s=seed>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)/2**32);}
test('current design RTP and SUPER expectations',()=>{
 const x=expectedStats();
 assert.ok(Math.abs(x.expectedRate-97.80980581709773)<1e-8);
 assert.ok(Math.abs(x.meanNormalGames-180.1)<1e-9);
 assert.ok(Math.abs(x.atChancePerCZ-.2931)<1e-9);
 assert.ok(Math.abs(x.superChancePerCycle-.1236515625)<1e-9);
 assert.ok(Math.abs(x.meanUpperSetsAt94-15.15142)<1e-5);
 assert.ok(Math.abs(x.meanUpperSetsAt95-17.34706072)<1e-5);
});
test('current CZ and set distributions',()=>{
 assert.deepEqual(CONFIG.normalG,[{g:5,p:.15},{g:35,p:.15},{g:160,p:.31},{g:300,p:.29},{g:375,p:.10}]);
 assert.deepEqual(CONFIG.normalG.map(x=>CONFIG.czWinByNormalG[x.g]),[.45,.5,.55,.7,.84]);
 assert.deepEqual(CONFIG.setLengths,[{g:10,p:.85},{g:20,p:.125},{g:50,p:.025}]);
 assert.equal(CONFIG.upperCap94,.94);
 assert.equal(CONFIG.upperCap95,.95);
 assert.equal(CONFIG.upperCap95Chance,.8);
 assert.equal(CONFIG.normalRushContinue,.75);
 assert.equal(CONFIG.netPerAtGame,9);
});
test('one normal action consumes its G and 3BET',()=>{
 const s=createGame(()=>0);nextAction(s,()=>0);
 assert.equal(s.phase,'cz');assert.equal(s.gameCount,5);assert.equal(s.totalInput,15);
 assert.equal(s.net,-15);
 const deep=createGame(()=>1-1e-15);nextAction(deep,()=>0);
 assert.equal(deep.gameCount,375);assert.equal(deep.totalInput,1125);
});
function reachSuper(s,cap){
 nextAction(s,()=>0);nextAction(s,()=>0);nextAction(s,()=>0);
 for(let i=0;i<2;i++)nextAction(s,()=>0);
 let n=0;nextAction(s,()=>++n===2?cap:0);
 assert.equal(s.phase,'upper');
}
test('SUPER 95% ceiling selected 80% of draws and reached after five successes',()=>{
 const s=createGame(()=>0);reachSuper(s,.79);
 assert.equal(s.upperCap,.95);assert.equal(s.cap95Count,1);
 assert.equal(continueChance(s),.90);assert.equal('ultraMode' in s,false);
 for(let i=0;i<6;i++)nextAction(s,()=>0);
 assert.equal(continueChance(s),.95);
});
test('SUPER 94% ceiling selected 20% of draws and reached after four successes',()=>{
 const s=createGame(()=>0);reachSuper(s,.8);
 assert.equal(s.upperCap,.94);assert.equal(s.cap94Count,1);
 for(let i=0;i<5;i++)nextAction(s,()=>0);
 assert.equal(continueChance(s),.94);
 nextAction(s,()=>.999);assert.equal(s.phase,'normal');
 assert.equal(s.detailRows[0].superReached,true);
});
test('95% cap selection is distinct from reaching the ceiling',()=>{
 const s=createGame(()=>0);reachSuper(s,0);nextAction(s,()=>.999);
 assert.equal(s.detailRows[0].superCap,95);
 assert.equal(s.detailRows[0].superReached,false);
});
test('AUTO reconciles detailed records, stakes, payouts and bankroll',()=>{
 const s=createGame(seeded(8));autoCycles(s,300,seeded(123));
 assert.equal(s.cycleCount,300);assert.equal(s.totalOutput-s.totalInput,s.net);
 assert.equal(s.bank,CONFIG.initialBank+s.net);
 assert.equal(s.lastActionGames,s.gameCount);
 assert.equal(s.detailRows.reduce((a,x)=>a+x.net,0),s.net);
 assert.equal(s.detailRows.reduce((a,x)=>a+x.input,0),s.totalInput);
 assert.equal(s.detailRows.reduce((a,x)=>a+x.output,0),s.totalOutput);
});
test('AUTO and manual draw paths agree for identical seeded random inputs',()=>{
 const r1=seeded(19),r2=seeded(19),a=createGame(r1),b=createGame(r2);
 autoCycles(a,200,r1);while(b.cycleCount<200)nextAction(b,r2);
 for(const k of ['gameCount','cycleCount','net','totalInput','totalOutput','cap94Count','cap95Count'])assert.equal(a[k],b[k]);
});
test('long-run observed machine payout approaches 97.81%',()=>{
 const s=createGame(seeded(10));autoCycles(s,140000,seeded(98765));
 assert.ok(Math.abs(machineRate(s)-97.8098)<1.5);
});
