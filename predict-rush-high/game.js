(() => {
'use strict';

const $=id=>document.getElementById(id);
const els={
  medals:$('medals'),atEarned:$('atEarned'),streak:$('streak'),modeChip:$('modeChip'),
  gaugeText:$('gaugeText'),gauge:[...document.querySelectorAll('#gauge i')],machine:$('machine'),
  roundTitle:$('roundTitle'),roundRule:$('roundRule'),payTable:$('payTable'),atStatus:$('atStatus'),
  atPhaseLabel:$('atPhaseLabel'),atGameText:$('atGameText'),atProgress:$('atProgress'),atStatusNote:$('atStatusNote'),
  reels:[$('r1'),$('r2'),$('r3')],sumLine:$('sumLine'),probabilityPanel:$('probabilityPanel'),
  probTitle:$('probTitle'),probSub:$('probSub'),pLow:$('pLow'),pMid:$('pMid'),pHigh:$('pHigh'),
  choiceArea:$('choiceArea'),startBtn:$('startBtn'),startMain:$('startMain'),startSub:$('startSub'),
  message:$('message'),gamesStat:$('gamesStat'),hitRateStat:$('hitRateStat'),atCountStat:$('atCountStat'),
  maxStreakStat:$('maxStreakStat'),historyToggle:$('historyToggle'),historyPanel:$('historyPanel'),
  historyList:$('historyList'),firstHitStat:$('firstHitStat'),highRushCountStat:$('highRushCountStat'),
  highRushAvgBonusStat:$('highRushAvgBonusStat'),highRushMaxBonusStat:$('highRushMaxBonusStat'),
  highRushAvgGainStat:$('highRushAvgGainStat'),highRushMaxGainStat:$('highRushMaxGainStat'),
  currentDroughtStat:$('currentDroughtStat'),maxDroughtStat:$('maxDroughtStat'),totalBonusStat:$('totalBonusStat'),
  avgBonusStat:$('avgBonusStat'),judgeRateStat:$('judgeRateStat'),avgAtGainStat:$('avgAtGainStat'),
  maxAtGainStat:$('maxAtGainStat'),totalBetStat:$('totalBetStat'),totalPayoutStat:$('totalPayoutStat'),
  netStat:$('netStat'),rtpStat:$('rtpStat'),settingsBtn:$('settingsBtn'),settingsDialog:$('settingsDialog'),
  probToggle:$('probToggle'),soundToggle:$('soundToggle'),vibrateToggle:$('vibrateToggle'),resetBtn:$('resetBtn')
};

const PAY={low:3,mid:5,high:9};
const LABEL={low:'LOW',mid:'MID',high:'HIGH'};
const NORMAL_BET=12;
const AT_BET=1;
const HIGH_RUSH_UP_RATE=.0392;
const GUARANTEE_RATE=.15;
const RATE_UP_CHANCE_RATE=.20;
const SUPER_RATE_UP_CHANCE_RATE=.20;
const NATURAL_JUDGE_RATE=509/729;
const BOOST_TARGET_RATE=.85;
const SUPER_BOOST_TARGET_RATE=.95;
const BOOST_GUARANTEE_RATE=(BOOST_TARGET_RATE-NATURAL_JUDGE_RATE)/(1-NATURAL_JUDGE_RATE);
const SUPER_BOOST_GUARANTEE_RATE=(SUPER_BOOST_TARGET_RATE-NATURAL_JUDGE_RATE)/(1-NATURAL_JUDGE_RATE);
let state=freshState();

function freshState(){
  return{
    medals:1000,gauge:0,phase:'normal',atEarned:0,atGame:0,atSet:0,waiting:false,
    highRush:false,highRushSet:0,highRushEarned:0,highRushBoosted:false,highRushSuperBoosted:false,guaranteedJudge:false,values:[null,null,null],history:[],
    normalGames:0,normalHits:0,atCount:0,highRushCount:0,maxSet:0,currentDrought:0,maxDrought:0,
    totalBonus:0,totalBet:0,totalPayout:0,completedAtCount:0,totalAtGain:0,maxAtGain:0,
    completedHighRushCount:0,totalHighRushBonus:0,maxHighRushBonus:0,totalHighRushGain:0,maxHighRushGain:0,
    judgeAttempts:0,judgeHits:0,settings:{probability:true,sound:true,vibrate:true}
  };
}

const roll=()=>1+Math.floor(Math.random()*9);
const classify=sum=>sum<=15?'low':sum<=20?'mid':'high';
const signed=n=>n===0?'±0':(n>0?'+':'')+n;
const signedFixed=(n,d=1)=>{
  const s=Number(n).toFixed(d);
  return Number(n)===0?'±'+s:(Number(n)>0?'+':'')+s;
};

function highMultiplier(set){
  if(set<=5)return 3;
  if(set<=10)return 6;
  return 10;
}

function currentGuaranteeRate(){
  if(state.highRushSuperBoosted)return SUPER_BOOST_GUARANTEE_RATE;
  if(state.highRushBoosted)return BOOST_GUARANTEE_RATE;
  return GUARANTEE_RATE;
}

function currentHighRushRateLabel(){
  if(state.highRushSuperBoosted)return '95.0%';
  if(state.highRushBoosted)return '85.0%';
  return '約74.4%';
}

function vibration(pattern){
  if(!state.settings.vibrate)return;
  try{navigator.vibrate&&navigator.vibrate(pattern)}catch(_){}
}

function tone(type){
  if(!state.settings.sound)return;
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C)return;
    const c=new C(),g=c.createGain();
    g.gain.value=.035;g.connect(c.destination);
    const ns=type==='rush'?[659,784,988,1175]:type==='at'?[523,659,784]:type==='win'?[659,784]:type==='lose'?[220,175]:[440];
    ns.forEach((f,i)=>{const o=c.createOscillator();o.frequency.value=f;o.connect(g);const s=c.currentTime+i*.07;o.start(s);o.stop(s+.10)});
    setTimeout(()=>c.close(),650);
  }catch(_){}
}

