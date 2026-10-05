(() => {
'use strict';

const $ = id => document.getElementById(id);
const els = {
  medals:$('medals'), net:$('net'), normalGames:$('normalGames'), bonusCount:$('bonusCount'),
  machine:$('machine'), modeChip:$('modeChip'), rateChip:$('rateChip'), phaseKicker:$('phaseKicker'),
  phaseTitle:$('phaseTitle'), phaseRule:$('phaseRule'), progressLabel:$('progressLabel'),
  progressValue:$('progressValue'), progressBar:$('progressBar'), reels:[$('r1'),$('r2'),$('r3')],
  message:$('message'), startBtn:$('startBtn'), startMain:$('startMain'), startSub:$('startSub'),
  currentMode:$('currentMode'), netPerGame:$('netPerGame'), continueRate:$('continueRate'), atGain:$('atGain'),
  totalGames:$('totalGames'), hitRate:$('hitRate'), maxDrought:$('maxDrought'), superCount:$('superCount'),
  maxAtGain:$('maxAtGain'), rtp:$('rtp'), historyToggle:$('historyToggle'), historyPanel:$('historyPanel'),
  levels:[$('level1'),$('level2'),$('level3'),$('level4')], settingsBtn:$('settingsBtn'),
  settingsDialog:$('settingsDialog'), autoToggle:$('autoToggle'), autoSpeed:$('autoSpeed'),
  soundToggle:$('soundToggle'), resetBtn:$('resetBtn'),
  avgHitGame:$('avgHitGame'), medianHitGame:$('medianHitGame'), minHitGame:$('minHitGame'), deepestHitGame:$('deepestHitGame'),
  ceilingHits:$('ceilingHits'), ceilingRate:$('ceilingRate'), atStarts:$('atStarts'), atCompleted:$('atCompleted'),
  avgAtGain:$('avgAtGain'), medianAtGain:$('medianAtGain'), avgAtSets:$('avgAtSets'), maxAtSets:$('maxAtSets'),
  at1000Rate:$('at1000Rate'), at2000Rate:$('at2000Rate'), at5000Rate:$('at5000Rate'),
  reachPredict:$('reachPredict'), reachPredictRate:$('reachPredictRate'), gamesPredict:$('gamesPredict'),
  reachHigh:$('reachHigh'), reachHighRate:$('reachHighRate'), gamesHigh:$('gamesHigh'),
  reachRateUp:$('reachRateUp'), reachRateUpRate:$('reachRateUpRate'), gamesRateUp:$('gamesRateUp'),
  reachSuper:$('reachSuper'), reachSuperRate:$('reachSuperRate'), gamesSuper:$('gamesSuper'),
  judgePredict:$('judgePredict'), contPredict:$('contPredict'), promoPredict:$('promoPredict'),
  judgeHigh:$('judgeHigh'), contHigh:$('contHigh'), promoHigh:$('promoHigh'),
  judgeRateUp:$('judgeRateUp'), contRateUp:$('contRateUp'), promoRateUp:$('promoRateUp'),
  judgeSuper:$('judgeSuper'), contSuper:$('contSuper'), revivalCount:$('revivalCount'),
  limitTotal:$('limitTotal'), limitRate:$('limitRate'), sessionHigh:$('sessionHigh'), sessionLow:$('sessionLow'),
  maxInvestment:$('maxInvestment'), maxDrawdown:$('maxDrawdown'), currentDrawdown:$('currentDrawdown'), flowTotal:$('flowTotal')
};

const CONFIG = {
  initialMedals:3000,
  normalBet:3,
  hitRate:157.6,
  ceiling:400,
  normalBase:38.0,
  bonusGames:20,
  bonusNet:1.65,
  setGames:10,
  revivalRate:.12,
  completeGain:19000,
  limitGain:2400,
  modes:[
    {key:'rush1',name:'PREDICT RUSH',short:'PREDICT',net:1.75,cont:.65,promo:.18,limit:.25},
    {key:'rush2',name:'HIGH RUSH',short:'HIGH',net:5,cont:.75,promo:.16,limit:.40},
    {key:'rush3',name:'RATE UP',short:'85% MODE',net:7,cont:.85,promo:.13,limit:.55},
    {key:'rush4',name:'SUPER RUSH',short:'95% MODE',net:9,cont:.95,promo:0,limit:.70}
  ]
};

const SYMBOLS = ['🍒','🔔','🍉','⚡','7','◆','RE'];
let state;
let autoTimer = null;
let autoRunning = false;

function freshState(){
  return {
    medals:CONFIG.initialMedals,
    minMedals:CONFIG.initialMedals,
    phase:'normal',
    normalSinceHit:0,
    normalGames:0,
    totalGames:0,
    bonusGamesLeft:0,
    rushMode:0,
    setGame:0,
    setNo:0,
    atStart:0,
    atGain:0,
    segmentGain:0,
    bonusCount:0,
    superCount:0,
    maxDrought:0,
    maxAtGain:0,
    totalBet:0,
    totalPayout:0,
    bonusTick:false,
    complete:false,
    maxMedals:CONFIG.initialMedals,
    maxDrawdown:0,
    hitIntervals:[],
    ceilingHits:0,
    atStarts:0,
    atResults:[],
    currentAtMaxMode:0,
    modeReach:[0,0,0,0],
    modeGames:[0,0,0,0],
    judgeAttempts:[0,0,0,0],
    judgeSuccess:[0,0,0,0],
    promoEligible:[0,0,0,0],
    promoSuccess:[0,0,0,0],
    revivalCount:0,
    limitAttempts:[0,0,0,0],
    limitSuccess:[0,0,0,0],
    history:[],
    settings:{auto:false,autoSpeed:'normal',sound:true}
  };
}

const signed = n => n===0 ? '±0' : (n>0?'+':'') + Math.round(n);
const pct = n => Math.round(n*100) + '%';
const netText = n => Number.isInteger(n) ? n.toFixed(1) : n.toFixed(2);
const mean = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
const median = arr => {
  if(!arr.length) return 0;
  const a=[...arr].sort((x,y)=>x-y), m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
};
const observedRate = (success,total) => total ? (success/total*100).toFixed(1)+'%' : '—';

function randomSymbol(){ return SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)]; }

