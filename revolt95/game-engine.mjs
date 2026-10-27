/** REVOLT 95 — original arcade probability game engine.
 * Framework-free, deterministic when a seeded RNG is supplied.
 * All game phases use a 3-token stake per paid game.
 */
export const CONFIG = Object.freeze({
  initialBank: 10000,
  normalBet: 3,
  normalG: [{g:5,p:.15},{g:35,p:.15},{g:160,p:.31},{g:300,p:.29},{g:375,p:.10}],
  normalReels: [{p:.752,paid:0,label:'ハズレ'},{p:.184,paid:1,label:'小役'},{p:.064,paid:3,label:'強小役'}],
  czGames:11,
  czBet:3,
  czPayThreeChance: 16.18/33,
  czWin: .60, // CZ突破率の加重平均
  czWinByNormalG: {5:.45,35:.50,160:.55,300:.70,375:.84},
  revolutionBonusChance: .55,
  bonusAtChance: {revolution:.52, decisive:.45},
  normalRushContinue: .75,
  upperStart:.90,
  upperIncrement:.01,
  upperCap95:.95,
  upperCap94:.94,
  upperCap95Chance:.80, // 80% reach 95% and 20% stop growing at 94%
  setLengths: [{g:10,p:.85},{g:20,p:.125},{g:50,p:.025}],
  netPerAtGame: 9,
});
const clampRng = (rng)=>Math.max(0, Math.min(1-Number.EPSILON,Number(rng())));
function choice(items,rng) { const r=clampRng(rng); let a=0; for (const x of items) {a+=x.p;if(r<a)return x;}return items.at(-1); }
function log(s,kind,text,sub='') {
  s.events.unshift({id:++s.eventId,kind,text,sub});
  if(s.events.length>48)s.events.length=48;
  s.banner={kind,text,sub};
}
function settle(s,bet,payout,g){
  s.totalInput+=bet;s.totalOutput+=payout;
  s.net+=payout-bet;s.bank+=payout-bet;s.gameCount+=g;
  s.maxBalance=Math.max(s.maxBalance,s.bank);
  s.lowBalance=Math.min(s.lowBalance,s.bank);
}
function prepareNormal(s,rng){
  s.phase='normal';
  s.targetG=choice(CONFIG.normalG,rng).g;
  s.bonus=null;s.atSetG=0;s.upperWins=0;s.upperCap=null;s.normalWins=0;s.rushSets=0;s.rushTotalGain=0;
  s.cycleStart=s.net;
}
function finishCycle(s,rng,message){
  const gain=s.net-s.cycleStart;
  s.cycleCount++;
  s.lastCycle=gain;
  s.bestCycle=Math.max(s.bestCycle,gain);
  s.worstCycle=Math.min(s.worstCycle,gain);
  s.history.unshift({number:s.cycleCount,net:gain});
  if(s.history.length>28)s.history.length=28;
  prepareNormal(s,rng);
  if(message)log(s,gain>=0?'win':'lose',message,`${gain>=0?'+':''}${gain.toLocaleString('ja-JP')}枚 / 次のCZまで通常時1タップ`);
}
export function createGame(rng=Math.random){
  const s={version:6,phase:'normal',bank:CONFIG.initialBank,net:0,gameCount:0,
  totalInput:0,totalOutput:0,cycleCount:0,czCount:0,bonusCount:0,atCount:0,upperCount:0,
  normalWins:0,upperWins:0,upperCap:null,cap94Count:0,cap95Count:0,atSetG:0,rushSets:0,rushTotalGain:0,
  maxRushGain:0,bestCycle:-Infinity,worstCycle:Infinity,maxBalance:CONFIG.initialBank,lowBalance:CONFIG.initialBank,
  currentRushGain:0, bonus:null,history:[],events:[],banner:{kind:'info',text:'1 TAPで運命を変えろ',sub:'通常時を一括消化してCZへ進む'},eventId:0,
  cycleStart:0,lastCycle:0,targetG:0,lastActionGames:0, lastNormal:null,lastCz:null,lastBonus:null, lastAt:null};
  prepareNormal(s,rng);return s;
}
export function continueChance(s){
  return s.phase==='upper' ? Math.min(s.upperCap??CONFIG.upperCap95,CONFIG.upperStart+s.upperWins*CONFIG.upperIncrement) : CONFIG.normalRushContinue;
}
export function nextAction(s,rng=Math.random){
  const startGames=s.gameCount;
  if(s.phase==='normal'){
    let paid=0; const samples=[];
    for(let i=0;i<s.targetG;i++){const role=choice(CONFIG.normalReels,rng);paid+=role.paid;
      if(samples.length<6)samples.push(role.label);
    }
    const bet=s.targetG*CONFIG.normalBet;
    settle(s,bet,paid,s.targetG);
    s.lastNormal={g:s.targetG,bet,paid,net:paid-bet};
    s.phase='cz';s.czCount++;
    log(s,'cz','ドルシア攻防戦 突入',`${s.targetG}G消化 / CZ突破率${Math.round((CONFIG.czWinByNormalG[s.targetG]??CONFIG.czWin)*100)}% / 通常時 ${paid-bet>=0?'+':''}${paid-bet}枚`);
  } else if(s.phase==='cz'){
    let paid=0;for(let i=0;i<CONFIG.czGames;i++)if(clampRng(rng)<CONFIG.czPayThreeChance)paid+=3;
    settle(s,CONFIG.czGames*CONFIG.czBet,paid,CONFIG.czGames);
    const chance=CONFIG.czWinByNormalG[s.lastNormal.g] ?? CONFIG.czWin;
    const success=clampRng(rng)<chance;
    s.lastCz={success,paid,net:paid-CONFIG.czGames*CONFIG.czBet,chance};
    if(success){
      s.bonus=clampRng(rng)<CONFIG.revolutionBonusChance?'revolution':'decisive';
      s.phase='bonus';s.bonusCount++;
      log(s,'success','CZ 突破！',s.bonus==='revolution'?'革命ボーナス獲得':'決戦ボーナス獲得');
    } else { finishCycle(s,rng,'CZ失敗 — 通常時へ'); }
  } else if(s.phase==='bonus'){
    const type=s.bonus;
    const g=type==='revolution'?(clampRng(rng)<8/9?51:52):16;
    const net=type==='revolution'?g*9:60;
    settle(s,g*3,g*3+net,g);
    const success=clampRng(rng)<CONFIG.bonusAtChance[type];
    s.lastBonus={type,g,net,success};
    if(success){
      s.phase='rush';s.normalWins=0;s.upperWins=0;s.rushSets=0;
      s.rushTotalGain=0;s.currentRushGain=0;s.atCount++;
      s.atSetG=choice(CONFIG.setLengths,rng).g;
      log(s,'rush','革命RUSH 突入！',`ボーナス +${net}枚 / 75%を3連続突破せよ`);
    } else { finishCycle(s,rng,'ボーナス終了 — AT非当選'); }
  } else if(s.phase==='rush'||s.phase==='upper'){
    const mode=s.phase, g=s.atSetG,net=g*CONFIG.netPerAtGame;
    settle(s,g*3,g*(3+CONFIG.netPerAtGame),g);
    s.rushSets++;s.rushTotalGain+=net;s.currentRushGain+=net;
    const chance=continueChance(s);
    const success=clampRng(rng)<chance;
    s.lastAt={mode,g,net,chance,success,set:s.rushSets};
    if(success){
      if(mode==='rush'){
        s.normalWins++;
        if(s.normalWins>=3){
          s.phase='upper';s.upperWins=0;s.upperCount++;
          // The continuation ceiling is selected once per SUPER entry.
          s.upperCap=clampRng(rng)<CONFIG.upperCap95Chance?CONFIG.upperCap95:CONFIG.upperCap94;
          if(s.upperCap===CONFIG.upperCap95)s.cap95Count++;else s.cap94Count++;
          s.atSetG=choice(CONFIG.setLengths,rng).g;
          log(s,'upper','超革命RUSH 突入！','90%から継続率が成長 / 94%で打ち止め or 95%まで成長');
        }else{
          s.atSetG=choice(CONFIG.setLengths,rng).g;
          log(s,'success',`${(chance*100).toFixed(0)}% 継続成功！`,`革命RUSH ${s.normalWins}/3突破 / +${net}枚`);
        }
      } else {
        s.upperWins++;
        s.atSetG=choice(CONFIG.setLengths,rng).g;
        log(s,'upper',`${(chance*100).toFixed(0)}% 継続成功！`,`次回${Math.round(continueChance(s)*100)}% / +${net}枚`);
      }
    } else {
      s.maxRushGain=Math.max(s.maxRushGain,s.currentRushGain);
      finishCycle(s,rng,`${mode==='upper'?'超革命RUSH':'革命RUSH'}終了 — +${s.currentRushGain.toLocaleString('ja-JP')}枚`);
    }
  } else throw Error(`Unknown phase: ${s.phase}`);
  s.lastActionGames=s.gameCount-startGames;
  return s;
}
export function autoCycles(s,count,rng=Math.random){
  const startGames=s.gameCount;
  const target=s.cycleCount+count;
  let operations=0;
  while(s.cycleCount<target && operations<Math.max(100000,count*100)){nextAction(s,rng);operations++;}
  if(operations>=Math.max(100000,count*100))throw Error('Auto cycle safety limit');
  s.lastActionGames=s.gameCount-startGames;
  return s;
}
export function machineRate(s){return s.totalInput>0?s.totalOutput/s.totalInput*100:null;}
export function expectedStats(){
  const meanUpperSetsAtCap=(cap)=>{
    let alive=1,total=0;
    for(let i=0;i<2000;i++){
      total+=alive;
      alive*=Math.min(cap,CONFIG.upperStart+i*CONFIG.upperIncrement);
      if(alive<1e-12)break;
    }
    return total;
  };
  const upperAt94=meanUpperSetsAtCap(CONFIG.upperCap94);
  const upperAt95=meanUpperSetsAtCap(CONFIG.upperCap95);
  const meanUpperSets=(1-CONFIG.upperCap95Chance)*upperAt94+CONFIG.upperCap95Chance*upperAt95;
  const meanSet=CONFIG.setLengths.reduce((a,x)=>a+x.g*x.p,0);
  const meanCzWin=CONFIG.normalG.reduce((a,x)=>a+x.p*CONFIG.czWinByNormalG[x.g],0);
  const pAt=meanCzWin*(CONFIG.revolutionBonusChance*CONFIG.bonusAtChance.revolution
    +(1-CONFIG.revolutionBonusChance)*CONFIG.bonusAtChance.decisive);
  const p=CONFIG.normalRushContinue;
  const pSuper=pAt*p**3;
  const expectedRushGames=meanSet*(pAt*(1+p+p**2)+pSuper*meanUpperSets);
  const meanNormalGames=CONFIG.normalG.reduce((a,x)=>a+x.g*x.p,0);
  const meanNormalPayout=CONFIG.normalReels.reduce((a,x)=>a+x.p*x.paid,0);
  const normalLoss=meanNormalGames*(CONFIG.normalBet-meanNormalPayout);
  const czLoss=CONFIG.czGames*CONFIG.czBet*(1-CONFIG.czPayThreeChance);
  const bonusNet=meanCzWin*(CONFIG.revolutionBonusChance*460+(1-CONFIG.revolutionBonusChance)*60);
  const rushNet=expectedRushGames*CONFIG.netPerAtGame;
  const expectedProfit=-normalLoss-czLoss+bonusNet+rushNet;
  const inputPerCycle=meanNormalGames*CONFIG.normalBet+CONFIG.czGames*CONFIG.czBet
    +meanCzWin*(CONFIG.revolutionBonusChance*(51+1/9)+(1-CONFIG.revolutionBonusChance)*16)*3
    +expectedRushGames*3;
  return {
    meanNormalGames,meanCzWin,meanNormalLoss:normalLoss,meanCzLoss:czLoss,
    meanSetGames:meanSet,meanUpperSets,meanUpperSetsAt94:upperAt94,meanUpperSetsAt95:upperAt95,
    atChancePerCZ:pAt,superChancePerCycle:pSuper,expectedRushGames,
    expectedProfit,inputPerCycle,expectedRate:100*(1+expectedProfit/inputPerCycle)
  };
}