function setMessage(text,type=''){
  els.message.textContent=text;
  els.message.classList.remove('win','lose');
  if(type)els.message.classList.add(type);
}

function maybeStartRateUpChance(prefix){
  if(!state.highRushBoosted&&Math.random()<RATE_UP_CHANCE_RATE){
    state.phase='boost';state.values=[null,null,null];
    setMessage(prefix+' CONTINUE RATE CHANCE発生！ 成功で85% MODE。','win');
    vibration([25,20,25,20,100]);tone('rush');
    return true;
  }
  if(state.highRushBoosted&&!state.highRushSuperBoosted&&Math.random()<SUPER_RATE_UP_CHANCE_RATE){
    state.phase='superboost';state.values=[null,null,null];
    setMessage(prefix+' SUPER RATE UP CHANCE発生！ 成功で95% MODE。','win');
    vibration([30,18,30,18,120]);tone('rush');
    return true;
  }
  return false;
}

function animate(index){
  const e=els.reels[index];
  e.classList.remove('pop');void e.offsetWidth;e.classList.add('pop');
  setTimeout(()=>e.classList.remove('pop'),220);
}

function realProbabilities(){
  const counts={low:0,mid:0,high:0};
  let total=0;
  if(state.phase==='judge'||state.phase==='boost'||state.phase==='superboost'){
    const base=state.values[0]+state.values[1];
    for(let z=1;z<=9;z++){counts[classify(base+z)]++;total++}
  }else{
    const base=state.values[0];
    for(let y=1;y<=9;y++)for(let z=1;z<=9;z++){counts[classify(base+y+z)]++;total++}
  }
  return{low:counts.low/total,mid:counts.mid/total,high:counts.high/total};
}