function setReels(a,b,c){
  [a,b,c].forEach((v,i)=>{
    els.reels[i].textContent=v;
    const box=els.reels[i].parentElement;
    box.classList.add('spin');
    setTimeout(()=>box.classList.remove('spin'),120+i*35);
  });
}

function tone(type){
  if(!state.settings.sound) return;
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C) return;
    const ctx=new C(), gain=ctx.createGain();
    gain.gain.value=.035; gain.connect(ctx.destination);
    const notes=type==='super'?[659,784,988,1318]:type==='win'?[523,659,784]:type==='lose'?[220,180]:[440];
    notes.forEach((f,i)=>{const o=ctx.createOscillator();o.frequency.value=f;o.connect(gain);const t=ctx.currentTime+i*.06;o.start(t);o.stop(t+.09)});
    setTimeout(()=>ctx.close(),600);
  }catch(_){}
}

function message(text,type=''){
  els.message.textContent=text;
  els.message.className='message'+(type?' '+type:'');
}

function addHistory(kind,text,result,good){
  state.history.unshift({kind,text,result,good});
  state.history=state.history.slice(0,50);
}

function renderHistory(){
  if(!state.history.length){
    els.historyPanel.innerHTML='<div class="history-row"><span>—</span><span>まだ履歴がありません</span><strong>—</strong></div>';
    return;
  }
  els.historyPanel.innerHTML=state.history.map(h=>
    '<div class="history-row"><span>'+h.kind+'</span><span>'+h.text+'</span><strong class="'+(h.good?'good':'bad')+'">'+h.result+'</strong></div>'
  ).join('');
}

function addFlow(bet,payout){
  state.medals-=bet;
  state.totalBet+=bet;
  state.medals+=payout;
  state.totalPayout+=payout;
  state.minMedals=Math.min(state.minMedals,state.medals);
  state.maxMedals=Math.max(state.maxMedals,state.medals);
  state.maxDrawdown=Math.max(state.maxDrawdown,state.maxMedals-state.medals);
}

