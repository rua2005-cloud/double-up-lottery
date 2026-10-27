import {CONFIG,createGame,nextAction,autoCycles,machineRate,continueChance} from './game-engine.mjs?v=8';
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
  upper:{number:'',unit:'%',title:'超革命RUSH',overline:'SUPER REVOLUTION RUSH',desc:'継続率90%から上昇 / 94%か95%で打ち止め',button:'上位ATを1セット消化',upcoming:'',label:'CONTINUE CHANCE',symbol:'S'}
};
function safeLoad(){try{
  const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;
  const s=JSON.parse(raw);
  if(!s||![3,4,5,6].includes(s.version)||!phaseMap[s.phase]||!Array.isArray(s.events)||!Array.isArray(s.history)||!Number.isFinite(s.net)||!Number.isFinite(s.totalInput)||s.totalInput<0)return null;
  // Retain prior totals; restore in-progress normal phases to the new G distribution.
  if(s.version<6){
    if(s.version===3&&s.phase==='upper'&&s.ultraMode){
      let left=Math.random();for(const x of CONFIG.setLengths){left-=x.p;if(left<0){s.atSetG=x.g;break;}}
    }
    if(s.phase==='normal'){
      let left=Math.random();for(const x of CONFIG.normalG){left-=x.p;if(left<0){s.targetG=x.g;break;}}
    }
    s.upperCap=s.phase==='upper'?(Math.random()<CONFIG.upperCap95Chance?CONFIG.upperCap95:CONFIG.upperCap94):null;
    s.cap94Count=0;s.cap95Count=0;s.version=6;
  }
  if(!Number.isSafeInteger(s.cap94Count)||s.cap94Count<0)s.cap94Count=0;
  if(!Number.isSafeInteger(s.cap95Count)||s.cap95Count<0)s.cap95Count=0;
  if(s.phase==='upper'&&![CONFIG.upperCap94,CONFIG.upperCap95].includes(s.upperCap)){
    s.upperCap=Math.random()<CONFIG.upperCap95Chance?CONFIG.upperCap95:CONFIG.upperCap94;
  }
  if(s.phase==='normal'&&!CONFIG.normalG.some(x=>x.g===s.targetG)){
    let left=Math.random();for(const x of CONFIG.normalG){left-=x.p;if(left<0){s.targetG=x.g;break;}}
  }
  delete s.ultraMode;delete s.ultraCount;delete s.superZeroCount;
  delete s.specialCycle;delete s.previousCycleSuper;delete s.cycleSuperEntered;
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
    t.desc=`通常時${format(games)}G消化済 / CZは11G・3BET/G`;
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
  }
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
  $('hudTotalGames').textContent=`${format(state.gameCount)} G`;
  $('hudLastGames').textContent=Number.isFinite(state.lastActionGames)&&state.lastActionGames>0?`+${format(state.lastActionGames)} G`:'—';
  const actual=machineRate(state);$('rate').textContent=actual===null?'—':actual.toFixed(2)+'%';
  for(const [el,field] of [['czCount','czCount'],['bonusCount','bonusCount'],['atCount','atCount'],['upperCount','upperCount'],['cap94Count','cap94Count'],['cap95Count','cap95Count'],['cycleCount','cycleCount']])$(el).textContent=format(state[field]);
  $('maxRush').textContent=`${format(state.maxRushGain)} 枚`;
  $('chanceCaption').textContent=state.phase==='upper'?`現在${Math.round(continueChance(state)*100)}%。上限は94%（20%）または95%（80%）。`:'SUPER突入時に継続率上限を抽選：80%で95%まで成長、20%で94%打ち止め。';
  $('superStreakCaption').textContent=state.phase==='upper'&&state.upperWins>=5?(state.upperCap===CONFIG.upperCap95?'95%継続に到達！':'94%で打ち止め。以後も94%継続。'):'SUPERは90%から成長。上限に達すると継続率は固定されます。';
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
