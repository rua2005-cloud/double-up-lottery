(() => {
'use strict';

const $=id=>document.getElementById(id);
const els={
  medals:$('medals'),atEarned:$('atEarned'),streak:$('streak'),modeChip:$('modeChip'),
  gaugeText:$('gaugeText'),gauge:[...document.querySelectorAll('#gauge i')],machine:$('machine'),
  roundTitle:$('roundTitle'),roundRule:$('roundRule'),payTable:$('payTable'),atStatus:$('atStatus'),
  atPhaseLabel:$('atPhaseLabel'),atGameText:$('atGameText'),atProgress:$('atProgress'),atStatusNote:$('atStatusNote'),
  atBonusNo:$('atBonusNo'),atTotalGet:$('atTotalGet'),atContinueCount:$('atContinueCount'),atBonusGet:$('atBonusGet'),
  reels:[$('r1'),$('r2'),$('r3')],sumLine:$('sumLine'),probabilityPanel:$('probabilityPanel'),
  probTitle:$('probTitle'),probSub:$('probSub'),pLow:$('pLow'),pMid:$('pMid'),pHigh:$('pHigh'),
  choiceArea:$('choiceArea'),startBtn:$('startBtn'),startMain:$('startMain'),startSub:$('startSub'),
  message:$('message'),gamesStat:$('gamesStat'),hitRateStat:$('hitRateStat'),atCountStat:$('atCountStat'),
  maxStreakStat:$('maxStreakStat'),historyToggle:$('historyToggle'),historyPanel:$('historyPanel'),
  historyList:$('historyList'),settingsBtn:$('settingsBtn'),settingsDialog:$('settingsDialog'),
  probToggle:$('probToggle'),soundToggle:$('soundToggle'),vibrateToggle:$('vibrateToggle'),resetBtn:$('resetBtn')
};

const PAY={low:3,mid:5,high:7};
const LABEL={low:'LOW',mid:'MID',high:'HIGH'};
let state=freshState();

function freshState(){
  return{
    medals:1000,gauge:0,phase:'normal',atEarned:0,atGame:0,atSet:0,atSetStart:0,waiting:false,
    values:[null,null,null],history:[],normalGames:0,normalHits:0,atCount:0,maxSet:0,
    settings:{probability:true,sound:true,vibrate:true}
  };
}

const roll=()=>1+Math.floor(Math.random()*9);
const classify=sum=>sum<=15?'low':sum<=20?'mid':'high';
const signed=n=>(n>=0?'+':'')+n;

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
    const ns=type==='at'?[523,659,784]:type==='win'?[659,784]:type==='lose'?[220,175]:[440];
    ns.forEach((f,i)=>{const o=c.createOscillator();o.frequency.value=f;o.connect(g);const s=c.currentTime+i*.07;o.start(s);o.stop(s+.09)});
    setTimeout(()=>c.close(),500);
  }catch(_){}
}

function setMessage(text,type=''){
  els.message.textContent=text;
  els.message.classList.remove('win','lose');
  if(type)els.message.classList.add(type);
}

function animate(index){
  const e=els.reels[index];
  e.classList.remove('pop');void e.offsetWidth;e.classList.add('pop');
  setTimeout(()=>e.classList.remove('pop'),220);
}

function realProbabilities(){
  const counts={low:0,mid:0,high:0};
  let total=0;
  if(state.phase==='judge'){
    const base=state.values[0]+state.values[1];
    for(let z=1;z<=9;z++){counts[classify(base+z)]++;total++}
  }else{
    const base=state.values[0];
    for(let y=1;y<=9;y++)for(let z=1;z<=9;z++){counts[classify(base+y+z)]++;total++}
  }
  return{low:counts.low/total,mid:counts.mid/total,high:counts.high/total};
}