function normalPayout(){
  // Average payout ≈1.684 medals/G, giving roughly 38G per 50 medals at 3BET.
  const r=Math.random();
  if(r<.170) return 8;
  if(r<.240) return 3;
  if(r<.285) return 2;
  if(r<.309) return 1;
  return 0;
}

function beginBonus(){
  state.phase='bonus';
  state.bonusGamesLeft=CONFIG.bonusGames;
  state.bonusCount++;
  state.hitIntervals.push(state.normalSinceHit);
  if(state.normalSinceHit>=CONFIG.ceiling) state.ceilingHits++;
  state.atStart=state.medals;
  state.atGain=0;
  state.segmentGain=0;
  addHistory('初当り',state.normalSinceHit+'G','BONUS',true);
  state.normalSinceHit=0;
  setReels('7','7','7');
  message('PREDICT BONUS！ 20G消化後、PREDICT RUSHへ。','hot');
  tone('win');
}

function beginRush(){
  state.phase='rush';
  state.rushMode=0;
  state.setGame=0;
  state.setNo=1;
  state.atStarts++;
  state.currentAtMaxMode=0;
  state.modeReach[0]++;
  message('PREDICT RUSH START！ +1.75枚/G・継続率65%。','win');
  tone('win');
}

function finishAt(reason){
  const gain=Math.round(state.medals-state.atStart);
  const sets=state.setNo;
  state.atGain=gain;
  state.maxAtGain=Math.max(state.maxAtGain,gain);
  state.atResults.push({gain,sets,maxMode:state.currentAtMaxMode});
  addHistory('AT終了','全'+sets+'SET',signed(gain)+'枚',gain>=0);
  state.phase='normal';
  state.rushMode=0;
  state.setGame=0;
  state.setNo=0;
  state.segmentGain=0;
  const paused=autoRunning;
  if(paused){
    clearTimeout(autoTimer);
    autoTimer=null;
    autoRunning=false;
  }
  message(reason+' / AT差枚 '+signed(gain)+'枚。'+(paused?' AUTOを一時停止しました。':''),'lose');
  tone('lose');
}

function triggerLimit(){
  state.phase='limit';
  const m=CONFIG.modes[state.rushMode];
  message('LIMIT LINK！ 区間差枚約+2400枚到達。'+Math.round(m.limit*100)+'%で同MODE再接続。','hot');
  setReels('L','I','M');
  tone('super');
}

function resolveLimit(){
  const m=CONFIG.modes[state.rushMode];
  state.totalGames++;
  state.limitAttempts[state.rushMode]++;
  if(Math.random()<m.limit){
    state.limitSuccess[state.rushMode]++;
    state.segmentGain=0;
    state.phase='rush';
    state.setGame=0;
    state.setNo++;
    addHistory('LIMIT',m.short,'LINK',true);
    message('LIMIT LINK成功！ '+m.name+'を再接続。','win');
    tone('super');
  }else{
    addHistory('LIMIT',m.short,'END',false);
    finishAt('LIMIT LINK失敗');
  }
}

function checkComplete(){
  if(state.medals-state.minMedals>=CONFIG.completeGain){
    state.complete=true;
    state.phase='complete';
    stopAuto();
    setReels('C','P','!'); 
    message('COMPLETE！ セッション最下点から+19,000枚到達。','hot');
    tone('super');
    return true;
  }
  return false;
}

function spinNormal(){
  if(state.medals<CONFIG.normalBet){
    stopAuto();
    message('メダル不足。リセットしてください。','lose');
    return;
  }
  state.totalGames++;
  state.normalGames++;
  state.normalSinceHit++;
  state.maxDrought=Math.max(state.maxDrought,state.normalSinceHit);

  const pay=normalPayout();
  addFlow(CONFIG.normalBet,pay);
  setReels(randomSymbol(),randomSymbol(),randomSymbol());

  const ceiling=state.normalSinceHit>=CONFIG.ceiling;
  const hit=ceiling || Math.random()<1/CONFIG.hitRate;
  if(hit){
    beginBonus();
  }else if(pay>=8){
    message('ベル +'+pay+'枚 / '+state.normalSinceHit+'G','win');
  }else{
    message('NORMAL '+state.normalSinceHit+'G / BONUS 1/'+CONFIG.hitRate);
  }
}