function showProbability(){
  if(!state.settings.probability){els.probabilityPanel.classList.add('is-hidden');return}
  if(state.phase==='at'){
    const sum=state.values.reduce((a,b)=>a+b,0);
    const answer=classify(sum);
    els.probTitle.textContent=state.highRush?'HIGH RUSH ×'+highMultiplier(state.highRushSet):'HIT PROBABILITY';
    els.probSub.textContent='3リール公開済み・正解は確定';
    els.pLow.textContent=answer==='low'?'100%':'0%';
    els.pMid.textContent=answer==='mid'?'100%':'0%';
    els.pHigh.textContent=answer==='high'?'100%':'0%';
  }else if(state.phase==='judge'&&state.guaranteedJudge){
    els.probTitle.textContent='GUARANTEED CONTINUE';
    els.probSub.textContent=(currentGuaranteeRate()*100).toFixed(1)+'% ASSIST当選・予想不要';
    els.pLow.textContent='—';els.pMid.textContent='—';els.pHigh.textContent='100%';
  }else{
    const p=realProbabilities();
    els.probTitle.textContent=state.phase==='superboost'?'SUPER RATE UP CHANCE':state.phase==='boost'?'CONTINUE RATE CHANCE':state.phase==='judge'?'BATTLE JUDGE':'HIT PROBABILITY';
    els.probSub.textContent=state.phase==='superboost'?'成功でHIGH RUSH継続期待度95%':state.phase==='boost'?'成功でHIGH RUSH継続期待度85%':'公開情報から算出';
    els.pLow.textContent=(p.low*100).toFixed(1)+'%';
    els.pMid.textContent=(p.mid*100).toFixed(1)+'%';
    els.pHigh.textContent=(p.high*100).toFixed(1)+'%';
  }
  els.probabilityPanel.classList.remove('is-hidden');
}

function renderAtProgress(){
  els.atProgress.innerHTML='';
  for(let i=0;i<10;i++){
    const d=document.createElement('i');
    d.classList.toggle('on',i<state.atGame);
    els.atProgress.appendChild(d);
  }
}

function renderDetailedStats(){
  els.firstHitStat.textContent=state.atCount?'1/'+(state.normalGames/state.atCount).toFixed(1):'—';
  els.highRushCountStat.textContent=state.highRushCount;
  els.highRushAvgBonusStat.textContent=state.completedHighRushCount?(state.totalHighRushBonus/state.completedHighRushCount).toFixed(2):'—';
  els.highRushMaxBonusStat.textContent=state.completedHighRushCount?state.maxHighRushBonus:'—';
  els.highRushAvgGainStat.textContent=state.completedHighRushCount?signedFixed(state.totalHighRushGain/state.completedHighRushCount,1)+'枚':'—';
  els.highRushMaxGainStat.textContent=state.completedHighRushCount?signed(state.maxHighRushGain)+'枚':'—';
  els.currentDroughtStat.textContent=state.currentDrought+'G';
  els.maxDroughtStat.textContent=state.maxDrought+'G';
  els.totalBonusStat.textContent=state.totalBonus;
  els.avgBonusStat.textContent=state.atCount?(state.totalBonus/state.atCount).toFixed(2):'—';
  els.judgeRateStat.textContent=state.judgeAttempts?((state.judgeHits/state.judgeAttempts)*100).toFixed(1)+'%':'—';
  els.avgAtGainStat.textContent=state.completedAtCount?signedFixed(state.totalAtGain/state.completedAtCount,1)+'枚':'—';
  els.maxAtGainStat.textContent=state.completedAtCount?signed(state.maxAtGain)+'枚':'—';
  els.totalBetStat.textContent=state.totalBet+'枚';
  els.totalPayoutStat.textContent=state.totalPayout+'枚';
  els.netStat.textContent=signed(state.totalPayout-state.totalBet)+'枚';
  els.rtpStat.textContent=state.totalBet?((state.totalPayout/state.totalBet)*100).toFixed(2)+'%':'—';
}