function showProbability(){
  if(!state.settings.probability){
    els.probabilityPanel.classList.add('is-hidden');
    return;
  }
  if(state.phase==='at'){
    const sum=state.values.reduce((a,b)=>a+b,0);
    const answer=classify(sum);
    els.probTitle.textContent='HIT PROBABILITY';
    els.probSub.textContent='3リール公開済み・正解は確定';
    els.pLow.textContent=answer==='low'?'100%':'0%';
    els.pMid.textContent=answer==='mid'?'100%':'0%';
    els.pHigh.textContent=answer==='high'?'100%':'0%';
  }else{
    const p=realProbabilities();
    els.probTitle.textContent=state.phase==='judge'?'LAST JUDGE':'HIT PROBABILITY';
    els.probSub.textContent='公開情報から算出';
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

function renderAtSummary(){
  if(!els.atBonusNo)return;
  if(state.phase==='normal')return;
  const bonusDiff=state.atEarned-state.atSetStart;
  els.atBonusNo.textContent='BONUS '+state.atSet;
  els.atTotalGet.textContent=signed(state.atEarned)+'枚';
  els.atContinueCount.textContent=Math.max(0,state.atSet-1)+'回';
  els.atBonusGet.textContent=signed(bonusDiff)+'枚';
}

function render(){
  els.medals.textContent=state.medals;
  els.atEarned.textContent=state.phase==='normal'?0:signed(state.atEarned);
  els.streak.textContent=state.phase==='normal'?'—':state.atSet;
  els.gaugeText.textContent=state.gauge+' / 5';
  els.gauge.forEach((g,i)=>g.classList.toggle('on',i<state.gauge));
  els.modeChip.className='mode-chip';
  els.machine.className='machine';

  if(state.phase==='normal'){
    els.modeChip.textContent='NORMAL';
    els.roundTitle.textContent='NORMAL GAME';
    els.roundRule.textContent='6 BET / 1 REEL OPEN';
    els.payTable.innerHTML='<span>LOW <b>3</b></span><span>MID <b>5</b></span><span>HIGH <b>7</b></span>';
    els.atStatus.classList.add('is-hidden');
    els.startMain.textContent='6枚でSTART';
    els.startSub.textContent='第1リールを公開';
  }else if(state.phase==='at'){
    els.modeChip.textContent='BONUS '+state.atSet;
    els.modeChip.classList.add('at');
    els.machine.classList.add('at');
    els.roundTitle.textContent='PREDICT AT';
    els.roundRule.textContent='1 BET / 3 REELS OPEN';
    els.payTable.innerHTML='<span>LOW <b>3</b></span><span>MID <b>5</b></span><span>HIGH <b>7</b></span>';
    els.atStatus.classList.remove('is-hidden');
    els.atStatus.classList.remove('judge');
    els.atPhaseLabel.textContent='BONUS '+state.atSet;
    els.atGameText.textContent=(state.atGame+1)+' / 10';
    els.atStatusNote.textContent='10Gで1ボーナス。3つの数字は全部公開。確率欄の100%を選べば正解。';
    renderAtProgress();renderAtSummary();
    els.startMain.textContent='1枚で BONUS '+state.atSet+' / '+(state.atGame+1)+'G';
    els.startSub.textContent='3リールを全部公開';
  }else{
    els.modeChip.textContent='LAST JUDGE';
    els.modeChip.classList.add('judge');
    els.machine.classList.add('judge');
    els.roundTitle.textContent='LAST JUDGE';
    els.roundRule.textContent='BONUS '+state.atSet+' CONTINUE?';
    els.payTable.innerHTML='<span>HIT <b>NEXT BONUS</b></span><span>MISS <b>END</b></span>';
    els.atStatus.classList.remove('is-hidden');
    els.atStatus.classList.add('judge');
    els.atPhaseLabel.textContent='BONUS '+state.atSet+' COMPLETE';
    els.atGameText.textContent='10 / 10';
    els.atStatusNote.textContent='2リール公開のLAST JUDGE。成功で次のボーナスへ。';
    renderAtProgress();renderAtSummary();
    els.startMain.textContent='LAST JUDGE START';
    els.startSub.textContent='成功で BONUS '+(state.atSet+1)+' / BET 0';
  }

  state.values.forEach((v,i)=>{
    const s=els.reels[i].querySelector('span');
    s.textContent=v==null?'?':v;
    els.reels[i].classList.toggle('covered',v==null);
  });

  els.startBtn.disabled=state.waiting||(state.phase==='normal'&&state.medals<6)||(state.phase==='at'&&state.medals<1);
  els.gamesStat.textContent=state.normalGames;
  els.hitRateStat.textContent=state.normalGames?((state.normalHits/state.normalGames)*100).toFixed(1)+'%':'—';
  els.atCountStat.textContent=state.atCount;
  els.maxStreakStat.textContent=state.maxSet;
  renderHistory();
}

function startRound(){
  if(state.waiting)return;
  if(state.phase==='normal'){
    if(state.medals<6)return;
    state.medals-=6;
    state.values=[roll(),null,null];
    animate(0);
    els.sumLine.textContent='第1リール '+state.values[0]+' / 残り2リール';
    setMessage('ATゲージ '+state.gauge+'。LOW / MID / HIGH を選択。');
  }else if(state.phase==='at'){
    if(state.medals<1)return;
    state.medals-=1;
    state.atEarned-=1;
    state.values=[roll(),roll(),roll()];
    state.values.forEach((_,i)=>animate(i));
    els.sumLine.textContent='3リール公開済み / 確率欄の100%が正解';
    setMessage('BONUS '+state.atSet+' / '+(state.atGame+1)+'G。正解ゾーンを選択。');
  }else{
    state.values=[roll(),roll(),null];
    animate(0);animate(1);
    els.sumLine.textContent='公開合計 '+(state.values[0]+state.values[1])+' + ?';
    setMessage('LAST JUDGE。成功でBONUS '+(state.atSet+1)+'へ。');
  }
  state.waiting=true;
  showProbability();
  els.choiceArea.classList.remove('is-hidden');
  els.startBtn.classList.add('is-hidden');
  vibration(18);tone('tap');render();
}

function addHistory(mode,pred,actual,sum,hit,reward){
  state.history.unshift({mode,pred,actual,sum,hit,reward});
  state.history=state.history.slice(0,10);
}

function renderHistory(){
  if(!state.history.length){
    els.historyList.innerHTML='<div class="history-row"><span>—</span><span>まだ結果がありません</span><span></span></div>';
    return;
  }
  els.historyList.innerHTML='';
  state.history.forEach(h=>{
    const r=document.createElement('div');
    r.className='history-row';
    r.innerHTML='<span>'+h.mode+'</span><span>'+h.pred+' → '+h.sum+' ('+h.actual+')</span><strong class="'+(h.hit?'good':'bad')+'">'+(h.hit?('+'+h.reward):'MISS')+'</strong>';
    els.historyList.appendChild(r);
  });
}

function choose(pred){
  if(!state.waiting)return;
  let actual,hit,reward=0,sum=0;

  if(state.phase==='at'){
    sum=state.values.reduce((a,b)=>a+b,0);
    actual=classify(sum);
    hit=pred===actual;
    state.atGame++;
    els.sumLine.textContent='TOTAL '+sum+' = '+LABEL[actual];
    if(hit){
      reward=PAY[actual];
      state.medals+=reward;
      state.atEarned+=reward;
      setMessage(LABEL[actual]+' 正解！ 払出 +'+reward+'枚 / BONUS '+state.atSet+'。','win');
      vibration([20,18,30]);tone('win');
    }else{
      setMessage('不正解。正解は '+LABEL[actual]+'。払出0枚 / このG差枚 -1。','lose');
      vibration(55);tone('lose');
    }
    addHistory('B'+state.atSet,LABEL[pred],LABEL[actual],sum,hit,reward);
    if(state.atGame>=10){
      state.phase='judge';
      const bonusDiff=state.atEarned-state.atSetStart;
      setMessage('BONUS '+state.atSet+'終了！ 今回 '+signed(bonusDiff)+'枚 / AT累計 '+signed(state.atEarned)+'枚 / 継続 '+Math.max(0,state.atSet-1)+'回。','win');
    }
  }else if(state.phase==='judge'){
    state.values[2]=roll();
    animate(2);
    sum=state.values.reduce((a,b)=>a+b,0);
    actual=classify(sum);
    hit=pred===actual;
    els.sumLine.textContent='TOTAL '+sum+' = '+LABEL[actual];
    if(hit){
      addHistory('JUDGE',LABEL[pred],LABEL[actual],sum,true,0);
      state.atSet++;
      state.maxSet=Math.max(state.maxSet,state.atSet);
      state.atGame=0;
      state.atSetStart=state.atEarned;
      state.phase='at';
      setMessage('JUDGE成功！ '+(state.atSet-1)+'回継続 → BONUS '+state.atSet+'へ。','win');
      vibration([30,25,30,25,70]);tone('at');
    }else{
      addHistory('JUDGE',LABEL[pred],LABEL[actual],sum,false,0);
      const total=state.atEarned;
      const bonuses=state.atSet;
      const continues=Math.max(0,bonuses-1);
      state.phase='normal';
      state.atEarned=0;state.atGame=0;state.atSet=0;state.atSetStart=0;
      setMessage('JUDGE失敗。AT終了 / '+bonuses+'ボーナス / '+continues+'回継続 / AT累計 '+signed(total)+'枚。','lose');
      vibration(110);tone('lose');
    }
  }else{
    state.values[1]=roll();state.values[2]=roll();
    animate(1);animate(2);
    sum=state.values.reduce((a,b)=>a+b,0);
    actual=classify(sum);hit=pred===actual;state.normalGames++;
    els.sumLine.textContent='TOTAL '+sum+' = '+LABEL[actual];
    if(hit){
      state.normalHits++;reward=PAY[pred];state.medals+=reward;state.gauge+=pred==='high'?2:1;
      if(state.gauge>=5){
        state.gauge=0;state.phase='at';state.atEarned=0;state.atGame=0;state.atSet=1;state.atSetStart=0;
        state.atCount++;state.maxSet=Math.max(state.maxSet,1);
        setMessage('的中 +'+reward+'枚。GAUGE MAX → BONUS 1 START！','win');
        vibration([30,25,30,25,70]);tone('at');
      }else{
        setMessage('的中。+'+reward+'枚 / ゲージ+'+(pred==='high'?2:1)+'。','win');
        vibration(35);tone('win');
      }
    }else{
      state.gauge=0;setMessage('MISS。'+LABEL[actual]+' / ATゲージ消滅。','lose');vibration(80);tone('lose');
    }
    addHistory('通常',LABEL[pred],LABEL[actual],sum,hit,reward);
  }

  state.waiting=false;
  els.choiceArea.classList.add('is-hidden');
  els.probabilityPanel.classList.add('is-hidden');
  els.startBtn.classList.remove('is-hidden');
  render();
}

function reset(){
  const keep={...state.settings};state=freshState();state.settings=keep;
  els.choiceArea.classList.add('is-hidden');els.probabilityPanel.classList.add('is-hidden');els.startBtn.classList.remove('is-hidden');
  els.sumLine.textContent='STARTで第1リールを公開';setMessage('セッションをリセットしました。');render();els.settingsDialog.close();
}

els.startBtn.addEventListener('click',startRound);
document.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.choice)));
els.historyToggle.addEventListener('click',()=>{const hidden=els.historyPanel.classList.toggle('is-hidden');els.historyToggle.textContent=hidden?'履歴を見る':'履歴を閉じる'});
els.settingsBtn.addEventListener('click',()=>els.settingsDialog.showModal());
els.probToggle.addEventListener('change',()=>{state.settings.probability=els.probToggle.checked;if(state.waiting)showProbability();else els.probabilityPanel.classList.add('is-hidden')});
els.soundToggle.addEventListener('change',()=>state.settings.sound=els.soundToggle.checked);
els.vibrateToggle.addEventListener('change',()=>state.settings.vibrate=els.vibrateToggle.checked);
els.resetBtn.addEventListener('click',()=>{if(confirm('メダル・ゲージ・戦績をすべてリセットしますか？'))reset()});

render();
})();