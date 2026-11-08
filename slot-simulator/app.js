import { SlotGame, LABELS } from './engine.js';
const $ = id => document.getElementById(id);
const num = n => Math.round(n).toLocaleString('ja-JP');
const rateText = n => n == null ? '—' : '1/' + n.toFixed(1);
const SAVE_KEY = 'st-redrive-setting1-v2';
let game;
try { game = SlotGame.restore(localStorage.getItem(SAVE_KEY)); }
catch { game = new SlotGame((Date.now() ^ 0x5ac84f12) >>> 0); }
let auto = null, savedAt = 0, lastRender = -1;
const symbols = {
  replay:['↻','↻','↻'],cherry:['🍒','🍒','🍒'],watermelon:['🍉','🍉','🍉'],
  weak:['◇','✦','◇'],strong:['✦','✦','✦'],middle:['★','★','★'],
  common_bell:['🔔','🔔','🔔'],ordinary_bell:['🔔','🔔','🔔'],
  one_coin:['●','●','●'],miss:['◇','◆','◇']
};
const roleNames = {
  replay:'リプレイ',cherry:'チェリー',watermelon:'スイカ',weak:'弱リコリス目',
  strong:'強リコリス目',middle:'中段チェリー',common_bell:'共通ベル',
  ordinary_bell:'ベル',one_coin:'1枚役',miss:'ハズレ'
};
function save() { try { localStorage.setItem(SAVE_KEY, game.serialize()); } catch {} }
function put(id,value) { $(id).textContent = value; }
function render(force=false) {
  if (!force && lastRender === game.games) return;
  lastRender = game.games;
  const s = game.summary;
  put('games',num(s.games));
  put('net',(s.diff > 0 ? '+' : '') + num(s.diff));
  put('rate',s.bets ? s.machineRate.toFixed(2) : '—');
  put('at-rate',rateText(s.atRate));
  put('cz-rate',rateText(s.czRate));
  put('normal-games',num(s.normalGames) + 'G');
  put('in-out',num(s.bets) + ' / ' + num(s.payouts));
  put('cz-count',num(s.czEntries));put('at-count',num(s.atEntries));
  put('bonus-count',num(s.bonuses));put('upper-count',num(s.upperAtEntries));
  put('mode-label',LABELS[game.phase] || game.phase);
  const upper = game.phase.startsWith('upper_') ||
    (game.phase === 'bonus' && game.bonusData && game.bonusData.upper) ||
    (game.phase === 'hold' && game.holdData && game.holdData.parent.startsWith('upper_'));
  const bonus = game.phase === 'bonus';
  const cabinet = document.querySelector('.machine');
  cabinet.classList.toggle('upper',!!upper);
  cabinet.classList.toggle('bonus',bonus);
  put('scene-label',upper ? 'HIGH LEVEL' : bonus ? 'BONUS PAYOUT' : game.phase === 'normal' ? 'NEXT CHANCE' : 'ST ACTIVE');
  put('scene-title',LABELS[game.phase] || game.phase);
  let caption='残りG', value=game.remaining, total=50;
  if (game.phase === 'normal') {
    caption='AT天井まで';value=Math.max(0,game.atCeiling-game.normalSinceAt);total=game.atCeiling;
  } else if (game.phase==='cz' || game.phase==='forced_cz') total=8;
  else if (game.phase==='upper_cz' || game.phase.endsWith('st10')) total=10;
  else if (game.phase==='first20') total=20;
  else if (game.phase==='hold') {caption='HOLD残り';total=4;}
  else if (game.phase==='bonus') {caption='ボーナス残り';total=game.bonusData.total;}
  put('timer-caption',caption);
  $('timer-value').innerHTML = num(value) + '<small>G</small>';
  $('progress-fill').style.width = Math.max(0,Math.min(100,(1-value/total)*100)) + '%';
  $('points').innerHTML = num(game.points) + '<small>/1000pt</small>';
  let description;
  switch(game.phase) {
    case 'normal':
      description=game.comebackRemaining ?
        '上位AT引き戻し 残り'+game.comebackRemaining+'G' :
        'CZ天井まで'+Math.max(0,game.czCeiling-game.normalSinceCz)+'G / スタンプ'+game.stamps+'/12';
      break;
    case 'first20':description='20G以内にボーナスを引け';break;
    case 'front50':description='ボーナス成立でも残り50Gを引き継ぐ';break;
    case 'st10':case 'upper_st10':description='ボーナス成立で10Gに再セット';break;
    case 'hold':description='変換前兆中：STゲーム数停止';break;
    case 'bonus':description=game.bonusData.gross+'枚払い出し（総払出）';break;
    case 'upper_cz':description='突破期待度約70%';break;
    default:description=upper ? '両才能Lv2・1000ptで再セット' : 'CZを突破せよ';
  }
  put('scene-desc',description);
  const combo=symbols[game.lastRole] || symbols.miss;
  for(let i=0;i<3;i++)put('reel-'+(i+1),combo[i]);
  put('role-display',roleNames[game.lastRole] || '—');
  put('last-pay','PAY '+game.lastPay);
  for(const role of ['cherry','watermelon','replay','weak']){
    const lv=game.talents[role] || 0;
    put('talent-'+role,'Lv.'+lv);
    $('meter-'+role).style.width=lv*50+'%';
  }
  put('luck',game.luck ? 'LUCK · 次回昇格' : 'LUCK —');
  $('luck').classList.toggle('active',game.luck);
  const list=$('history');
  list.replaceChildren(...game.history.slice(0,10).map(item=>{
    const li=document.createElement('li');li.className=item.kind;
    const label=document.createElement('strong');label.textContent='GAME '+num(item.game);
    li.append(label,document.createTextNode(item.message));return li;
  }));
  put('auto-indicator',auto ? 'AUTO / '+num(auto.rate)+' G/s' : 'MANUAL MODE');
  for(const id of ['spin','auto','fast'])$(id).disabled=!!auto;
  $('stop').disabled=!auto;
  $('speed').disabled=!!auto;$('target').disabled=!!auto;
}
function spin(){if(auto)return;game.step();render();save();}
function message(text){put('auto-progress',text);}
function stop(reason='停止しました'){
  if(!auto)return;
  const before=auto.start;
  cancelAnimationFrame(auto.frame);auto=null;
  save();render(true);message(reason+' / 今回 '+num(game.games-before)+'G 消化');
}
function stopEvent(events,mode){
  return (mode==='at' && events.some(x=>x.kind==='at' || (x.kind==='upper' && x.message.includes('引き戻し成功')))) ||
    (mode==='bonus' && events.some(x=>x.kind==='bonus' && !x.message.includes('プロローグ'))) ||
    (mode==='upper' && events.some(x=>x.kind==='upper' && x.message.includes('上位ATに突入')));
}
function startAuto(fast=false){
  if(auto)return;
  const speed=fast ? 8000 : Number($('speed').value);
  const mode=$('target').value;
  const maximum=/^\d+$/.test(mode) ? Number(mode) : Infinity;
  auto={start:game.games,rate:speed,mode,maximum,budget:0,last:performance.now(),frame:0};
  render(true);
  message('オート実行中 / '+num(speed)+'G/秒 / '+$('target').selectedOptions[0].textContent);
  function frame(now){
    if(!auto)return;
    const run=auto, elapsed=Math.max(0,Math.min(250,now-run.last));
    run.last=now;run.budget+=elapsed*run.rate/1000;
    const frames=Math.min(1200,Math.floor(run.budget),run.maximum-(game.games-run.start));
    run.budget-=frames;
    for(let i=0;i<frames;i++){
      const events=game.step();
      if(stopEvent(events,run.mode)){stop('停止条件に到達');return;}
    }
    if(game.games-run.start>=run.maximum){stop('指定ゲーム数を消化');return;}
    if(game.games-run.start>=2000000){stop('安全上限200万G');return;}
    render();
    if(now-savedAt>1000){save();savedAt=now;}
    run.frame=requestAnimationFrame(frame);
  }
  auto.frame=requestAnimationFrame(frame);
}
$('spin').addEventListener('click',spin);
$('auto').addEventListener('click',()=>startAuto(false));
$('fast').addEventListener('click',()=>startAuto(true));
$('stop').addEventListener('click',()=>stop());
$('reset').addEventListener('click',()=>{
  if(!confirm('総ゲーム数・差枚・履歴をリセットしますか？'))return;
  stop();game=new SlotGame((Date.now()^0x693812af)>>>0);
  lastRender=-1;save();render(true);message('新しい設定1のゲームを開始');
});
document.addEventListener('keydown',event=>{
  if(event.code!=='Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
    /^(SELECT|BUTTON|INPUT|TEXTAREA)$/.test(document.activeElement?.tagName))return;
  event.preventDefault();spin();
});
window.addEventListener('pagehide',save);
render(true);