function render(){
  els.medals.textContent=state.medals;
  els.atEarned.textContent=state.phase==='normal'?0:signed(state.atEarned);
  els.streak.textContent=state.phase==='normal'?'—':state.atSet;
  els.gaugeText.textContent=state.gauge+' / 5';
  els.gauge.forEach((g,i)=>g.classList.toggle('on',i<state.gauge));
  els.modeChip.className='mode-chip';
  els.machine.className='machine';
  els.atStatus.className='at-status is-hidden';
  els.atProgress.innerHTML='';

  if(state.phase==='normal'){
    els.modeChip.textContent='NORMAL';
    els.roundTitle.textContent='NORMAL GAME';
    els.roundRule.textContent=NORMAL_BET+' BET / 1 REEL OPEN';
    els.payTable.innerHTML='<span>LOW <b>3</b></span><span>MID <b>5</b></span><span>HIGH <b>9</b></span>';
    els.startMain.textContent=NORMAL_BET+'枚でSTART';
    els.startSub.textContent='第1リールを公開';
  }else if(state.phase==='at'){
    els.atStatus.classList.remove('is-hidden');
    els.atGameText.textContent=(state.atGame+1)+' / 10';
    renderAtProgress();
    if(state.highRush){
      const m=highMultiplier(state.highRushSet);
      const low=PAY.low*m,mid=PAY.mid*m,high=PAY.high*m;
      els.atPhaseLabel.textContent='HIGH RUSH BONUS '+state.highRushSet;
      els.modeChip.textContent='HIGH RUSH ×'+m;
      els.modeChip.classList.add('high');
      els.machine.classList.add('high');
      els.atStatus.classList.add('high');
      els.roundTitle.textContent='HIGH RUSH';
      els.roundRule.textContent='1 BET / 3 REELS OPEN / ×'+m;
      els.payTable.innerHTML='<span>LOW <b>'+low+'</b></span><span>MID <b>'+mid+'</b></span><span>HIGH <b>'+high+'</b></span>';
      els.atStatusNote.textContent='10G BONUS・配当×'+m+' / 継続期待度 '+currentHighRushRateLabel()+'。';
      els.startMain.textContent='1枚で HIGH RUSH / '+(state.atGame+1)+'G';
      els.startSub.textContent='10G BONUS・配当×'+m+(state.highRushSuperBoosted?'・95% MODE':state.highRushBoosted?'・85% MODE':'');
    }else{
      els.atPhaseLabel.textContent='BONUS '+state.atSet;
      els.modeChip.textContent='BONUS '+state.atSet;
      els.modeChip.classList.add('at');
      els.machine.classList.add('at');
      els.roundTitle.textContent='PREDICT AT';
      els.roundRule.textContent='1 BET / 3 REELS OPEN';
      els.payTable.innerHTML='<span>LOW <b>3</b></span><span>MID <b>5</b></span><span>HIGH <b>9</b></span>';
      els.atStatusNote.textContent='10Gで1ボーナス。BATTLE JUDGE成功時に3.92%でHIGH RUSH昇格。';
      els.startMain.textContent='1枚で BONUS '+state.atSet+' / '+(state.atGame+1)+'G';
      els.startSub.textContent='3リールを全部公開';
    }
  }else if(state.phase==='boost'||state.phase==='superboost'){
    const isSuper=state.phase==='superboost';
    els.modeChip.textContent=isSuper?'SUPER RATE UP':'RATE UP CHANCE';
    els.modeChip.classList.add('boost');
    els.machine.classList.add('boost');
    els.roundTitle.textContent=isSuper?'SUPER RATE UP CHANCE':'CONTINUE RATE CHANCE';
    els.roundRule.textContent='BET 0 / HIT → '+(isSuper?'95%':'85%')+' MODE';
    els.payTable.innerHTML='<span>HIT <b>'+(isSuper?'95%':'85%')+' MODE</b></span><span>MISS <b>HR CONTINUE</b></span>';
    els.atStatus.classList.remove('is-hidden');
    els.atStatus.classList.add('boost');
    els.atPhaseLabel.textContent=isSuper?'HIGH RUSH SUPER RATE UP':'HIGH RUSH RATE UP';
    els.atGameText.textContent=isSuper?'85% → 95%':'74% → 85%';
    els.atStatusNote.textContent='継続はすでに確定済み。LOW / MID / HIGHを予想し、成功でHIGH RUSH終了まで継続期待度'+(isSuper?'95%':'85%')+'。失敗しても次BONUSへ。';
    els.startMain.textContent=(isSuper?'SUPER ':'')+'RATE UP CHANCE START';
    els.startSub.textContent='成功で'+(isSuper?'95%':'85%')+' MODE / BET 0';
  }else if(state.guaranteedJudge){
    const assist=(currentGuaranteeRate()*100).toFixed(1);
    els.modeChip.textContent='GUARANTEED JUDGE';
    els.modeChip.classList.add('guaranteed');
    els.machine.classList.add('guaranteed');
    els.roundTitle.textContent='BATTLE JUDGE';
    els.roundRule.textContent=assist+'% ASSIST / CONTINUE';
    els.payTable.innerHTML='<span>RESULT <b>CONTINUE</b></span>';
    els.atStatus.classList.remove('is-hidden');
    els.atStatus.classList.add('guaranteed');
    els.atPhaseLabel.textContent='HIGH RUSH BONUS '+state.highRushSet+' COMPLETE';
    els.atGameText.textContent='10 / 10';
    els.atStatusNote.textContent=state.highRushSuperBoosted?'確定継続。95% MODEのまま次BONUSへ。':state.highRushBoosted?'確定継続。次BONUSは確定し、さらに20%でSUPER RATE UP CHANCEを抽選。':'確定継続。次BONUSは確定し、さらに20%でRATE UP CHANCEを抽選。';
    renderAtProgress();
    els.startMain.textContent='確定継続';
    els.startSub.textContent=state.highRushSuperBoosted?'タップで次BONUSへ':state.highRushBoosted?'タップで継続 / 20% SUPER抽選':'タップで継続 / 20% RATE UP抽選';
  }else{
    els.modeChip.textContent='BATTLE JUDGE';
    els.modeChip.classList.add('judge');
    els.machine.classList.add('judge');
    els.roundTitle.textContent='BATTLE JUDGE';
    els.roundRule.textContent=(state.highRush?'HIGH RUSH / ':'')+'BONUS '+state.atSet+' CONTINUE?';
    els.payTable.innerHTML='<span>HIT <b>NEXT BONUS</b></span><span>MISS <b>END</b></span>';
    els.atStatus.classList.remove('is-hidden');
    els.atStatus.classList.add('judge');
    els.atPhaseLabel.textContent=state.highRush?'HIGH RUSH BONUS '+state.highRushSet+' COMPLETE':'BONUS '+state.atSet+' COMPLETE';
    els.atGameText.textContent='10 / 10';
    els.atStatusNote.textContent=state.highRush?(state.highRushSuperBoosted?'95% MODE / HIGH RUSH継続を賭けたBATTLE JUDGE。':state.highRushBoosted?'85% MODE / HIGH RUSH継続を賭けたBATTLE JUDGE。成功後20%でSUPER RATE UP CHANCE。':'BATTLE JUDGE成功で継続確定。その後20%でRATE UP CHANCE。'):'成功で次BONUSへ。さらに3.92%でHIGH RUSHへ昇格。';
    renderAtProgress();
    els.startMain.textContent='BATTLE JUDGE START';
    els.startSub.textContent='成功で BONUS '+(state.atSet+1)+' / BET 0';
  }

  state.values.forEach((v,i)=>{
    const s=els.reels[i].querySelector('span');
    s.textContent=v==null?'?':v;
    els.reels[i].classList.toggle('covered',v==null);
  });

  els.startBtn.disabled=state.waiting||(state.phase==='normal'&&state.medals<NORMAL_BET)||(state.phase==='at'&&state.medals<AT_BET);
  els.gamesStat.textContent=state.normalGames;
  els.hitRateStat.textContent=state.normalGames?((state.normalHits/state.normalGames)*100).toFixed(1)+'%':'—';
  els.atCountStat.textContent=state.atCount;
  els.maxStreakStat.textContent=state.maxSet;
  renderDetailedStats();renderHistory();
}

