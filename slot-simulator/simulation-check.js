import { SlotGame } from './engine.js';
const n=Number(process.argv[2] || 1000000);
const seed=Number(process.argv[3] || 42);
const game=new SlotGame(seed);
const start=performance.now();
for(let i=0;i<n;i++)game.step();
const s=game.summary;
console.log(JSON.stringify({...s,seed,seconds:+((performance.now()-start)/1000).toFixed(2),first20Success:(game.events.first20Success||0)/(game.events.baseAtEntries||1),upperCzSuccess:(game.events.upperCzWins||0)/(game.events.upperCzEntries||1),upperRestarts:game.events.upperRestarts||0,comebacks:game.events.comebackSuccess||0},null,2));
