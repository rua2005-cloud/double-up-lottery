import {CONFIG,createGame,nextAction,autoCycles,machineRate,continueChance,expectedStats} from './game-engine.mjs';
const SAVE_KEY='revolt95-simulator-v3';
const $=(id)=>document.getElementById(id);
const format=(n)=>Number(n).toLocaleString('ja-JP');
const signed=(n)=>n>0?`+${format(n)}`:n<0?`−${format(-n)}`:'±0';
const phaseMap={normal:'NORMAL MODE',cz:'DOLSIA CHALLENGE',bonus:'BONUS STAGE',rush:'REVOLUTION RUSH',upper:'SUPER REVOLUTION RUSH'};
const texts={
  normal:{number:'20',unit:'BET',title:'通常時',overline:'NEXT: CZ CHALLENGE',desc:'1タップで次のCZまで一括消化',button:'通常時を消化する',upcoming:'CZまで一括消化',label:'NEXT ACTION',symbol:'R'},
  cz:{number:'',unit:'%',title:'ドルシア攻防戦',overline:'CHANCE ZONE / 11 GAMES',desc:'直前の通常時G数によって突破率が変化',button:'CZに挑戦する',upcoming:'',label:'CZ BATTLE',symbol:'C'},
  bonus:{number:'',unit:'',title:'',overline:'BONUS GET',desc:'ボーナス獲得！ AT突入を抽選',button:'ボーナスを消化する',upcoming:'',label:'BONUS DRAW',symbol:'B'},
  rush:{number:'75',unit:'%',title:'革命RUSH',overline:'REVOLUTION RUSH / TRIPLE BREAK',desc:'75%を3回連続突破で超革命RUSHへ',button:'1セット消化・継続抽選',upcoming:'',label:'CURRENT SET',symbol:'R'},
  upper:{number:'',unit:'%',title:'超革命RUSH',overline:'SUPER REVOLUTION RUSH',desc:'継続するたびに継続率アップ / 最大95%',button:'上位ATを1セット消化',upcoming:'',label:'CONTINUE CHANCE',symbol:'S'}
};
function safeLoad(){try{
  const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;
  const s=JSON.parse(raw);
  if(!s||s.version!==3||!phaseMap[s.phase]||!Array.isArray(s.events)||!Array.isArray(s.history)||!Number.isFinite(s.net)||!Number.isFinite(s.totalInput)||s.totalInput<0)return null;
  return s;
}catch{return null}}
let state=safeLoad()||createGame();
let sound=false;
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
    t.desc=`${games}G到達 / CZ 11Gを一括消化`;
    t.upcoming=`突破率${Math.round(chance*100)}%`;
  }
  if(state.phase==='bonus'){
    const rev=state.bonus==='revolution';
    t.number=rev?'53':'46';t.unit='%';t.title=rev?'革命ボーナス':'決戦ボーナス';
    t.desc=rev?'平均+460枚 / AT突入期待度53%':'+60枚 / AT突入期待度46%';t.upcoming=rev?'革命ボーナスを消化':'決戦ボーナスを消化';
  }
  if(state.phase==='rush'){t.upcoming=`${state.atSetG}G · 純増9枚/G`;}
  if(state.phase==='upper'){t.number=String(Math.round(continueChance(state)*100));t.upcoming=`${state.atSetG}G · +${state.atSetG*9}枚`;}
  $('machine').dataset.phase=state.phase;
  $('phaseEnglish').textContent=phaseMap[state.phase];
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
  const actual=machineRate(state);$('rate').textContent=actual===null?'—':actual.toFixed(2)+'%';
  for(const [el,field] of [['czCount','czCount'],['bonusCount','bonusCount'],['atCount','atCount'],['upperCount','upperCount'],['cycleCount','cycleCount']])$(el).textContent=format(state[field]);
  $('maxRush').textContent=`${format(state.maxRushGain)} 枚`;
  $('chanceCaption').textContent=state.phase==='upper'?`現在${Math.round(continueChance(state)*100)}%。このセットを継続すると次回${Math.round(Math.min(.95,continueChance(state)+.01)*100)}%。`:'上位突入後、継続成功ごとに+1ポイント。上限95%。';
  renderEvents();renderChart();
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch{}
}
function act(){nextAction(state);playSound(state.phase,state.banner.kind);render();const box=$('machine');box.classList.remove('flash');void box.offsetWidth;box.classList.add('flash');}
function auto(n){autoCycles(state,n);playSound(state.phase,state.banner.kind);render();const box=$('machine');box.classList.remove('flash');void box.offsetWidth;box.classList.add('flash');}
$('playButton').addEventListener('click',act);
$('auto10').addEventListener('click',()=>auto(10));
$('auto100').addEventListener('click',()=>auto(100));
$('resetButton').addEventListener('click',()=>{if(window.confirm('累計データをリセットして最初から始めますか？')){state=createGame();render();}});
$('soundButton').addEventListener('click',()=>{sound=!sound;$('soundButton').textContent=sound?'♪ ON':'♪ OFF';if(sound)tone(740,.11)});
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!['BUTTON','INPUT','TEXTAREA','SELECT','SUMMARY'].includes(document.activeElement?.tagName)){e.preventDefault();act();}});
render();