function resolveGuaranteedJudge(){
  state.judgeAttempts++;state.judgeHits++;
  addHistory('確定JUDGE','ASSIST','CONTINUE','—',true,0);
  state.atSet++;state.highRushSet++;state.totalBonus++;state.maxSet=Math.max(state.maxSet,state.atSet);
  state.atGame=0;state.guaranteedJudge=false;state.values=[null,null,null];
  if(!maybeStartRateUpChance('確定継続！ さらに')){
    state.phase='at';
    setMessage('確定継続！ HIGH RUSH BONUS '+state.highRushSet+'へ。','win');
    vibration([25,20,25,20,80]);tone('rush');
  }
  render();
}

function startRound(){
  if(state.waiting)return;
  if(state.phase==='normal'){
    if(state.medals<NORMAL_BET)return;
    state.medals-=NORMAL_BET;state.totalBet+=NORMAL_BET;
    state.values=[roll(),null,null];animate(0);
    els.sumLine.textContent='第1リール '+state.values[0]+' / 残り2リール';
    setMessage('ATゲージ '+state.gauge+'。LOW / MID / HIGH を選択。');
  }else if(state.phase==='at'){
    if(state.medals<AT_BET)return;
    state.medals-=AT_BET;state.totalBet+=AT_BET;state.atEarned-=AT_BET;
    if(state.highRush)state.highRushEarned-=AT_BET;
    state.values=[roll(),roll(),roll()];
    state.values.forEach((_,i)=>animate(i));
    els.sumLine.textContent='3リール公開済み / 確率欄の100%が正解';
    const bonusLabel=state.highRush?'HIGH RUSH BONUS '+state.highRushSet:'BONUS '+state.atSet;
    setMessage(bonusLabel+' / '+(state.atGame+1)+'G。正解ゾーンを選択。');
  }else if(state.phase==='judge'&&state.guaranteedJudge){
    resolveGuaranteedJudge();return;
  }else{
    state.values=[roll(),roll(),null];animate(0);animate(1);
    els.sumLine.textContent='公開合計 '+(state.values[0]+state.values[1])+' + ?';
    if(state.phase==='superboost')setMessage('SUPER RATE UP CHANCE。継続は確定済み。成功でHIGH RUSH継続期待度95%。');
    else if(state.phase==='boost')setMessage('CONTINUE RATE CHANCE。継続は確定済み。成功でHIGH RUSH継続期待度85%。');
    else setMessage('BATTLE JUDGE。成功でBONUS '+(state.atSet+1)+'へ。');
  }
  state.waiting=true;showProbability();els.choiceArea.classList.remove('is-hidden');els.startBtn.classList.add('is-hidden');
  vibration(18);tone('tap');render();
}