function bonusNetPayout(){
  // Fixed 20G pattern totaling +33 medals (average +1.65/G).
  const played=CONFIG.bonusGames-state.bonusGamesLeft;
  const pattern=[2,2,1,2,1,2,2,1,2,1,2,2,1,2,1,2,2,1,2,2];
  return CONFIG.normalBet + pattern[played];
}

function spinBonus(){
  state.totalGames++;
  const payout=bonusNetPayout();
  addFlow(CONFIG.normalBet,payout);
  state.atGain=state.medals-state.atStart;
  state.segmentGain+=payout-CONFIG.normalBet;
  state.bonusGamesLeft--;
  setReels(randomSymbol(),randomSymbol(),randomSymbol());
  if(state.bonusGamesLeft<=0){
    addHistory('BONUS','20G','+33枚',true);
    beginRush();
  }else{
    message('PREDICT BONUS 残り'+state.bonusGamesLeft+'G / 差枚 '+signed(state.atGain),'hot');
  }
  checkComplete();
}

function spinRush(){
  const m=CONFIG.modes[state.rushMode];
  state.totalGames++;
  const netGain=m.net===1.75?(Math.random()<.75?2:1):m.net;
  const payout=CONFIG.normalBet+netGain;
  addFlow(CONFIG.normalBet,payout);
  state.atGain=state.medals-state.atStart;
  state.segmentGain+=netGain;
  state.modeGames[state.rushMode]++;
  state.setGame++;
  setReels(randomSymbol(),randomSymbol(),randomSymbol());
  message(m.name+' '+state.setNo+'SET / '+state.setGame+'/'+CONFIG.setGames+'G / AT '+signed(state.atGain),'win');
  if(checkComplete()) return;
  if(state.segmentGain>=CONFIG.limitGain){
    triggerLimit();
    return;
  }
  if(state.setGame>=CONFIG.setGames){
    state.phase='judge';
    setReels('⚔','?','⚔');
    message('BATTLE JUDGE / 継続率 '+pct(m.cont),'hot');
  }
}

function resolveJudge(){
  const m=CONFIG.modes[state.rushMode];
  const modeIndex=state.rushMode;
  state.totalGames++;
  state.judgeAttempts[modeIndex]++;
  const directRate=(m.cont-CONFIG.revivalRate)/(1-CONFIG.revivalRate);
  const direct=Math.random()<Math.max(0,Math.min(1,directRate));
  const revival=!direct && Math.random()<CONFIG.revivalRate;
  const cont=direct||revival;
  if(cont) state.judgeSuccess[modeIndex]++;
  if(revival) state.revivalCount++;

  if(!cont){
    setReels('E','N','D');
    addHistory('JUDGE',m.short,pct(m.cont)+' → END',false);
    finishAt('BATTLE JUDGE敗北');
    return;
  }

  const old=state.rushMode;
  if(state.rushMode<CONFIG.modes.length-1){
    state.promoEligible[modeIndex]++;
    if(Math.random()<m.promo){
      state.rushMode++;
      state.promoSuccess[modeIndex]++;
      state.currentAtMaxMode=Math.max(state.currentAtMaxMode,state.rushMode);
      state.modeReach[state.rushMode]++;
      if(state.rushMode===3) state.superCount++;
    }
  }
  state.setNo++;
  state.setGame=0;
  state.phase='rush';
  const next=CONFIG.modes[state.rushMode];
  const promoted=state.rushMode>old;

  if(promoted){
    setReels('U','P','!');
    addHistory('昇格',m.short,next.short,true);
    message((revival?'REVIVAL + ':'')+'RANK UP！ '+next.name+' / +'+netText(next.net)+'枚・'+pct(next.cont),'hot');
    tone(state.rushMode===3?'super':'win');
  }else{
    setReels('N','E','X');
    addHistory('JUDGE',m.short,revival?'REVIVAL':'CONTINUE',true);
    message((revival?'REVIVAL！ ':'継続！ ')+m.name+' '+state.setNo+'SETへ。','win');
    tone('win');
  }
}

