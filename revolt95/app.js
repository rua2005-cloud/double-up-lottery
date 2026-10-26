import {CONFIG,createGame,nextAction,autoCycles,autoUntilUltra,machineRate,continueChance,expectedStats} from './game-engine.mjs';
const SAVE_KEY='revolt95-simulator-v3';
const $=(id)=>document.getElementById(id);
const format=(n)=>Number(n).toLocaleString('ja-JP');
const signed=(n)=>n>0?`+${format(n)}`:n<0?`−${format(-n)}`:'±0';
const phaseMap={normal:'NORMAL MODE',cz:'DOLSIA CHALLENGE',bonus:'BONUS STAGE',rush:'REVOLUTION RUSH',upper:'SUPER REVOLUTION RUSH'};
const texts={
  normal:{number:'3',unit:'BET',title:'通常時',overline:'NEXT: CZ CHALLENGE',desc:'3BET/Gで次のCZまで自動消化',button:'通常時を消化する',upcoming:'CZまで自動消化',label:'NEXT ACTION',symbol:'R'},
  cz:{number:'',unit:'%',title:'ドルシア攻防戦',overline:'CHANCE ZONE / 11 GAMES',desc:'直前の通常時G数によって突破率が変化',button:'CZに挑戦する',upcoming:'',label:'CZ BATTLE',symbol:'C'},
  bonus:{number:'',unit:'',title:'',overline:'BONUS GET',desc:'ボーナス獲得！ AT突入を抽選',button:'ボーナスを消化する',upcoming:'',label:'BONUS DRAW',symbol:'B'},
  rush:{number:'75',unit:'%',title:'革命RUSH',overline:'REVOLUTION RUSH / TRIPLE BREAK',desc:'75%を3回連続突破で超革命RUSHへ',button:'1セット消化・継続抽選',upcoming:'',label:'CURRENT SET',symbol:'R'},
  upper:{number:'',unit:'%',title:'超革命RUSH',overline:'SUPER REVOLUTION RUSH',desc:'継続するたびに継続率アップ / 最大95%',button:'上位ATを1セット消化',upcoming:'',label:'CONTINUE CHANCE',symbol:'S'}
};
function safeLoad(){try{
  const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;
  const s=JSON.parse(raw);
  if(!s||s.version!==3||!phaseMap[s.phase]||!Array.isArray(s.events)||!Array.isArray(s.history)||!Number.isFinite(s.net)||!Number.isFinite(s.totalInput)||s.totalInput<0)return null;
  // Previous version saves have no cross-cycle qualification flags. Keep counters and current game.
  if(typeof s.ultraMode!=='boolean')s.ultraMode=false;
  if(!Number.isSafeInteger(s.ultraCount)||s.ultraCount<0)s.ultraCount=0;
  if(typeof s.previousCycleSuper!=='boolean')s.previousCycleSuper=false;
  if(typeof s.cycleSuperEntered!=='boolean')s.cycleSuperEntered=s.phase==='upper';
  // 旧ルールで抽選済みの通常時G数だけ、新しい振り分けで引き直す（累計記録は保持）。
  if(s.phase==='normal'&&!CONFIG.normalG.some(x=>x.g===s.targetG)){
    let remaining=Math.random();for(const item of CONFIG.normalG){remaining-=item.p;if(remaining<0){s.targetG=item.g;break;}}
  }
  return s;
}catch{return null}}
let state=safeLoad()||createGame();
let sound=false;
let ultraRun=null; // In-memory session only; game progress remains saved after each chunk.
let audio=null;
function tone(f=500,d=.08,shape='sine',volume=.025){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();let osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;osc.type=shape;osc.frequency.setValueAtTime(f,t);gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+d);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+d)}catch{}}
function playSound(phase,kind){if(!sound)return;if(kind==='upper'){tone(830,.18,'triangle');setTimeout(()=>tone(1170,.22,'triangle'),95)}else if(kind==='success'||kind==='rush'){tone(610,.14);setTimeout(()=>tone(860,.14),90)}else if(kind==='lose'){tone(220,.18,'sawtooth',.012)}else tone(430,.09)}
const eventNames={cz:'CHANCE',success:'WIN',lose:'MISS',rush:'RUSH',upper:'SUPER',win:'RESULT',info:'INFO'};
function renderChart(){const box=$('historyChart');box.replaceChildren();if(!state.history.length){const e=document.createElement('p');e.className='empty-state';e.textContent='サイクルを終了すると表示されます';box.append(e);return;}
  const values=[...state.history].reverse();const mx=Math.max(800,...values.map(x=>Math.abs(x.net)));
  for(const item of values){const slot=document.createElement('div');slot.className='bar-slot';slot.title=`第${item.number}回 ${signed(item.net)}枚`;
    const bar=document.createElement('div');bar.className='bar '+(item.net>=0?'pos':'neg');bar.style.height=`${Math.max(1.8,Math.abs(item.net)/mx*46)}%`;slot.append(bar);box.append(slot);
  }
}
function renderEvents(){const root=$('eventList');root.replaceChildren();if(!state.events.length){let div=document.createElement('div');div.className='empty-state';div.textContent='まだ履歴はありません';root.append(div);return;}
  for(const event of state.events.slice(0,9)){
    const outer=document.createElement('div');outer.className='event';
    const mark=document.createElement('div');mark.className=`event-mark ${event.kind}`;
    const wrap=document.createElement('div');const a=document.createElement('div'),b=document.createElement('div');a.className='event-text';a.textContent=event.text;b.className='event-sub';b.textContent=event.sub;wrap.append(a,b);outer.append(mark,wrap);root.append(outer);
  }
}
function render(){
  const t={...texts[state.phase]};
  if(state.phase==='cz'){
    const games=state.lastNormal?.g ?? state.targetG;
    const chance=CONFIG.czWinByNormalG[games] ?? CONFIG.czWin;
    t.number=String(Math.round(chance*100));
    t.desc=`通常時${games}G消化済（3BET/G） / CZは11G・3BET/G`;
    t.upcoming=`突破率${Math.round(chance*100)}%`;
  }
  if(state.phase==='bonus'){
    const rev=state.bonus==='revolution';
    t.number=rev?'52':'45';t.unit='%';t.title=rev?'革命ボーナス':'決戦ボーナス';
    t.desc=rev?'平均+460枚 / AT突入期待度52%':'+60枚 / AT突入期待度45%';t.upcoming=rev?'革命ボーナスを消化':'決戦ボーナスを消化';
  }
  if(state.phase==='rush'){t.upcoming=`${state.atSetG}G · 純増9枚/G`;}
  if(state.phase==='upper'){
    t.number=String(Math.round(continueChance(state)*100));t.upcoming=`${state.atSetG}G · +${state.atSetG*9}枚`;
    if(state.ultraMode){t.title='ULTRA革命RUSH';t.overline='ULTRA REVOLUTION RUSH';t.desc='2サイクル連続SUPER達成！ 95%固定 / 50G・200G強化';t.symbol='U';}
  }
  $('machine').dataset.phase=state.phase;
  $('machine').dataset.ultra=state.phase==='upper'&&state.ultraMode?'true':'false';
  $('phaseEnglish').textContent=state.phase==='upper'&&state.ultraMode?'ULTRA REVOLUTION RUSH':phaseMap[state.phase];
  $('phaseCounter').textContent=state.phase==='rush'?`BREAK ${state.normalWins}/3`:state.phase==='upper'?`UPPER SET ${state.upperWins+1}`:`CYCLE ${state.cycleCount+1}`;
  $('hudOverline').textContent=t.overline;$('phaseNumber').replaceChildren(document.createTextNode(t.number+' '));
  const unit=document.createElement('small');unit.textContent=t.unit;$('phaseNumber').append(unit);
  $('phaseTitle').textContent=t.title;$('phaseDesc').textContent=t.desc;$('coreSymbol').textContent=t.symbol;
  $('playButtonLabel').textContent=t.button;$('upcomingValue').textContent=t.upcoming;$('upcomingLabel').textContent=t.label;
  $('streak').classList.toggle('hidden',state.phase!=='rush');
  [...$('streak').children].forEach((el,i)=>el.classList.toggle('passed',i<state.normalWins));
  let banner=state.banner;
  $('resultKind').textContent=eventNames[banner.kind]||'EVENT';$('resultText').textContent=banner.text;$('resultSub').textContent=banner.sub;
  $('net').replaceChildren(document.createTextNode(`${signed(state.net)} `));let u=document.createElement('span');u.textContent='枚';$('net').append(u);
  $('net').className='large-number '+(state.net>0?'positive':state.net<0?'negative':'');
  $('bank').textContent=format(state.bank);$('games').textContent=`${format(state.gameCount)} G`;
  $('hudTotalGames').textContent=`${format(state.gameCount)} G`;
  $('hudLastGames').textContent=Number.isFinite(state.lastActionGames)&&state.lastActionGames>0?`+${format(state.lastActionGames)} G`:'—';
  const actual=machineRate(state);$('rate').textContent=actual===null?'—':actual.toFixed(2)+'%';
  for(const [el,field] of [['czCount','czCount'],['bonusCount','bonusCount'],['atCount','atCount'],['upperCount','upperCount'],['ultraCount','ultraCount'],['cycleCount','cycleCount']])$(el).textContent=format(state[field]);
  $('maxRush').textContent=`${format(state.maxRushGain)} 枚`;
  $('chanceCaption').textContent=state.phase==='upper'&&state.ultraMode?'ULTRA突入中！ 95%固定・セットG数優遇。':state.phase==='upper'?`現在${Math.round(continueChance(state)*100)}%。このセットを継続すると次回${Math.round(Math.min(CONFIG.upperCap,continueChance(state)+CONFIG.upperIncrement)*100)}%。`:'前のサイクルと連続でSUPER突入したときのみ25%でULTRA抽選。';
  $('superStreakCaption').textContent=state.phase==='upper'&&state.cycleSuperEntered&&state.previousCycleSuper?'2サイクル連続SUPER達成（ULTRA抽選済み）':state.cycleSuperEntered?'今回SUPER突入済み / 次サイクルもSUPERで25%抽選':state.previousCycleSuper?'前回SUPER達成 / 今回もSUPERで25%抽選':'SUPER連続条件：未達成';
  const running=ultraRun!==null;
  for(const id of ['playButton','auto10','auto100','resetButton'])$(id).disabled=running;
  $('autoUltra').textContent=running?'■ ULTRA探索を停止':state.phase==='upper'&&state.ultraMode?'ULTRA突入中':'▶ 1タップでULTRAまで';
  $('autoUltra').disabled=!running&&state.phase==='upper'&&state.ultraMode;
  $('autoUltra').setAttribute('aria-pressed',String(running));
  renderEvents();renderChart();
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch{}
}
function act(){if(ultraRun)return;nextAction(state);playSound(state.phase,state.banner.kind);render();const box=$('machine');box.classList.remove('flash');void box.offsetWidth;box.classList.add('flash');}
function auto(n){if(ultraRun)return;autoCycles(state,n);playSound(state.phase,state.banner.kind);render();const box=$('machine');box.classList.remove('flash');void box.offsetWidth;box.classList.add('flash');}
// Run normal draws in short chunks so STOP and other UI events remain responsive.
function setUltraStatus(message){$('ultraAutoStatus').textContent=message;}
function endUltraRun(run,status,found=false){
  if(ultraRun!==run)return;
  ultraRun=null;
  state.lastActionGames=state.gameCount-run.startGames;
  render();
  const info=`${format(state.cycleCount-run.startCycles)}サイクル / +${format(state.gameCount-run.startGames)}G`;
  setUltraStatus(`${status}（${info}）`);
  if(found){playSound(state.phase,'upper');const box=$('machine');box.classList.remove('flash');void box.offsetWidth;box.classList.add('flash');}
}
function runUltraChunk(run){
  if(ultraRun!==run)return;
  try{
    const result=autoUntilUltra(state,600);
    run.actions+=result.actions;
    // Show the full automatic run G total, not only the most recent chunk.
    state.lastActionGames=state.gameCount-run.startGames;
    if(result.reached){endUltraRun(run,'ULTRA 95% 突入！ このセットから手動操作できます',true);return;}
    render();
    setUltraStatus(`ULTRA抽選中… ${format(run.actions)}操作 / ${format(state.cycleCount-run.startCycles)}サイクル / +${format(state.gameCount-run.startGames)}G · 停止可能`);
    requestAnimationFrame(()=>runUltraChunk(run));
  }catch(error){
    endUltraRun(run,'自動進行を中断しました');
    console.error('ULTRA autoplay failed',error);
  }
}
function toggleUltraAuto(){
  if(ultraRun){endUltraRun(ultraRun,'探索を停止しました。現在の状態から再開できます');return;}
  if(state.phase==='upper'&&state.ultraMode){setUltraStatus('すでにULTRA 95%に突入しています。');return;}
  const run={startGames:state.gameCount,startCycles:state.cycleCount,actions:0};
  ultraRun=run;
  render();setUltraStatus('2サイクル連続SUPER→25%抽選を繰り返し、ULTRA 95%突入まで自動消化中…');
  requestAnimationFrame(()=>runUltraChunk(run));
}
$('autoUltra').addEventListener('click',toggleUltraAuto);
$('playButton').addEventListener('click',act);
$('auto10').addEventListener('click',()=>auto(10));
$('auto100').addEventListener('click',()=>auto(100));
$('resetButton').addEventListener('click',()=>{if(ultraRun)return;if(window.confirm('累計データをリセットして最初から始めますか？')){state=createGame();render();}});
$('soundButton').addEventListener('click',()=>{sound=!sound;$('soundButton').textContent=sound?'♪ ON':'♪ OFF';if(sound)tone(740,.11)});
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!['BUTTON','INPUT','TEXTAREA','SELECT','SUMMARY'].includes(document.activeElement?.tagName)){e.preventDefault();if(!ultraRun)act();}});
render();
