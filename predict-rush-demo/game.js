(() => {
'use strict';
const $=id=>document.getElementById(id);
const els={
  boot:$('boot'),enterBtn:$('enterBtn'),app:$('app'),stage:$('stage'),medals:$('medals'),atTotal:$('atTotal'),bonusNo:$('bonusNo'),
  modeEyebrow:$('modeEyebrow'),modeTitle:$('modeTitle'),modeRule:$('modeRule'),riskBadge:$('riskBadge'),gaugeText:$('gaugeText'),
  gauge:[...document.querySelectorAll('#gauge i')],scanZone:document.querySelector('.scan-zone'),reels:[$('r1'),$('r2'),$('r3')],
  sumLine:$('sumLine'),probPanel:$('probPanel'),probLabel:$('probLabel'),probNote:$('probNote'),pLow:$('pLow'),pMid:$('pMid'),pHigh:$('pHigh'),
  probCards:[...document.querySelectorAll('.prob-grid article')],certainty:$('certainty'),choiceArea:$('choiceArea'),startBtn:$('startBtn'),
  startMain:$('startMain'),startSub:$('startSub'),result:$('result'),resultTag:$('resultTag'),resultText:$('resultText'),atStrip:$('atStrip'),
  atStripTitle:$('atStripTitle'),atGame:$('atGame'),atProgress:$('atProgress'),normalGames:$('normalGames'),hitRate:$('hitRate'),atCount:$('atCount'),
  maxBonus:$('maxBonus'),resetBtn:$('resetBtn'),flash:$('flash')
};
const PAY={low:3,mid:5,high:7};
const LABEL={low:'LOW',mid:'MID',high:'HIGH'};
let state=fresh();

function fresh(){return{medals:1000,gauge:0,phase:'normal',waiting:false,values:[null,null,null],atEarned:0,atGame:0,bonus:0,normalGames:0,normalHits:0,atCount:0,maxBonus:0};}
const roll=()=>1+Math.floor(Math.random()*9);
const classify=sum=>sum<=15?'low':sum<=20?'mid':'high';
const sign=n=>n===0?'0':(n>0?'+':'')+n;
function tone(kind){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const c=new A();const g=c.createGain();g.connect(c.destination);g.gain.value=.035;const map={tap:[430],scan:[330,510],win:[650,820],gold:[520,660,880],lose:[180,135],at:[392,523,659]};(map[kind]||map.tap).forEach((f,i)=>{const o=c.createOscillator();o.type=kind==='lose'?'sawtooth':'sine';o.frequency.value=f;o.connect(g);const t=c.currentTime+i*.06;o.start(t);o.stop(t+.09)});setTimeout(()=>c.close(),500);}catch(_){}}
function buzz(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(_){}}
function flash(kind){els.flash.className='screen-flash '+kind;void els.flash.offsetWidth;els.flash.className='screen-flash '+kind;setTimeout(()=>els.flash.className='screen-flash',600)}
function message(tag,text,type=''){els.resultTag.textContent=tag;els.resultText.textContent=text;els.result.classList.remove('win','lose');if(type)els.result.classList.add(type)}
function scanAnim(){els.scanZone.classList.remove('active');void els.scanZone.offsetWidth;els.scanZone.classList.add('active');setTimeout(()=>els.scanZone.classList.remove('active'),1050)}
function reelPop(i){const e=els.reels[i];e.classList.remove('pop');void e.offsetWidth;e.classList.add('pop');setTimeout(()=>e.classList.remove('pop'),260)}

function probabilities(){
  if(state.phase==='at'){
    const ans=classify(state.values.reduce((a,b)=>a+b,0));
    return{low:ans==='low'?1:0,mid:ans==='mid'?1:0,high:ans==='high'?1:0};
  }
  const c={low:0,mid:0,high:0};let total=0;
  if(state.phase==='judge'){
    const base=state.values[0]+state.values[1];
    for(let z=1;z<=9;z++){c[classify(base+z)]++;total++;}
  }else{
    const base=state.values[0];
    for(let y=1;y<=9;y++)for(let z=1;z<=9;z++){c[classify(base+y+z)]++;total++;}
  }
  return{low:c.low/total,mid:c.mid/total,high:c.high/total};
}
function showProb(){
  const p=probabilities();
  els.pLow.textContent=(p.low*100).toFixed(p.low===0||p.low===1?0:1)+'%';
  els.pMid.textContent=(p.mid*100).toFixed(p.mid===0||p.mid===1?0:1)+'%';
  els.pHigh.textContent=(p.high*100).toFixed(p.high===0||p.high===1?0:1)+'%';
  const vals=[p.low,p.mid,p.high],max=Math.max(...vals);
  els.probCards.forEach((c,i)=>{c.classList.toggle('best',vals[i]===max&&max>0);c.classList.toggle('perfect',vals[i]===1)});
  const perfect=vals.some(v=>v===1);
  els.certainty.classList.toggle('is-hidden',!perfect||state.phase==='normal');
  if(perfect&&state.phase==='judge'){tone('gold');flash('gold');}
  els.probPanel.classList.remove('is-hidden');
}
function hideDecision(){els.probPanel.classList.add('is-hidden');els.certainty.classList.add('is-hidden');els.choiceArea.classList.add('is-hidden');els.startBtn.classList.remove('is-hidden')}
function reveal(values){state.values=values;values.forEach((v,i)=>{const s=els.reels[i].querySelector('strong');s.textContent=v==null?'?':v;els.reels[i].classList.toggle('hidden',v==null);if(v!=null)reelPop(i);});}
function renderAtProgress(){els.atProgress.innerHTML='';for(let i=0;i<10;i++){const d=document.createElement('i');d.classList.toggle('on',i<state.atGame);els.atProgress.appendChild(d)}}
function render(){
  els.medals.textContent=state.medals;els.atTotal.textContent=state.phase==='normal'?'0':sign(state.atEarned);els.bonusNo.textContent=state.phase==='normal'?'—':state.bonus;
  els.gaugeText.textContent=state.gauge+' / 5';els.gauge.forEach((g,i)=>g.classList.toggle('on',i<state.gauge));
  els.stage.className='stage '+state.phase;
  if(state.phase==='normal'){
    els.modeEyebrow.textContent='ANALYSIS MODE';els.modeTitle.textContent='NORMAL';els.modeRule.textContent='6 BET / 1 REEL OPEN';els.riskBadge.innerHTML='<span>FORECAST</span><b>LIVE</b>';
    els.startMain.textContent='6枚で SCAN';els.startSub.textContent='第1リールを公開';els.atStrip.classList.add('is-hidden');
  }else if(state.phase==='at'){
    els.modeEyebrow.textContent='REWARD PROTOCOL';els.modeTitle.textContent='PREDICT AT';els.modeRule.textContent='1 BET / 3 REELS OPEN';els.riskBadge.innerHTML='<span>ANSWER</span><b>LOCKED</b>';
    els.startMain.textContent='1枚で BONUS '+state.bonus+' / '+(state.atGame+1)+'G';els.startSub.textContent='3データを完全解析';els.atStrip.classList.remove('is-hidden');els.atStripTitle.textContent='BONUS '+state.bonus;els.atGame.textContent=(state.atGame+1)+' / 10';renderAtProgress();
  }else{
    els.modeEyebrow.textContent='FINAL ANALYSIS';els.modeTitle.textContent='LAST JUDGE';els.modeRule.textContent='BET 0 / 2 REELS OPEN';els.riskBadge.innerHTML='<span>BRANCH</span><b>DECIDE</b>';
    els.startMain.textContent='LAST JUDGE';els.startSub.textContent='最後の未来分岐を解析';els.atStrip.classList.remove('is-hidden');els.atStripTitle.textContent='BONUS '+state.bonus+' COMPLETE';els.atGame.textContent='10 / 10';renderAtProgress();
  }
  els.startBtn.disabled=state.waiting||(state.phase==='normal'&&state.medals<6)||(state.phase==='at'&&state.medals<1);
  els.normalGames.textContent=state.normalGames;els.hitRate.textContent=state.normalGames?((state.normalHits/state.normalGames)*100).toFixed(1)+'%':'—';els.atCount.textContent=state.atCount;els.maxBonus.textContent=state.maxBonus;
}
function beginRound(){
  if(state.waiting)return;
  hideDecision();scanAnim();tone('scan');buzz(12);
  if(state.phase==='normal'){
    if(state.medals<6)return;
    state.medals-=6;reveal([roll(),null,null]);els.sumLine.innerHTML='<span>SCAN</span> 第1データ '+state.values[0]+' / 残り2データ';message('ANALYSIS','公開データからLOW / MID / HIGHを予測してください。');els.probLabel.textContent='PREDICTION MATRIX';els.probNote.textContent='公開情報から算出';
  }else if(state.phase==='at'){
    if(state.medals<1)return;
    state.medals-=1;state.atEarned-=1;reveal([roll(),roll(),roll()]);const total=state.values.reduce((a,b)=>a+b,0);els.sumLine.innerHTML='<span>FULL SCAN</span> TOTAL '+total+' / 正解ゾーンを検出済み';message('BONUS','100%表示のゾーンを選択。');els.probLabel.textContent='CERTAIN PREDICTION';els.probNote.textContent='全データ公開済み';
  }else{
    reveal([roll(),roll(),null]);els.sumLine.innerHTML='<span>JUDGE</span> 公開合計 '+(state.values[0]+state.values[1])+' + ?';message('LAST JUDGE','最後の1データを予測。成功で次BONUSへ。');els.probLabel.textContent='BRANCH PROBABILITY';els.probNote.textContent='2データから最終予測';
  }
  state.waiting=true;showProb();els.choiceArea.classList.remove('is-hidden');els.startBtn.classList.add('is-hidden');render();
}
function enterAt(){state.phase='at';state.atCount++;state.bonus=1;state.maxBonus=Math.max(state.maxBonus,1);state.atGame=0;state.atEarned=0;state.gauge=0;hideDecision();reveal([null,null,null]);els.sumLine.innerHTML='<span>LINK</span> PREDICT AT CONNECTED';message('AT START','10G BONUS開始。全データ公開で100%の正解を選択。','win');tone('at');flash('gold');buzz([25,20,40]);render()}
function endAt(){const gain=state.atEarned;state.phase='normal';state.bonus=0;state.atGame=0;state.atEarned=0;state.gauge=0;hideDecision();reveal([null,null,null]);els.sumLine.innerHTML='<span>READY</span> STARTで第1データを取得';message('AT END','AT終了。今回のAT差枚 '+sign(gain)+'枚。NORMALへ復帰。',gain>=0?'win':'lose');render()}
function choose(pred){
  if(!state.waiting)return;
  const beforePhase=state.phase;let total,actual,hit,reward=0;
  if(beforePhase==='normal'){
    state.values[1]=roll();state.values[2]=roll();reveal(state.values);total=state.values.reduce((a,b)=>a+b,0);actual=classify(total);hit=pred===actual;state.normalGames++;
    if(hit){state.normalHits++;reward=PAY[actual];state.medals+=reward;state.gauge=Math.min(5,state.gauge+(actual==='high'?2:1));message('HIT',LABEL[actual]+' 的中 / +'+reward+'枚 / AT LINK '+state.gauge+'/5','win');tone('win');flash('win');buzz([18,16,28]);}else{state.gauge=0;message('MISS','正解は '+LABEL[actual]+'。AT LINK RESET。','lose');tone('lose');flash('lose');buzz(45)}
    els.sumLine.innerHTML='<span>RESULT</span> TOTAL '+total+' = '+LABEL[actual];state.waiting=false;hideDecision();render();if(state.gauge>=5)setTimeout(enterAt,650);return;
  }
  if(beforePhase==='at'){
    total=state.values.reduce((a,b)=>a+b,0);actual=classify(total);hit=pred===actual;state.atGame++;
    if(hit){reward=PAY[actual];state.medals+=reward;state.atEarned+=reward;message('CORRECT',LABEL[actual]+' / +'+reward+'枚　AT TOTAL '+sign(state.atEarned)+'枚','win');tone(actual==='high'?'gold':'win');flash(actual==='high'?'gold':'win');buzz([15,12,25]);}else{message('ERROR','正解は '+LABEL[actual]+'。払出0枚。','lose');tone('lose');flash('lose');buzz(38)}
    els.sumLine.innerHTML='<span>RESULT</span> TOTAL '+total+' = '+LABEL[actual];state.waiting=false;hideDecision();if(state.atGame>=10){state.phase='judge';message('BONUS COMPLETE','BONUS '+state.bonus+' 完了。LAST JUDGEへ移行。','win');}render();return;
  }
  state.values[2]=roll();reveal(state.values);total=state.values.reduce((a,b)=>a+b,0);actual=classify(total);hit=pred===actual;els.sumLine.innerHTML='<span>FINAL</span> TOTAL '+total+' = '+LABEL[actual];state.waiting=false;hideDecision();
  if(hit){state.bonus++;state.maxBonus=Math.max(state.maxBonus,state.bonus);state.atGame=0;state.phase='at';message('JUDGE CLEAR','予測成功。BONUS '+state.bonus+' へ接続。','win');tone('gold');flash('gold');buzz([25,18,45]);render();}
  else{message('JUDGE FAILED','予測失敗。正解は '+LABEL[actual]+'。接続終了。','lose');tone('lose');flash('lose');buzz(70);render();setTimeout(endAt,850)}
}

els.enterBtn.addEventListener('click',()=>{tone('at');els.boot.classList.add('off');els.app.classList.remove('is-locked');setTimeout(()=>els.boot.remove(),650)});
els.startBtn.addEventListener('click',beginRound);
els.choiceArea.addEventListener('click',e=>{const b=e.target.closest('[data-choice]');if(b)choose(b.dataset.choice)});
els.resetBtn.addEventListener('click',()=>{if(!confirm('デモセッションをリセットしますか？'))return;state=fresh();hideDecision();reveal([null,null,null]);els.sumLine.innerHTML='<span>READY</span> STARTで第1データを取得';message('SYSTEM','セッションを初期化しました。');render()});
reveal([null,null,null]);render();
})();