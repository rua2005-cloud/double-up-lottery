(() => {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('ja-JP');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const vibrate = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };

  const bankEl = $('bank'), potEl = $('pot'), streakEl = $('streak');
  const atView = $('atView'), atStat = $('atStat'), atBanner = $('atBanner'), atMain = $('atMain'), atSub = $('atSub'), atBadge = $('atBadge');
  const countPanel = $('timeAttack'), countEl = $('timerValue'), countSub = $('timeSub');
  const messageEl = $('message'), ticketEl = $('ticket'), stageEl = $('stage');
  const drawBtn = $('drawBtn'), doubleBtn = $('doubleBtn'), takeBtn = $('takeBtn'), resetBtn = $('resetBtn');
  const hintLabel = $('hintLabel'), hintText = $('hintText'), hintSub = $('hintSub'), hintBox = $('hintBox'), auraWrap = $('auraWrap');
  const historyList = $('historyList'), countdownEl = $('countdown');
  const overlay = $('overlay'), overlayTitle = $('overlayTitle'), overlaySub = $('overlaySub'), overlayAmount = $('overlayAmount'), overlayClose = $('overlayClose');
  const game = $('game'), particles = $('particles');

  const INITIAL_BANK = 5000;
  const MAX_DRAWS = 150;

  let bank = INITIAL_BANK, pot = 0, streak = 0, locked = false;
  let currentDoubleChance = 0.5, currentHint = null, currentHintType = 'none', history = [];
  let hiddenMode = 'cold', hiddenTurns = 8;
  let atActive = false, atHitRate = 0, atDoubleRate = 0, atRound = 0;
  let drawsLeft = MAX_DRAWS, gameOver = false;

  function renderCount() {
    countEl.textContent = String(drawsLeft);
    countPanel.classList.toggle('running', !gameOver && drawsLeft < MAX_DRAWS);
    countPanel.classList.toggle('danger', !gameOver && drawsLeft <= 20);
    countSub.textContent = gameOver
      ? 'GAME FINISH'
      : drawsLeft === MAX_DRAWS
        ? '150回のくじで勝負'
        : drawsLeft > 0
          ? `残り ${drawsLeft} 回`
          : '最後の賞金を精算';
  }

  function finishGame(reason = null) {
    if (gameOver) return;
    gameOver = true;
    locked = false;
    const score = bank + pot;
    const diff = score - INITIAL_BANK;
    const delta = diff >= 0 ? `+${fmt(diff)}` : fmt(diff);
    const usedAll = drawsLeft <= 0;
    const coinOut = !usedAll && bank < 100 && pot <= 0;
    const why = reason || (usedAll ? '150回のくじが終了。' : coinOut ? '所持コインが100未満になり終了。' : 'ゲーム終了。');
    ticketEl.textContent = 'FINISH';
    messageEl.textContent = `${why} 最終スコアは ${fmt(score)}。`;
    vibrate([120, 60, 120, 60, 240]);
    renderCount();
    render();
    showOverlay('good', usedAll ? '150 DRAWS FINISH' : coinOut ? 'COIN OUT' : 'GAME FINISH', `${why}\n最終総コイン：${fmt(score)}\n初期5,000から：${delta}`, `SCORE ${fmt(score)}`);
    overlayClose.textContent = 'もう一度';
  }

  function maybeFinishAfterResolution() {
    if (gameOver || locked || pot > 0) return;
    if (drawsLeft <= 0) finishGame('150回のくじが終了。');
    else if (!atActive && bank < 100) finishGame('所持コインが100未満になり終了。');
  }

  function createParticles() {
    particles.innerHTML = '';
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('span');
      const size = 3 + Math.random() * 7;
      p.className = 'particle';
      p.style.left = `${Math.random() * 100}vw`;
      p.style.bottom = `${-20 - Math.random() * 60}px`;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.animationDuration = `${6 + Math.random() * 8}s`;
      p.style.animationDelay = `${Math.random() * 8}s`;
      p.style.opacity = String(.35 + Math.random() * .4);
      particles.appendChild(p);
    }
  }

  function renderATStatus() {
    if (atActive) {
      atView.textContent = 'AT中';
      atStat.className = 'stat at-on';
      atBanner.classList.add('active');
      atMain.textContent = `AT中 (${atRound}回成功)`;
      atSub.textContent = 'ダブルアップ成功率60% / 80%固定。失敗・賞金受取で終了';
      atBadge.textContent = 'AT';
    } else {
      atView.textContent = '通常状態';
      atStat.className = 'stat at-off';
      atBanner.classList.remove('active');
      atMain.textContent = 'ATはまだ始まっていません';
      atSub.textContent = '通常時の内部状態は非表示。AT突入時だけ告知されます。';
      atBadge.textContent = '—';
    }
  }

  function render() {
    bankEl.textContent = fmt(bank);
    potEl.textContent = fmt(pot);
    streakEl.textContent = streak;
    renderATStatus();
    renderCount();
    drawBtn.disabled = gameOver || locked || pot > 0 || drawsLeft <= 0 || (!atActive && bank < 100);
    doubleBtn.disabled = gameOver || locked || pot <= 0;
    takeBtn.disabled = gameOver || locked || pot <= 0;
    drawBtn.textContent = atActive ? 'AT中：無料で引く' : 'くじを引く';
    doubleBtn.textContent = atActive ? 'AT中：ダブルアップ' : '示唆を信じてダブルアップ';
  }

  function flash(type) {
    stageEl.classList.remove('flash-win', 'flash-lose');
    void stageEl.offsetWidth;
    stageEl.classList.add(type === 'win' ? 'flash-win' : 'flash-lose');
  }
  function shakeScreen() {
    game.classList.remove('shake-screen');
    void game.offsetWidth;
    game.classList.add('shake-screen');
  }
  function animateTicket(type = 'draw') {
    ticketEl.classList.remove('draw', 'flip');
    void ticketEl.offsetWidth;
    ticketEl.classList.add(type);
  }
  function showOverlay(kind, title, sub, amount = '') {
    overlay.className = `overlay show ${kind}`;
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    overlayAmount.textContent = amount;
  }
  function hideOverlay() { overlay.className = 'overlay'; }
  async function suspenseSequence(words) {
    countdownEl.textContent = '';
    for (const w of words) { countdownEl.textContent = w; await sleep(280); }
    countdownEl.textContent = '';
  }

  function advanceHiddenMode() {
    hiddenTurns--;
    if (hiddenTurns > 0) return;
    if (hiddenMode === 'cold') { hiddenMode = 'normal'; hiddenTurns = randInt(3, 5); }
    else { hiddenMode = 'cold'; hiddenTurns = randInt(7, 10); }
  }
  function forcePostATCold() { hiddenMode = 'cold'; hiddenTurns = randInt(8, 11); }

  function lotteryByInternalState() {
    const r = Math.random() * 100;
    if (atActive) {
      if (r >= atHitRate * 100) return 0;
      const h = Math.random() * 100;
      return h < 34 ? 100 : h < 68 ? 200 : h < 92 ? 500 : 1000;
    }
    if (hiddenMode === 'cold') return r < 74 ? 0 : r < 88 ? 100 : r < 96 ? 200 : r < 99 ? 500 : 1000;
    return r < 54 ? 0 : r < 77 ? 100 : r < 91 ? 200 : r < 98 ? 500 : 1000;
  }

  function shouldEnterAT(prize) {
    if (atActive || prize === 0) return false;
    let p = hiddenMode === 'cold' ? .05 : .10;
    // 100回消化後（101回目以降）はAT突入率を一律+5pt。
    if (drawsLeft < 50) p += .05;
    if (prize >= 500) p += .08;
    if (prize >= 1000) p += .08;
    return Math.random() < p;
  }

  function startAT() {
    atActive = true;
    atRound = 0;
    atHitRate = Math.random() < .5 ? .60 : .80;
    atDoubleRate = Math.random() < .5 ? .60 : .80;
  }
  function endAT() {
    atActive = false;
    atHitRate = 0;
    atDoubleRate = 0;
    atRound = 0;
    forcePostATCold();
  }

  function rollDoubleChance() {
    if (atActive) return atDoubleRate;
    const table = hiddenMode === 'cold' ? [.20, .30, .40, .50, .60] : [.30, .40, .50, .60, .70];
    return table[Math.floor(Math.random() * table.length)];
  }

  function weightedPick(items) {
    let r = Math.random() * items.reduce((s, x) => s + x.w, 0);
    for (const x of items) { r -= x.w; if (r <= 0) return x; }
    return items[items.length - 1];
  }

  function makeDoubleHint(c) {
    if (c >= .80) return weightedPick([
      {text:'かなり良い気配がする',sub:'かなり強い示唆。だが確定ではない。',rank:4,w:52},
      {text:'今日は攻めてもよさそうだ',sub:'やや強めの示唆。',rank:3,w:26},
      {text:'悪くない流れだ',sub:'中程度の示唆。',rank:2,w:14},
      {text:'嫌な予感がする…',sub:'まれに逆示唆もある。',rank:1,w:8}
    ]);
    if (c >= .60) return weightedPick([
      {text:'かなり良い気配がする',sub:'強めの示唆。',rank:4,w:24},
      {text:'今日は攻めてもよさそうだ',sub:'前向きな示唆。',rank:3,w:38},
      {text:'悪くない流れだ',sub:'中程度の示唆。',rank:2,w:22},
      {text:'嫌な予感がする…',sub:'外れる逆示唆もある。',rank:1,w:16}
    ]);
    if (c >= .45) return weightedPick([
      {text:'今日は攻めてもよさそうだ',sub:'少し前向きな示唆。',rank:3,w:18},
      {text:'何とも言えない空気だ',sub:'五分前後かもしれない。',rank:2,w:36},
      {text:'悪くない流れだ',sub:'中立より少し上。',rank:2,w:16},
      {text:'嫌な予感がする…',sub:'少し後ろ向きな示唆。',rank:1,w:18},
      {text:'かなり危険な気配だ',sub:'強い警戒示唆。',rank:0,w:12}
    ]);
    if (c >= .30) return weightedPick([
      {text:'かなり良い気配がする',sub:'逆示唆が出ることもある。',rank:4,w:9},
      {text:'今日は攻めてもよさそうだ',sub:'弱い逆示唆。',rank:3,w:14},
      {text:'何とも言えない空気だ',sub:'中立寄り。',rank:2,w:22},
      {text:'嫌な予感がする…',sub:'やや危険寄り。',rank:1,w:30},
      {text:'かなり危険な気配だ',sub:'かなり危険。',rank:0,w:25}
    ]);
    return weightedPick([
      {text:'かなり良い気配がする',sub:'ごく稀に逆の強示唆も出る。',rank:4,w:5},
      {text:'悪くない流れだ',sub:'少し紛らわしい示唆。',rank:2,w:14},
      {text:'嫌な予感がする…',sub:'危険寄りの示唆。',rank:1,w:32},
      {text:'かなり危険な気配だ',sub:'かなり強い警戒示唆。',rank:0,w:49}
    ]);
  }

  function makeATHint() {
    const pool80 = [
      {text:'かなり強いATの気配',sub:'80%ATに期待できそう。確定ではない。',rank:4,w:45},
      {text:'まだまだ続きそうだ',sub:'強めの継続示唆。',rank:3,w:32},
      {text:'悪くないATの流れ',sub:'やや前向きなAT示唆。',rank:2,w:16},
      {text:'少し不安な気配がする',sub:'80%ATでも弱い示唆は出る。',rank:1,w:7}
    ];
    const pool60 = [
      {text:'かなり強いATの気配',sub:'60%ATでも強い示唆が出ることはある。',rank:4,w:8},
      {text:'まだまだ続きそうだ',sub:'少し期待できるが油断は禁物。',rank:3,w:18},
      {text:'悪くないATの流れ',sub:'どちらとも言い切れない。',rank:2,w:27},
      {text:'少し不安な気配がする',sub:'やや弱めのAT示唆。',rank:1,w:32},
      {text:'油断できない流れだ',sub:'弱めのAT示唆。',rank:0,w:15}
    ];
    return weightedPick(atDoubleRate >= .80 ? pool80 : pool60);
  }

  function renderAura(rank) {
    auraWrap.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('span');
      d.className = 'aura-dot';
      if (rank === 2) { if (i < 3) d.classList.add('neutral'); }
      else if (rank >= 3) { if (i < rank + 1) d.classList.add('on'); }
      else if (i < 4 - rank) d.classList.add('bad');
      auraWrap.appendChild(d);
    }
  }

  function setNormalHint() {
    currentDoubleChance = rollDoubleChance();
    currentHint = makeDoubleHint(currentDoubleChance);
    currentHintType = 'double';
    hintLabel.textContent = 'NEXT DOUBLE-UP HINT';
    hintText.textContent = currentHint.text;
    hintSub.textContent = currentHint.sub;
    hintBox.className = `hintbox rank${currentHint.rank}`;
    renderAura(currentHint.rank);
  }

  function setATHint() {
    currentDoubleChance = rollDoubleChance();
    currentHint = makeATHint();
    currentHintType = 'at';
    hintLabel.textContent = 'AT MODE HINT';
    hintText.textContent = currentHint.text;
    hintSub.textContent = `${currentHint.sub} AT中の固定ダブルアップ成功率60% / 80%を推測する示唆です。`;
    hintBox.className = `hintbox rank${currentHint.rank}`;
    renderAura(currentHint.rank);
  }

  function setNewHint() { atActive ? setATHint() : setNormalHint(); }

  function clearHint() {
    currentHint = null;
    currentHintType = 'none';
    hintBox.className = 'hintbox';
    hintLabel.textContent = atActive ? 'AT MODE HINT' : 'NEXT DOUBLE-UP HINT';
    hintText.textContent = 'まだ示唆はありません';
    hintSub.textContent = atActive ? 'AT中のダブルアップ率を示唆します。' : '当選すると次のダブルアップ示唆が表示されます。';
    renderAura(2);
  }

  function updateHistory(result, oldPot, newPot, h, hintType) {
    history.unshift({result, oldPot, newPot, hint:h ? h.text : '示唆なし', hintType});
    history = history.slice(0, 6);
    historyList.innerHTML = '';
    for (const item of history) {
      const span = document.createElement('span');
      span.className = 'tag';
      const label = item.hintType === 'at' ? 'AT示唆' : 'DU示唆';
      span.textContent = item.result === 'win'
        ? `成功 ${fmt(item.oldPot)}→${fmt(item.newPot)} / ${label}「${item.hint}」`
        : `失敗 ${fmt(item.oldPot)}→0 / ${label}「${item.hint}」`;
      historyList.appendChild(span);
    }
  }

  async function drawLottery() {
    if (gameOver || locked || pot > 0 || drawsLeft <= 0) return;
    if (bank < 100 && !atActive) return maybeFinishAfterResolution();

    const usedAT = atActive;
    drawsLeft--;
    if (!usedAT) bank -= 100;
    locked = true;
    streak = 0;
    clearHint();
    animateTicket('draw');
    ticketEl.textContent = '?';
    messageEl.textContent = usedAT ? 'AT中！ 無料で抽選中…' : '抽選中…';
    render();
    await suspenseSequence(usedAT ? ['AT', 'GO!'] : ['…', 'OPEN']);

    const prize = lotteryByInternalState();
    if (!usedAT) advanceHiddenMode();
    let enteredATNow = false;
    if (!usedAT && shouldEnterAT(prize)) { startAT(); enteredATNow = true; }

    pot = prize;
    locked = false;

    if (prize === 0) {
      ticketEl.textContent = 'LOSE';
      messageEl.textContent = usedAT ? 'AT中ハズレ。AT終了。' : 'ハズレ。';
      flash('lose');
      shakeScreen();
    } else {
      ticketEl.textContent = fmt(prize);
      messageEl.textContent = `${fmt(prize)}コイン当選。示唆を確認。`;
      flash('win');
      if (prize >= 500) showOverlay('good', 'CHANCE', '大きめの当選。ここから伸ばせるかも。', `${fmt(prize)} COIN`);
      setNewHint();
    }

    if (enteredATNow) {
      vibrate([80,40,120,40,180]);
      showOverlay('good', 'AT突入', 'ボーナスタイム突入！\nダブルアップ成功率が60%か80%のどちらかに固定されます。\n失敗または賞金受取でAT終了。', 'BONUS TIME');
      messageEl.textContent += ' さらにAT突入！';
    } else if (usedAT) {
      if (prize > 0) {
        atRound++;
        messageEl.textContent += ' AT継続！';
      } else {
        endAT();
        clearHint();
        vibrate([220]);
        showOverlay('overlay-blue', 'AT終了', 'ハズレを引いたためAT終了。ここからは再び通常状態です。', 'END');
      }
    }

    render();
    maybeFinishAfterResolution();
  }

  async function doDoubleUp() {
    if (gameOver || pot <= 0 || locked) return;
    locked = true;
    const oldPot = pot;
    const usedChance = currentDoubleChance;
    const usedHint = currentHint;
    const usedHintType = currentHintType;
    const usedAT = atActive;

    messageEl.textContent = usedAT ? 'AT中の固定ダブルアップ抽選…' : '示唆確認… ダブルアップ抽選へ';
    ticketEl.textContent = '???';
    animateTicket('flip');
    render();
    await suspenseSequence(['3','2','1']);

    const win = Math.random() < usedChance;
    locked = false;

    if (win) {
      pot *= 2;
      streak++;
      if (usedAT) atRound++;
      ticketEl.textContent = 'DOUBLE!';
      vibrate([60,35,90]);
      messageEl.textContent = `成功！ 賞金は ${fmt(pot)} コイン。`;
      updateHistory('win', oldPot, pot, usedHint, usedHintType);
      flash('win');
      game.classList.add('glow-gold');
      setTimeout(() => game.classList.remove('glow-gold'), 700);
      if (pot >= 2000 || streak >= 3) showOverlay('good', 'SUCCESS', 'ダブルアップ成功！', `${fmt(pot)} COIN`);
      setNewHint();
    } else {
      pot = 0;
      streak = 0;
      ticketEl.textContent = 'BUST';
      vibrate([180,70,180]);
      if (usedAT) {
        endAT();
        messageEl.textContent = 'ダブルアップ失敗。今回の賞金は0になり、ATも終了しました。';
      } else {
        messageEl.textContent = '失敗。今回の賞金は0になりました。示唆は確実ではありません。';
      }
      updateHistory('lose', oldPot, 0, usedHint, usedHintType);
      clearHint();
      flash('lose');
      shakeScreen();
      if (usedAT) showOverlay('overlay-blue', 'AT終了', 'ダブルアップ失敗。今回の賞金は消滅し、ATも終了しました。', 'END');
      else showOverlay('bad', 'BUST', 'ダブルアップ失敗。今回の賞金は消滅しました。', '0 COIN');
    }

    render();
    maybeFinishAfterResolution();
  }

  function takePrize() {
    if (gameOver || pot <= 0 || locked) return;
    const amount = pot;
    const usedAT = atActive;
    bank += pot;
    pot = 0;
    streak = 0;
    ticketEl.textContent = 'GET!';

    if (usedAT) {
      endAT();
      clearHint();
      messageEl.textContent = `${fmt(amount)}コインを受け取り、AT終了。`;
      vibrate([80,40,160]);
      showOverlay('overlay-blue', 'AT終了', '賞金を受け取ったためAT終了。AT用の示唆も終了しました。', `${fmt(amount)} COIN GET`);
    } else {
      clearHint();
      messageEl.textContent = `${fmt(amount)}コインを受け取りました。`;
      showOverlay('green', 'GET!', '賞金を安全に受け取りました。', `${fmt(amount)} COIN`);
    }

    flash('win');
    render();
    maybeFinishAfterResolution();
  }

  function resetGame() {
    bank = INITIAL_BANK;
    pot = 0;
    streak = 0;
    locked = false;
    currentDoubleChance = .5;
    currentHint = null;
    currentHintType = 'none';
    history = [];
    hiddenMode = 'cold';
    hiddenTurns = 8;
    atActive = false;
    atHitRate = 0;
    atDoubleRate = 0;
    atRound = 0;
    drawsLeft = MAX_DRAWS;
    gameOver = false;
    historyList.innerHTML = '<span class="tag">まだ記録なし</span>';
    ticketEl.textContent = 'LOTTERY';
    messageEl.textContent = '100コインでくじを1枚引けます。残り150回。';
    countdownEl.textContent = '';
    hideOverlay();
    overlayClose.textContent = '閉じる';
    clearHint();
    render();
  }

  function endGameFromButton() {
    if (gameOver || locked) return;
    finishGame('ゲーム終了。');
    overlayClose.textContent = 'もう一度';
  }

  function closeOverlay() {
    if (gameOver) resetGame();
    else hideOverlay();
  }

  drawBtn.addEventListener('click', drawLottery);
  doubleBtn.addEventListener('click', doDoubleUp);
  takeBtn.addEventListener('click', takePrize);
  resetBtn.addEventListener('click', endGameFromButton);
  overlayClose.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

  createParticles();
  clearHint();
  render();
})();