function step(){
  if(state.complete) return;
  if(state.phase==='normal') spinNormal();
  else if(state.phase==='bonus') spinBonus();
  else if(state.phase==='rush') spinRush();
  else if(state.phase==='judge') resolveJudge();
  else if(state.phase==='limit') resolveLimit();
  render();
  if(autoRunning) scheduleAuto();
}

function scheduleAuto(){
  clearTimeout(autoTimer);
  if(!autoRunning) return;
  autoTimer=setTimeout(step,state.settings.autoSpeed==='fast'?85:260);
}

function startAuto(){
  if(autoRunning) return;
  autoRunning=true;
  message('AUTO PLAY開始。');
  render();
  scheduleAuto();
}

function stopAuto(){
  clearTimeout(autoTimer);
  autoTimer=null;
  autoRunning=false;
  render();
}

function currentClass(){
  if(state.phase==='bonus') return 'bonus';
  if(state.phase==='rush'||state.phase==='judge'||state.phase==='limit') return CONFIG.modes[state.rushMode].key;
  return 'normal';
}

function renderAnalytics(){
  const hits=state.hitIntervals;
  els.avgHitGame.textContent=hits.length?mean(hits).toFixed(1)+'G':'—';
  els.medianHitGame.textContent=hits.length?median(hits).toFixed(1)+'G':'—';
  els.minHitGame.textContent=hits.length?Math.min(...hits)+'G':'—';
  els.deepestHitGame.textContent=hits.length?Math.max(...hits)+'G':'—';
  els.ceilingHits.textContent=state.ceilingHits;
  els.ceilingRate.textContent=observedRate(state.ceilingHits,hits.length);

  const results=state.atResults;
  const gains=results.map(x=>x.gain);
  const sets=results.map(x=>x.sets);
  els.atStarts.textContent=state.atStarts;
  els.atCompleted.textContent=results.length;
  els.avgAtGain.textContent=results.length?signed(mean(gains))+'枚':'—';
  els.medianAtGain.textContent=results.length?signed(median(gains))+'枚':'—';
  els.avgAtSets.textContent=results.length?mean(sets).toFixed(2):'—';
  els.maxAtSets.textContent=results.length?Math.max(...sets):'0';
  els.at1000Rate.textContent=results.length?observedRate(gains.filter(x=>x>=1000).length,results.length):'—';
  els.at2000Rate.textContent=results.length?observedRate(gains.filter(x=>x>=2000).length,results.length):'—';
  els.at5000Rate.textContent=results.length?observedRate(gains.filter(x=>x>=5000).length,results.length):'—';

  const reachEls=[
    [els.reachPredict,els.reachPredictRate,els.gamesPredict],
    [els.reachHigh,els.reachHighRate,els.gamesHigh],
    [els.reachRateUp,els.reachRateUpRate,els.gamesRateUp],
    [els.reachSuper,els.reachSuperRate,els.gamesSuper]
  ];
  reachEls.forEach((row,i)=>{
    row[0].textContent=state.modeReach[i];
    row[1].textContent=observedRate(state.modeReach[i],state.atStarts);
    row[2].textContent=state.modeGames[i]+'G';
  });

  const judgeEls=[
    [els.judgePredict,els.contPredict,els.promoPredict],
    [els.judgeHigh,els.contHigh,els.promoHigh],
    [els.judgeRateUp,els.contRateUp,els.promoRateUp],
    [els.judgeSuper,els.contSuper,null]
  ];
  judgeEls.forEach((row,i)=>{
    row[0].textContent=state.judgeAttempts[i];
    row[1].textContent=observedRate(state.judgeSuccess[i],state.judgeAttempts[i]);
    if(row[2]) row[2].textContent=observedRate(state.promoSuccess[i],state.promoEligible[i]);
  });
  els.revivalCount.textContent=state.revivalCount;
  const limitA=state.limitAttempts.reduce((a,b)=>a+b,0);
  const limitS=state.limitSuccess.reduce((a,b)=>a+b,0);
  els.limitTotal.textContent=limitS+' / '+limitA;
  els.limitRate.textContent=observedRate(limitS,limitA);

  els.sessionHigh.textContent=signed(state.maxMedals-CONFIG.initialMedals);
  els.sessionLow.textContent=signed(state.minMedals-CONFIG.initialMedals);
  els.maxInvestment.textContent=Math.max(0,Math.round(CONFIG.initialMedals-state.minMedals))+'枚';
  els.maxDrawdown.textContent=Math.round(state.maxDrawdown)+'枚';
  els.currentDrawdown.textContent=Math.max(0,Math.round(state.maxMedals-state.medals))+'枚';
  els.flowTotal.textContent=Math.round(state.totalBet)+' / '+Math.round(state.totalPayout);
}