function addHistory(mode,pred,actual,sum,hit,reward){
  state.history.unshift({mode,pred,actual,sum,hit,reward});
  state.history=state.history.slice(0,10);
}

function renderHistory(){
  if(!state.history.length){els.historyList.innerHTML='<div class="history-row"><span>—</span><span>まだ結果がありません</span><span></span></div>';return}
  els.historyList.innerHTML='';
  state.history.forEach(h=>{
    const r=document.createElement('div');r.className='history-row';
    r.innerHTML='<span>'+h.mode+'</span><span>'+h.pred+' → '+h.sum+' ('+h.actual+')</span><strong class="'+(h.hit?'good':'bad')+'">'+(h.hit?(h.reward?('+'+h.reward):'HIT'):'MISS')+'</strong>';
    els.historyList.appendChild(r);
  });
}

function finishAt(){
  const total=state.atEarned,bonuses=state.atSet,continues=Math.max(0,bonuses-1),wasHigh=state.highRush;
  const highRushBonuses=state.highRushSet,highRushGain=state.highRushEarned;
  state.completedAtCount++;state.totalAtGain+=total;state.maxAtGain=Math.max(state.maxAtGain,total);
  if(wasHigh){
    state.completedHighRushCount++;state.totalHighRushBonus+=highRushBonuses;
    state.maxHighRushBonus=Math.max(state.maxHighRushBonus,highRushBonuses);
    state.totalHighRushGain+=highRushGain;
    state.maxHighRushGain=state.completedHighRushCount===1?highRushGain:Math.max(state.maxHighRushGain,highRushGain);
  }
  state.phase='normal';state.atEarned=0;state.atGame=0;state.atSet=0;state.highRush=false;state.highRushSet=0;state.highRushEarned=0;state.highRushBoosted=false;state.highRushSuperBoosted=false;state.guaranteedJudge=false;state.values=[null,null,null];
  setMessage((wasHigh?'HIGH RUSH経由AT':'AT')+'終了 / '+bonuses+'ボーナス / '+continues+'回継続 / AT累計 '+signed(total)+'枚。','lose');
  vibration(110);tone('lose');
}

