import {CONFIG,createGame,nextAction,autoCycles,machineRate,continueChance} from './game-engine.mjs?v=9';
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
  if(!s||![3,4,5,6,7].includes(s.version)||!phaseMap[s.phase]||!Array.isArray(s.events)||!Array.isArray(s.history)||!Number.isFinite(s.net)||!Number.isFinite(s.totalInput)||s.totalInput<0)return null;
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
  // Older versions did not store per-cycle details. Preserve balances and counters,
  // start recording full details from the next freshly prepared cycle.
  if(!Array.isArray(s.detailRows))s.detailRows=[];
  if(!s.detailCurrent||typeof s.detailCurrent!=='object')s.detailCurrent=null;
  if(s.detailRows.length>3000)s.detailRows=s.detailRows.slice(-3000);
  s.version=7;
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

const sum=(rows,key)=>rows.reduce((a,r)=>a+(Number(r[key])||0),0);
const pct=(num,den,digits=1)=>den?((num/den)*100).toFixed(digits)+'%':'—';
const average=(rows,key)=>rows.length?Math.round(sum(rows,key)/rows.length).toLocaleString('ja-JP'):'—';
function fillAnalysisTable(id,headers,rows){
  const table=$(id);
  table.replaceChildren();
  const thead=document.createElement('thead'),tr=document.createElement('tr');
  for(const heading of headers){const th=document.createElement('th');th.textContent=heading;tr.append(th);}
  thead.append(tr);table.append(thead);
  const tbody=document.createElement('tbody');
  for(const cells of rows){
    const row=document.createElement('tr');
    for(const item of cells){const cell=document.createElement('td');cell.textContent=String(item);row.append(cell);}
    tbody.append(row);
  }
  table.append(tbody);
}
function analysisMetric(label,value,sub=''){
  const e=document.createElement('div');e.className='analysis-metric';
  const heading=document.createElement('span');heading.textContent=label;
  const n=document.createElement('strong');n.textContent=value;
  e.append(heading,n);
  if(sub){const p=document.createElement('small');p.textContent=sub;e.append(p);}
  return e;
}
function renderAnalytics(){
  const rows=Array.isArray(state.detailRows)?state.detailRows:[];
  const previous=Math.max(0,state.cycleCount-rows.length);
  $('analyticsCoverage').textContent=rows.length
    ?`詳細記録 ${format(rows.length)}サイクル（直近最大3,000件）。過去データ・保存上限外の${format(previous)}サイクルは詳細解析の対象外。現在進行中のサイクルは終了時に記録されます。`
    :`詳細記録はまだありません。現在の累計${format(state.cycleCount)}サイクルについて過去の抽選履歴は復元できません。更新後に完了したサイクルから記録されます。`;
  $('exportDetails').disabled=rows.length===0;
  const summary=$('analyticsSummary');summary.replaceChildren();
  if(!rows.length){
    summary.append(analysisMetric('詳細データ','未計測','既存の累計データは保持されます'));
  }else{
    const input=sum(rows,'input'),output=sum(rows,'output'),net=sum(rows,'net');
    const superRows=rows.filter(r=>r.superCap===94||r.superCap===95);
    const positives=rows.filter(r=>r.net>0).length;
    const best=rows.reduce((a,r)=>Math.max(a,r.net),-Infinity);
    const worst=rows.reduce((a,r)=>Math.min(a,r.net),Infinity);
    const sample=[
      ['実測機械割',pct(output,input,2),'詳細計測区間のみ'],
      ['詳細区間の差枚',(net>0?'+':'')+format(net)+'枚','全モード合計'],
      ['サイクル勝率',pct(positives,rows.length),`${format(positives)} / ${format(rows.length)}`],
      ['CZ突破率',pct(rows.filter(r=>r.czWin===true).length,rows.length),'理論平均60%'],
      ['SUPER平均獲得',average(superRows,'superNet')+'枚','SUPER部分のみ'],
      ['SUPER最多セット',superRows.length?format(Math.max(...superRows.map(r=>r.superSets)))+'セット':'—','1セット10/20/50G'],
      ['最大プラス',`+${format(best)}枚`,'1サイクル'],
      ['最大マイナス',`${format(worst)}枚`,'1サイクル']
    ];
    for(const [label,value,sub] of sample)summary.append(analysisMetric(label,value,sub));
  }
  fillAnalysisTable('czAnalysis',['CZまで','試行','突破','実測突破率','理論突破率','平均収支'],
    CONFIG.normalG.map(item=>{
      const r=rows.filter(x=>x.normalG===item.g);
      const hit=r.filter(x=>x.czWin===true).length;
      return [item.g+'G',format(r.length),format(hit),pct(hit,r.length),(item.p?Math.round(CONFIG.czWinByNormalG[item.g]*100)+'%':'—'),
        r.length?((sum(r,'net')/r.length)>=0?'+':'')+average(r,'net')+'枚':'—'];
    }));
  fillAnalysisTable('bonusAnalysis',['ボーナス','当選','AT突入','実測AT率','理論AT率','平均獲得'],
    [['革命','revolution',.52],['決戦','decisive',.45]].map(([label,type,theory])=>{
      const r=rows.filter(x=>x.bonusType===type),at=r.filter(x=>x.bonusToRush===true).length;
      return [label,format(r.length),format(at),pct(at,r.length),Math.round(theory*100)+'%',r.length?average(r,'bonusNet')+'枚':'—'];
    }));
  const superRows=rows.filter(r=>r.superCap===94||r.superCap===95);
  fillAnalysisTable('superAnalysis',['上限型','突入回数','実際に到達','到達率','平均SUPER純増','平均セット'],
    [94,95].map(cap=>{
      const r=superRows.filter(x=>x.superCap===cap),reached=r.filter(x=>x.superReached).length;
      return [cap+'%（抽選'+(cap===94?'20':'80')+'%）',format(r.length),format(reached),pct(reached,r.length),
        r.length?average(r,'superNet')+'枚':'—',
        r.length?(sum(r,'superSets')/r.length).toFixed(2):'—'];
    }));
  fillAnalysisTable('continuationAnalysis',['継続率','抽選回数','継続成功','実測継続率','理論値'],
    [90,91,92,93,94,95].map((rate,i)=>{
      const attempts=rows.reduce((a,r)=>a+(r.superAttempts?.[i]||0),0);
      const wins=rows.reduce((a,r)=>a+(r.superSuccesses?.[i]||0),0);
      return [rate+'%',format(attempts),format(wins),pct(wins,attempts),rate+'%'];
    }));
  const rushAttempt=sum(rows,'rushAttempts'),rushWin=sum(rows,'rushSuccesses');
  $('rushContinuation').textContent=`通常RUSH・75%抽選：${format(rushWin)} / ${format(rushAttempt)}（実測${pct(rushWin,rushAttempt)}）`;
  const countSet=sum(rows,'set10')+sum(rows,'set20')+sum(rows,'set50');
  fillAnalysisTable('setLengthAnalysis',['セットG数','出現回数','実測比率','理論比率'],
    [[10,'set10','85%'],[20,'set20','12.5%'],[50,'set50','2.5%']].map(([g,key,theory])=>[g+'G',format(sum(rows,key)),pct(sum(rows,key),countSet),theory]));
  fillAnalysisTable('netAnalysis',['収支区分','合計差枚','1サイクル平均'],
    [['通常時','normalNet'],['CZ','czNet'],['ボーナス','bonusNet'],['通常RUSH','rushNet'],['SUPER','superNet']].map(([label,key])=>[
      label,(sum(rows,key)>=0?'+':'')+format(sum(rows,key))+'枚',
      rows.length?((sum(rows,key)>=0?'+':'')+average(rows,key)+'枚'):'—'
    ]));
  fillAnalysisTable('recentCycleAnalysis',
    ['No.','累計G','通常G','CZ','ボーナス','AT','SUPER上限','SUPERセット','SUPER純増','収支'],
    rows.slice(-40).reverse().map(r=>[
      r.number,format(r.startGames+r.games),r.normalG+'G',r.czWin?'成功':'失敗',
      r.bonusType==='revolution'?'革命':r.bonusType==='decisive'?'決戦':'—',
      r.rushSets+r.superSets,r.superCap?r.superCap+'%':'—',r.superSets,
      r.superNet?('+'+format(r.superNet)):'0',(r.net>0?'+':'')+format(r.net)
    ]));
}
function exportDetailsCsv(){
  const rows=Array.isArray(state.detailRows)?state.detailRows:[];
  if(!rows.length)return;
  const fields=[
    ['number','サイクル'],['startGames','開始累計G'],['games','消化G'],['normalG','通常G'],
    ['normalNet','通常時差枚'],['czRate','CZ突破設定'],['czWin','CZ成功'],['czNet','CZ差枚'],
    ['bonusType','ボーナス種類'],['bonusNet','ボーナス差枚'],['bonusToRush','AT当選'],
    ['rushSets','通常RUSHセット'],['rushNet','通常RUSH純増'],['rushAttempts','通常RUSH継続抽選回数'],
    ['rushSuccesses','通常RUSH継続成功数'],['superCap','SUPER上限'],['superReached','SUPER上限到達'],
    ['superSets','SUPERセット'],['superWins','SUPER継続成功'],['superNet','SUPER純増'],
    ['set10','10Gセット'],['set20','20Gセット'],['set50','50Gセット'],
    ['input','投入枚数'],['output','払出枚数'],['net','サイクル差枚'],['endNet','終了時累計差枚']
  ];
  for(let p=90;p<=95;p++){
    fields.push(['superAttempts'+p,p+'%抽選回数'],['superSuccesses'+p,p+'%継続成功']);
  }
  const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
  const lines=[fields.map(x=>cell(x[1])).join(',')];
  for(const row of rows){
    lines.push(fields.map(([field])=>{
      const match=field.match(/^super(Attempts|Successes)(\d+)$/);
      const value=match?row['super'+match[1]]?.[Number(match[2])-90]:row[field];
      return cell(value);
    }).join(','));
  }
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='revolt95-detailed-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
  if($('analyticsDetails').open)renderAnalytics();
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch{}
}
function act(){nextAction(state);playSound(state.phase,state.banner.kind);render();const box=$('machine');box.classList.remove('flash');void box.offsetWidth;box.classList.add('flash');}
function auto(n){autoCycles(state,n);playSound(state.phase,state.banner.kind);render();const box=$('machine');box.classList.remove('flash');void box.offsetWidth;box.classList.add('flash');}
$('analyticsDetails').addEventListener('toggle',()=>{if($('analyticsDetails').open)renderAnalytics();});
$('exportDetails').addEventListener('click',exportDetailsCsv);
$('playButton').addEventListener('click',act);
$('auto10').addEventListener('click',()=>auto(10));
$('auto100').addEventListener('click',()=>auto(100));
$('resetButton').addEventListener('click',()=>{if(window.confirm('累計データをリセットして最初から始めますか？')){state=createGame();render();}});
$('soundButton').addEventListener('click',()=>{sound=!sound;$('soundButton').textContent=sound?'♪ ON':'♪ OFF';if(sound)tone(740,.11)});
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!['BUTTON','INPUT','TEXTAREA','SELECT','SUMMARY'].includes(document.activeElement?.tagName)){e.preventDefault();act();}});
render();