function render(){
  const net=state.medals-CONFIG.initialMedals;
  els.medals.textContent=Math.round(state.medals);
  els.net.textContent=signed(net);
  els.normalGames.textContent=state.normalGames;
  els.bonusCount.textContent=state.bonusCount;
  els.totalGames.textContent=state.totalGames+'G';
  els.hitRate.textContent=state.bonusCount?'1/'+(state.normalGames/state.bonusCount).toFixed(1):'—';
  els.maxDrought.textContent=state.maxDrought+'G';
  els.superCount.textContent=state.superCount;
  els.maxAtGain.textContent=signed(state.maxAtGain);
  els.rtp.textContent=state.totalBet?(state.totalPayout/state.totalBet*100).toFixed(2)+'%':'—';
  els.atGain.textContent=(state.phase==='normal'||state.phase==='complete')?'±0':signed(state.medals-state.atStart);
  renderAnalytics();

  els.machine.className='machine '+currentClass();
  els.levels.forEach((el,i)=>{
    el.classList.toggle('active',(state.phase!=='normal'&&state.phase!=='bonus'&&state.phase!=='complete')&&i===state.rushMode);
    el.classList.toggle('passed',(state.phase!=='normal'&&state.phase!=='bonus'&&state.phase!=='complete')&&i<state.rushMode);
  });

  if(state.phase==='normal'){
    els.modeChip.textContent='NORMAL';
    els.phaseKicker.textContent='NORMAL GAME';
    els.phaseTitle.textContent='PREDICT THE FUTURE';
    els.phaseRule.textContent='3 BET / BONUS 1/'+CONFIG.hitRate+' / 天井 '+CONFIG.ceiling+'G';
    els.progressLabel.textContent='天井まで';
    els.progressValue.textContent=state.normalSinceHit+' / '+CONFIG.ceiling+'G';
    els.progressBar.style.width=Math.min(100,state.normalSinceHit/CONFIG.ceiling*100)+'%';
    els.currentMode.textContent='NORMAL';
    els.netPerGame.textContent='—';
    els.continueRate.textContent='—';
    els.startMain.textContent=autoRunning?'AUTO STOP':'3枚でSTART';
    els.startSub.textContent=autoRunning?'自動遊技中':state.settings.auto?'AUTO待機 / STARTで再開':'BONUS 1/'+CONFIG.hitRate+' / 天井'+CONFIG.ceiling+'G';
  }else if(state.phase==='bonus'){
    els.modeChip.textContent='PREDICT BONUS';
    els.phaseKicker.textContent='BONUS';
    els.phaseTitle.textContent='PREDICT BONUS';
    els.phaseRule.textContent='20G / 約+33枚 / RUSH確定';
    els.progressLabel.textContent='BONUS';
    els.progressValue.textContent=(CONFIG.bonusGames-state.bonusGamesLeft)+' / '+CONFIG.bonusGames+'G';
    els.progressBar.style.width=((CONFIG.bonusGames-state.bonusGamesLeft)/CONFIG.bonusGames*100)+'%';
    els.currentMode.textContent='BONUS';
    els.netPerGame.textContent='+1.65枚';
    els.continueRate.textContent='RUSH確定';
    els.startMain.textContent=autoRunning?'AUTO STOP':'BONUS START';
    els.startSub.textContent='残り '+state.bonusGamesLeft+'G';
  }else if(state.phase==='complete'){
    els.modeChip.textContent='COMPLETE';
    els.phaseKicker.textContent='SESSION COMPLETE';
    els.phaseTitle.textContent='+19,000';
    els.phaseRule.textContent='コンプリート機能作動';
    els.progressLabel.textContent='COMPLETE';
    els.progressValue.textContent='19,000枚';
    els.progressBar.style.width='100%';
    els.currentMode.textContent='END';
    els.netPerGame.textContent='—';
    els.continueRate.textContent='—';
    els.startMain.textContent='COMPLETE';
    els.startSub.textContent='リセットで再開';
  }else{
    const m=CONFIG.modes[state.rushMode];
    els.modeChip.textContent=state.phase==='judge'?'BATTLE JUDGE':state.phase==='limit'?'LIMIT LINK':m.name;
    els.phaseKicker.textContent=state.phase==='judge'?'SET COMPLETE':state.phase==='limit'?'SMART SLOT SYSTEM':m.short;
    els.phaseTitle.textContent=state.phase==='judge'?'BATTLE JUDGE':state.phase==='limit'?'LIMIT LINK':m.name;
    els.phaseRule.textContent='純増 +'+netText(m.net)+'枚/G / 継続率 '+pct(m.cont)+(m.promo?' / 昇格 '+pct(m.promo):'');
    els.progressLabel.textContent=state.phase==='judge'?'継続抽選':state.phase==='limit'?'再接続率':'SET '+state.setNo;
    els.progressValue.textContent=state.phase==='judge'?pct(m.cont):state.phase==='limit'?pct(m.limit):state.setGame+' / '+CONFIG.setGames+'G';
    els.progressBar.style.width=state.phase==='judge'?pct(m.cont):state.phase==='limit'?pct(m.limit):(state.setGame/CONFIG.setGames*100)+'%';
    els.currentMode.textContent=m.short;
    els.netPerGame.textContent='+'+netText(m.net)+'枚';
    els.continueRate.textContent=pct(m.cont);
    els.startMain.textContent=autoRunning?'AUTO STOP':state.phase==='judge'?'JUDGE START':state.phase==='limit'?'LINK START':'3枚でSTART';
    els.startSub.textContent=autoRunning?'自動遊技中':m.name+' / '+state.setNo+'SET';
  }

  els.startBtn.classList.toggle('stop',autoRunning);
  els.startBtn.disabled=state.complete;
  renderHistory();
}