function choose(pred){
  if(!state.waiting)return;
  let actual,hit,reward=0,sum=0;

  if(state.phase==='at'){
    sum=state.values.reduce((a,b)=>a+b,0);actual=classify(sum);hit=pred===actual;state.atGame++;
    els.sumLine.textContent='TOTAL '+sum+' = '+LABEL[actual];
    if(hit){
      const mult=state.highRush?highMultiplier(state.highRushSet):1;
      reward=PAY[actual]*mult;
      state.medals+=reward;state.totalPayout+=reward;state.atEarned+=reward;
      if(state.highRush)state.highRushEarned+=reward;
      setMessage((state.highRush?'HIGH RUSH ×'+mult+' / ':'')+LABEL[actual]+' 正解！ 払出 +'+reward+'枚。','win');
      vibration([20,18,30]);tone(state.highRush?'rush':'win');
    }else{
      setMessage('不正解。正解は '+LABEL[actual]+'。払出0枚 / このG差枚 -1。','lose');vibration(55);tone('lose');
    }
    addHistory((state.highRush?'HR'+state.highRushSet:'B'+state.atSet),LABEL[pred],LABEL[actual],sum,hit,reward);
    if(state.atGame>=10){
      state.phase='judge';state.guaranteedJudge=state.highRush&&Math.random()<currentGuaranteeRate();
      const completedLabel=state.highRush?'HIGH RUSH BONUS '+state.highRushSet:'BONUS '+state.atSet;
      setMessage(completedLabel+'終了！ AT累計 '+signed(state.atEarned)+'枚。次は'+(state.guaranteedJudge?'確定継続JUDGE！':'BATTLE JUDGE。'),state.guaranteedJudge?'win':'');
      if(state.guaranteedJudge)tone('rush');
    }
  }else if(state.phase==='judge'){
    state.values[2]=roll();animate(2);sum=state.values.reduce((a,b)=>a+b,0);actual=classify(sum);hit=pred===actual;
    state.judgeAttempts++;if(hit)state.judgeHits++;
    els.sumLine.textContent='TOTAL '+sum+' = '+LABEL[actual];
    if(hit){
      addHistory('JUDGE',LABEL[pred],LABEL[actual],sum,true,0);
      state.atSet++;state.totalBonus++;state.maxSet=Math.max(state.maxSet,state.atSet);state.atGame=0;
      if(state.highRush){
        state.highRushSet++;
        if(!maybeStartRateUpChance('BATTLE JUDGE成功！')){
          state.phase='at';
          setMessage('BATTLE JUDGE成功！ HIGH RUSH BONUS '+state.highRushSet+'へ。','win');
          vibration([30,25,30,25,70]);tone('rush');
        }
      }else if(Math.random()<HIGH_RUSH_UP_RATE){
        state.highRush=true;state.highRushSet=1;state.highRushEarned=0;state.highRushBoosted=false;state.highRushSuperBoosted=false;state.highRushCount++;state.phase='at';
        setMessage('BATTLE JUDGE成功！ HIGH RUSH昇格！ BONUS 1 START！','win');
        vibration([30,20,30,20,100]);tone('rush');
      }else{
        state.phase='at';
        setMessage('BATTLE JUDGE成功！ BONUS '+state.atSet+'へ。','win');
        vibration([30,25,30,25,70]);tone('at');
      }
    }else{
      addHistory('JUDGE',LABEL[pred],LABEL[actual],sum,false,0);finishAt();
    }
  }else if(state.phase==='boost'||state.phase==='superboost'){
    const isSuper=state.phase==='superboost';
    state.values[2]=roll();animate(2);sum=state.values.reduce((a,b)=>a+b,0);actual=classify(sum);hit=pred===actual;
    els.sumLine.textContent='TOTAL '+sum+' = '+LABEL[actual];
    addHistory(isSuper?'SUPER UP':'RATE UP',LABEL[pred],LABEL[actual],sum,hit,0);
    state.phase='at';state.values=[null,null,null];
    if(hit){
      if(isSuper){
        state.highRushSuperBoosted=true;
        setMessage('SUPER RATE UP成功！ HIGH RUSHが95% MODEへ昇格！','win');
      }else{
        state.highRushBoosted=true;
        setMessage('RATE UP成功！ HIGH RUSHが85% MODEへ昇格！','win');
      }
      vibration([30,20,30,20,120]);tone('rush');
    }else{
      setMessage(isSuper?'SUPER RATE UP失敗。85% MODEのままHIGH RUSH BONUS '+state.highRushSet+'へ。':'RATE UP失敗。継続期待度は約74.4%のまま。HIGH RUSH BONUS '+state.highRushSet+'へ。','lose');
      vibration(55);tone('lose');
    }
  }else{
    state.values[1]=roll();state.values[2]=roll();animate(1);animate(2);
    sum=state.values.reduce((a,b)=>a+b,0);actual=classify(sum);hit=pred===actual;
    state.normalGames++;state.currentDrought++;state.maxDrought=Math.max(state.maxDrought,state.currentDrought);
    els.sumLine.textContent='TOTAL '+sum+' = '+LABEL[actual];
    if(hit){
      state.normalHits++;reward=PAY[pred];state.medals+=reward;state.totalPayout+=reward;state.gauge+=pred==='high'?2:1;
      if(state.gauge>=5){
        state.gauge=0;state.phase='at';state.atEarned=0;state.atGame=0;state.atSet=1;state.highRush=false;state.highRushSet=0;state.highRushEarned=0;state.highRushBoosted=false;state.highRushSuperBoosted=false;state.guaranteedJudge=false;
        state.atCount++;state.totalBonus++;state.maxSet=Math.max(state.maxSet,1);state.currentDrought=0;
        setMessage('的中 +'+reward+'枚。GAUGE MAX → BONUS 1 START！','win');vibration([30,25,30,25,70]);tone('at');
      }else{
        setMessage('的中。+'+reward+'枚 / ゲージ+'+(pred==='high'?2:1)+'。','win');vibration(35);tone('win');
      }
    }else{
      state.gauge=0;setMessage('MISS。'+LABEL[actual]+' / ATゲージ消滅。','lose');vibration(80);tone('lose');
    }
    addHistory('通常',LABEL[pred],LABEL[actual],sum,hit,reward);
  }

  state.waiting=false;els.choiceArea.classList.add('is-hidden');els.probabilityPanel.classList.add('is-hidden');els.startBtn.classList.remove('is-hidden');render();
}

