import test from 'node:test';
import assert from 'node:assert/strict';
import { SlotGame, BET, ROLE_PAY, ROLE_WEIGHTS, TARGET_BASE_PAYOUT } from './engine.js';

test('normal role payout matches 31.8 G/50 coins',()=>{
 const expected=Object.entries(ROLE_WEIGHTS).reduce((a,[r,p])=>a+p*ROLE_PAY[r],0);
 assert.ok(Math.abs(expected-TARGET_BASE_PAYOUT)<1e-10);assert.equal(BET,3);
});
test('every physical spin stakes 3 coins with integer payout',()=>{
 const g=new SlotGame(42);for(let i=0;i<100000;i++)g.step();
 assert.equal(g.bets,g.games*3);assert.ok(Number.isInteger(g.payouts));assert.ok(g.events.bonuses>100);
});
test('front 1000pt transition waits to finish 50G',()=>{
 const g=new SlotGame(9);g.setTalents(false);g.phaseTo('front50',1);g.maxTicket=true;
 g.trigger=()=>[false,false];g.draw=p=>{g.spend(p,'miss');return 'miss';};
 g.step();assert.equal(g.phase,'upper_cz');assert.equal(g.remaining,10);
 const u=new SlotGame(9);u.setTalents(true);u.phaseTo('upper_front50',1);u.maxTicket=true;
 u.trigger=()=>[false,false];u.draw=p=>{u.spend(p,'miss');return 'miss';};
 u.step();assert.equal(u.phase,'upper_front50');assert.equal(u.remaining,50);
});
test('ST point max transitions immediately after a bonus',()=>{
 const g=new SlotGame(10);g.phaseTo('st10',7);g.maxTicket=true;
 g.resolveStBonus(false);assert.equal(g.phase,'upper_cz');
 const u=new SlotGame(11);u.phaseTo('upper_st10',7);u.maxTicket=true;
 u.resolveStBonus(true);assert.equal(u.phase,'upper_front50');assert.equal(u.remaining,50);
});
test('HOLD preserves active ST remaining G',()=>{
 const g=new SlotGame(72);g.phaseTo('st10',4);
 g.draw=p=>{g.spend(p,'miss');return 'miss';};g.trigger=()=>[false,true];
 g.step();assert.equal(g.phase,'hold');assert.equal(g.holdData.remaining,3);
 g.holdData.won=false;while(g.phase==='hold')g.step();
 assert.equal(g.remaining,3);assert.equal(g.phase,'st10');
});
test('100th normal comeback G is eligible',()=>{
 const g=new SlotGame(7);g.phaseTo('normal');g.comebackRemaining=1;
 g.draw=p=>{g.spend(p,'middle');return 'middle';};
 g.step();assert.equal(g.phase,'upper_front50');assert.equal(g.events.comebackSuccess,1);
});
test('bonus gross payout is not treated as net payout',()=>{
 const g=new SlotGame(18);g.startBonus(385,false,'first20',true);
 while(g.phase==='bonus')g.step();
 assert.equal(g.payouts,385);assert.equal(g.bets,3*Math.ceil(385/11.4));
});
test('save and restore preserves RNG and state',()=>{
 const a=new SlotGame(12345);for(let i=0;i<15000;i++)a.step();
 const b=SlotGame.restore(a.serialize());
 for(let i=0;i<10000;i++){a.step();b.step();}
 assert.deepEqual(a.summary,b.summary);assert.equal(a.rng,b.rng);
});
test('single-step and auto batch have identical outcomes',()=>{
 const a=new SlotGame(616),b=new SlotGame(616);
 for(let i=0;i<6000;i++)a.step();
 for(let j=0;j<60;j++)for(let i=0;i<100;i++)b.step();
 assert.deepEqual(a.summary,b.summary);
});