function reset(){
  stopAuto();
  const settings=state?{...state.settings}:{auto:false,autoSpeed:'normal',sound:true};
  state=freshState();
  state.settings=settings;
  els.autoToggle.checked=state.settings.auto;
  els.autoSpeed.value=state.settings.autoSpeed;
  els.soundToggle.checked=state.settings.sound;
  setReels('◆','◆','◆');
  message('セッションをリセットしました。設定1固定。');
  render();
}

els.startBtn.addEventListener('click',()=>{
  if(state.complete) return;
  if(state.settings.auto){
    if(autoRunning) stopAuto(); else startAuto();
  }else{
    step();
  }
});
els.settingsBtn.addEventListener('click',()=>els.settingsDialog.showModal());
els.autoToggle.addEventListener('change',()=>{
  state.settings.auto=els.autoToggle.checked;
  if(!state.settings.auto) stopAuto();
  render();
});
els.autoSpeed.addEventListener('change',()=>{
  state.settings.autoSpeed=els.autoSpeed.value;
  if(autoRunning) scheduleAuto();
});
els.soundToggle.addEventListener('change',()=>state.settings.sound=els.soundToggle.checked);
els.resetBtn.addEventListener('click',()=>{
  if(confirm('メダル・履歴・戦績をすべてリセットしますか？')){
    reset();
    els.settingsDialog.close();
  }
});
els.historyToggle.addEventListener('click',()=>{
  const hidden=els.historyPanel.classList.toggle('hidden');
  els.historyToggle.textContent=hidden?'履歴を見る':'履歴を閉じる';
});

state=freshState();
els.autoToggle.checked=state.settings.auto;
els.autoSpeed.value=state.settings.autoSpeed;
els.soundToggle.checked=state.settings.sound;
render();
})();