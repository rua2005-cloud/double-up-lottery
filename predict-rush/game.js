(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    medals:$('medals'), atEarned:$('atEarned'), streak:$('streak'),
    modeChip:$('modeChip'), gaugeText:$('gaugeText'), gauge:[...document.querySelectorAll('#gauge i')],
    machine:$('machine'), roundTitle:$('roundTitle'), roundRule:$('roundRule'),
    payTable:$('payTable'), reels:[$('r1'),$('r2'),$('r3')],
    sumLine:$('sumLine'), probabilityPanel:$('probabilityPanel'),
    pLow:$('pLow'), pMid:$('pMid'), pHigh:$('pHigh'),
    choiceArea:$('choiceArea'), startBtn:$('startBtn'), startMain:$('startMain'), startSub:$('startSub'),
    message:$('message'), atRewardPanel:$('atRewardPanel'), nextReward:$('nextReward'),
    rewardSteps:[...document.querySelectorAll('.reward-ladder [data-step]')],
    gamesStat:$('gamesStat'), hitRateStat:$('hitRateStat'), atCountStat:$('atCountStat'), maxStreakStat:$('maxStreakStat'),
    historyToggle:$('historyToggle'), historyPanel:$('historyPanel'), historyList:$('historyList'),
    settingsBtn:$('settingsBtn'), settingsDialog:$('settingsDialog'),
    probToggle:$('probToggle'), soundToggle:$('soundToggle'), vibrateToggle:$('vibrateToggle'),
    resetBtn:$('resetBtn')
  };

  const NORMAL_PAY = { low:3, mid:5, high:9 };
  const LABEL = { low:'LOW', mid:'MID', high:'HIGH' };

  let state = freshState();

  function freshState(){
    return {
      medals:1000,
      gauge:0,
      inAT:false,
      atEarned:0,
      streak:0,
      waiting:false,
      values:[null,null,null],
      history:[],
      games:0,
      hits:0,
      atCount:0,
      maxStreak:0,
      settings:{ probability:true, sound:true, vibrate:true }
    };
  }

  function roll(){ return 1 + Math.floor(Math.random()*9); }

  function classify(sum){
    if(sum <= 15) return 'low';
    if(sum <= 20) return 'mid';
    return 'high';
  }

  function atReward(n){
    if(n <= 2) return 18;
    if(n === 3) return 37;
    if(n === 4) return 55;
    return 92;
  }

  function vibration(pattern){
    if(!state.settings.vibrate) return;
    try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(_){}
  }

  function tone(type){
    if(!state.settings.sound) return;
    try{
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if(!AudioCtx) return;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(.035, ctx.currentTime);
      gain.connect(ctx.destination);

      const notes = type === 'at'
        ? [523.25,659.25,783.99]
        : type === 'win'
        ? [659.25,783.99]
        : type === 'lose'
        ? [220,174.61]
        : [440];

      notes.forEach((f,i)=>{
        const osc = ctx.createOscillator();
        osc.type='sine';
        osc.frequency.value=f;
        osc.connect(gain);
        const start=ctx.currentTime+i*.07;
        osc.start(start);
        osc.stop(start+.09);
      });
      setTimeout(()=>ctx.close(),500);
    }catch(_){}
  }

  function probabilities(){
    const counts={low:0,mid:0,high:0};
    let total=0;

    if(state.inAT){
      const base=state.values[0]+state.values[1];
      for(let x=1;x<=9;x++){
        counts[classify(base+x)]++;
        total++;
      }
    }else{
      const base=state.values[0];
      for(let a=1;a<=9;a++){
        for(let b=1;b<=9;b++){
          counts[classify(base+a+b)]++;
          total++;
        }
      }
    }
    return {
      low:counts.low/total,
      mid:counts.mid/total,
      high:counts.high/total
    };
  }

  function setMessage(text,type=''){
    els.message.textContent=text;
    els.message.classList.remove('win','lose');
    if(type) els.message.classList.add(type);
  }

  function animateReel(index){
    const el=els.reels[index];
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    setTimeout(()=>el.classList.remove('pop'),220);
  }

  function render(){
    els.medals.textContent=state.medals;
    els.atEarned.textContent=state.inAT?state.atEarned:0;
    els.streak.textContent=state.inAT?state.streak:'—';

    els.gaugeText.textContent=state.gauge+' / 5';
    els.gauge.forEach((g,i)=>g.classList.toggle('on',i<state.gauge));

    els.modeChip.textContent=state.inAT?'PREDICT AT':'NORMAL';
    els.modeChip.classList.toggle('at',state.inAT);
    els.machine.classList.toggle('at',state.inAT);

    els.roundTitle.textContent=state.inAT?'PREDICT AT':'NORMAL GAME';
    els.roundRule.textContent=state.inAT?'0 BET / 2 REELS OPEN':'6 BET / 1 REEL OPEN';
    els.payTable.innerHTML=state.inAT
      ? '<span>MISS <b>END</b></span><span>BET <b>0</b></span>'
      : '<span>LOW <b>3</b></span><span>MID <b>5</b></span><span>HIGH <b>9</b></span>';

    els.atRewardPanel.classList.toggle('is-hidden',!state.inAT);
    if(state.inAT){
      els.nextReward.textContent='NEXT +'+atReward(state.streak+1);
      els.rewardSteps.forEach(step=>{
        const n=Number(step.dataset.step);
        const next=state.streak+1;
        step.classList.toggle('next',(next>=5&&n===5)||next===n);
      });
    }

    state.values.forEach((v,i)=>{
      const span=els.reels[i].querySelector('span');
      span.textContent=v==null?'?':String(v);
      els.reels[i].classList.toggle('covered',v==null);
    });

    els.startBtn.disabled=state.waiting||(!state.inAT&&state.medals<6);
    els.startMain.textContent=state.inAT?'AT NEXT':'6枚でSTART';
    els.startSub.textContent=state.inAT?'BET 0枚 / 2リール公開':'第1リールを公開';

    els.gamesStat.textContent=state.games;
    els.hitRateStat.textContent=state.games?((state.hits/state.games)*100).toFixed(1)+'%':'—';
    els.atCountStat.textContent=state.atCount;
    els.maxStreakStat.textContent=state.maxStreak;

    renderHistory();
  }

  function showProbability(){
    if(!state.settings.probability){
      els.probabilityPanel.classList.add('is-hidden');
      return;
    }
    const p=probabilities();
    els.pLow.textContent=(p.low*100).toFixed(1)+'%';
    els.pMid.textContent=(p.mid*100).toFixed(1)+'%';
    els.pHigh.textContent=(p.high*100).toFixed(1)+'%';
    els.probabilityPanel.classList.remove('is-hidden');
  }

  function startRound(){
    if(state.waiting) return;
    if(!state.inAT){
      if(state.medals<6) return;
      state.medals-=6;
    }

    state.values=[roll(),null,null];
    if(state.inAT) state.values[1]=roll();
    state.waiting=true;

    animateReel(0);
    if(state.inAT) animateReel(1);

    if(state.inAT){
      els.sumLine.textContent='公開合計 '+(state.values[0]+state.values[1])+' + ?';
      setMessage('BETなし。次の的中報酬は +'+atReward(state.streak+1)+'枚。');
    }else{
      els.sumLine.textContent='第1リール '+state.values[0]+' / 残り2リール';
      setMessage('ATゲージ '+state.gauge+'。LOW / MID / HIGH を選択。');
    }

    showProbability();
    els.choiceArea.classList.remove('is-hidden');
    els.startBtn.classList.add('is-hidden');

    vibration(18);
    tone('tap');
    render();
  }

  function addHistory(mode,pred,actual,sum,hit,reward){
    state.history.unshift({mode,pred,actual,sum,hit,reward});
    state.history=state.history.slice(0,8);
  }

  function renderHistory(){
    if(!state.history.length){
      els.historyList.innerHTML='<div class="history-row"><span>—</span><span>まだ結果がありません</span><span></span></div>';
      return;
    }
    els.historyList.innerHTML='';
    state.history.forEach(h=>{
      const row=document.createElement('div');
      row.className='history-row';
      row.innerHTML='<span>'+h.mode+'</span><span>'+h.pred+' → '+h.sum+' ('+h.actual+')</span><strong class="'+(h.hit?'good':'bad')+'">'+(h.hit?('+'+h.reward):'MISS')+'</strong>';
      els.historyList.appendChild(row);
    });
  }

  function choose(pred){
    if(!state.waiting) return;

    const wasAT=state.inAT;
    if(!wasAT) state.values[1]=roll();
    state.values[2]=roll();
    animateReel(1);
    animateReel(2);

    const sum=state.values[0]+state.values[1]+state.values[2];
    const actual=classify(sum);
    const hit=pred===actual;
    let reward=0;

    state.games++;
    if(hit) state.hits++;

    els.sumLine.textContent='TOTAL '+sum+' = '+LABEL[actual];

    if(wasAT){
      if(hit){
        state.streak++;
        state.maxStreak=Math.max(state.maxStreak,state.streak);
        reward=atReward(state.streak);
        state.medals+=reward;
        state.atEarned+=reward;
        setMessage('AT的中。'+LABEL[actual]+' / +'+reward+'枚 / '+state.streak+'連。','win');
        vibration([25,22,36]);
        tone('win');
      }else{
        const total=state.atEarned;
        state.inAT=false;
        state.streak=0;
        state.atEarned=0;
        setMessage('MISS。PREDICT AT終了。獲得 '+total+'枚。','lose');
        vibration(100);
        tone('lose');
      }
    }else{
      if(hit){
        reward=NORMAL_PAY[pred];
        state.medals+=reward;
        state.gauge+=pred==='high'?2:1;

        if(state.gauge>=5){
          state.gauge=0;
          state.inAT=true;
          state.streak=0;
          state.atEarned=0;
          state.atCount++;
          setMessage('的中 +'+reward+'枚。GAUGE MAX → PREDICT AT！','win');
          vibration([30,25,30,25,70]);
          tone('at');
        }else{
          setMessage('的中。+'+reward+'枚 / ゲージ+'+(pred==='high'?2:1)+'。','win');
          vibration(35);
          tone('win');
        }
      }else{
        state.gauge=0;
        setMessage('MISS。'+LABEL[actual]+' / ATゲージ消滅。','lose');
        vibration(80);
        tone('lose');
      }
    }

    addHistory(wasAT?'AT':'通常',LABEL[pred],LABEL[actual],sum,hit,reward);

    state.waiting=false;
    els.choiceArea.classList.add('is-hidden');
    els.probabilityPanel.classList.add('is-hidden');
    els.startBtn.classList.remove('is-hidden');
    render();
  }

  function reset(){
    const keep={...state.settings};
    state=freshState();
    state.settings=keep;
    els.choiceArea.classList.add('is-hidden');
    els.probabilityPanel.classList.add('is-hidden');
    els.startBtn.classList.remove('is-hidden');
    els.sumLine.textContent='STARTで第1リールを公開';
    setMessage('セッションをリセットしました。');
    render();
    els.settingsDialog.close();
  }

  els.startBtn.addEventListener('click',startRound);
  document.querySelectorAll('[data-choice]').forEach(btn=>{
    btn.addEventListener('click',()=>choose(btn.dataset.choice));
  });

  els.historyToggle.addEventListener('click',()=>{
    const hidden=els.historyPanel.classList.toggle('is-hidden');
    els.historyToggle.textContent=hidden?'履歴を見る':'履歴を閉じる';
  });

  els.settingsBtn.addEventListener('click',()=>els.settingsDialog.showModal());

  els.probToggle.addEventListener('change',()=>{
    state.settings.probability=els.probToggle.checked;
    if(state.waiting) showProbability();
    else els.probabilityPanel.classList.add('is-hidden');
  });

  els.soundToggle.addEventListener('change',()=>state.settings.sound=els.soundToggle.checked);
  els.vibrateToggle.addEventListener('change',()=>state.settings.vibrate=els.vibrateToggle.checked);

  els.resetBtn.addEventListener('click',()=>{
    if(window.confirm('メダル・ゲージ・戦績をすべてリセットしますか？')) reset();
  });

  render();
})();