function reset(){
  const keep={...state.settings};state=freshState();state.settings=keep;
  els.choiceArea.classList.add('is-hidden');els.probabilityPanel.classList.add('is-hidden');els.startBtn.classList.remove('is-hidden');
  els.sumLine.textContent='STARTで第1リールを公開';setMessage('セッションをリセットしました。');render();els.settingsDialog.close();
}

els.startBtn.addEventListener('click',startRound);
document.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.choice)));
els.historyToggle.addEventListener('click',()=>{const hidden=els.historyPanel.classList.toggle('is-hidden');els.historyToggle.textContent=hidden?'詳細を見る':'詳細を閉じる'});
els.settingsBtn.addEventListener('click',()=>els.settingsDialog.showModal());
els.probToggle.addEventListener('change',()=>{state.settings.probability=els.probToggle.checked;if(state.waiting)showProbability();else els.probabilityPanel.classList.add('is-hidden')});
els.soundToggle.addEventListener('change',()=>state.settings.sound=els.soundToggle.checked);
els.vibrateToggle.addEventListener('change',()=>state.settings.vibrate=els.vibrateToggle.checked);
els.resetBtn.addEventListener('click',()=>{if(confirm('メダル・ゲージ・戦績をすべてリセットしますか？'))reset()});

render();
})();
