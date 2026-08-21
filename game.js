(() => {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('ja-JP');
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const vibrate = (pattern) => {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) {}
  };

  const bankEl = $('bank');
  const potEl = $('pot');
  const streakEl = $('streak');
  const atView = $('atView');
  const atStat = $('atStat');
  const atBanner = $('atBanner');
  const atMain = $('atMain');
  const atSub = $('atSub');
  const atBadge = $('atBadge');
  const timeAttack = $('timeAttack');
  const timerEl = $('timerValue');
  const timeSub = $('timeSub');
  const messageEl = $('message');
  const ticketEl = $('ticket');
  const stageEl = $('stage');
  const drawBtn = $('drawBtn');
  const doubleBtn = $('doubleBtn');
  const takeBtn = $('takeBtn');
  const resetBtn = $('resetBtn');
  const hintLabel = $('hintLabel') || document.querySelector('.hint-label');
  const hintText = $('hintText');
  const hintSub = $('hintSub');
  const hintBox = $('hintBox');
  const auraWrap = $('auraWrap');
  const historyList = $('historyList');
  const countdownEl = $('countdown');
  const overlay = $('overlay');
  const overlayTitle = $('overlayTitle');
  const overlaySub = $('overlaySub');
  const overlayAmount = $('overlayAmount');
  const overlayClose = $('overlayClose');
  const game = $('game');
  const particles = $('particles');

  let bank = 10000;
  let pot = 0;
  let streak = 0;
  let locked = false;
  let currentDoubleChance = 0.5;
  let currentHint = null;
  let currentHintType = 'none';
  let history = [];
  let hiddenMode = 'cold';
  let hiddenTurns = 8;
  let atActive = false;
  let atHitRate = 0;
  let atRound = 0;

  const DURATION = 3 * 60 * 1000;
  let started = false;
  let gameOver = false;
  let endAt = 0;
  let timerId = null;

  function timerText(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function renderTimer(ms = DURATION) {
    timerEl.textContent = timerText(ms);
    timeAttack.classList.toggle('running', started && !gameOver);
    timeAttack.classList.toggle('danger', started && !gameOver && ms <= 30000);
    timeSub.textContent = gameOver ? 'TIME UP' : started ? '3分タイムアタック進行中' : '最初のくじでスタート';
  }

  function startTimer() {
    if (started || gameOver) return;
    started = true;
    endAt = Date.now() + DURATION;
    renderTimer(DURATION);
    timerId = setInterval(tickTimer, 250);
  }

  function tickTimer() {
    if (!started || gameOver) return;
    const remaining = endAt - Date.now();
    if (remaining <= 0) return finishGame();
    renderTimer(remaining);
  }

  function finishGame() {
    if (gameOver) return;
    gameOver = true;
    locked = false;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    renderTimer(0);
    const score = bank + pot;
    const diff = score - 10000;
    const delta = diff >= 0 ? `+${fmt(diff)}` : fmt(diff);
    ticketEl.textContent = 'TIME UP';
    messageEl.textContent = `3分終了。最終スコアは ${fmt(score)}。`;
    vibrate([120, 60, 120, 60, 240]);
    showOverlay('good', 'TIME UP', `3分タイムアタック終了\n最終総コイン：${fmt(score)}\n初期10,000から：${delta}`, `SCORE ${fmt(score)}`);
    render();
  }

  function createParticles() {
    particles.innerHTML = '';
    for (let i = 0; i < 28; i += 1) {
      const p = document.createElement('span');
      const size = 3 + Math.random() * 7;
      p.className = 'particle';
      p.style.left = `${Math.random() * 100}vw`;
      p.style.bottom = `${-20 - Math.random() * 60}px`;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.animationDuration = `${6 + Math.random() * 8}s`;
      p.style.animationDelay = `${Math.random() * 8}s`;
      p.style.opacity = String(0.35 + Math.random() * 0.4);
      particles.appendChild(p);
    }
  }

  function renderATStatus() {
    if (atActive) {
      atView.textContent = 'AT中';
      atStat.className = 'stat at-on';
      atBanner.classList.add('active');
      atMain.textContent = `AT中 (${atRound}回成功)`;
      atSub.textContent = '無料抽選 / ハズレを引くとAT終了';
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
    drawBtn.disabled = gameOver || locked || pot > 0 || (!atActive && bank < 100);
    doubleBtn.disabled = gameOver || locked || pot <= 0;
    takeBtn.disabled = gameOver || locked || pot <= 0;
    drawBtn.textContent = atActive ? 'AT中：無料で引く' : 'くじを引く';
    doubleBtn.textContent = atActive ? 'ダブルアップ（AT示唆とは別抽選）' : '示唆を信じてダブルアップ';
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

  function hideOverlay() {
    overlay.className = 'overlay';
  }

  async function suspenseSequence(words) {
    countdownEl.textContent = '';
    for (const word of words) {
      countdownEl.textContent = word;
      await sleep(280);
    }
    countdownEl.textContent = '';
  }

  function advanceHiddenMode() {
    hiddenTurns -= 1;
    if (hiddenTurns > 0) return;
    if (hiddenMode === 'cold') {
      hiddenMode = 'normal';
      hiddenTurns = randInt(3, 5);
    } else {
      hiddenMode = 'cold';
      hiddenTurns = randInt(7, 10);
    }
  }

  function forcePostATCold() {
    hiddenMode = 'cold';
    hiddenTurns = randInt(8, 11);
  }

  function lotteryByInternalState() {
    const r = Math.random() * 100;
    if (atActive) {
      if (r >= atHitRate * 100) return 0;
      const h = Math.random() * 100;
      if (h < 34) return 100;
      if (h < 68) return 200;
      if (h < 92) return 500;
      return 1000;
    }
    if (hiddenMode === 'cold') {
      if (r < 74) return 0;
      if (r < 88) return 100;
      if (r < 96) return 200;
      if (r < 99) return 500;
      return 1000;
    }
    if (r < 54) return 0;
    if (r < 77) return 100;
    if (r < 91) return 200;
    if (r < 98) return 500;
    return 1000;
  }

  function shouldEnterAT(prize) {
    if (atActive || prize === 0) return false;
    let p = hiddenMode === 'cold' ? 0.05 : 0.10;
    if (prize >= 500) p += 0.08;
    if (prize >= 1000) p += 0.08;
    return Math.random() < p;
  }

  function startAT() {
    atActive = true;
    atRound = 0;
    atHitRate = Math.random() < 0.5 ? 0.60 : 0.80;
  }

  function endAT() {
    atActive = false;
    atHitRate = 0;
    atRound = 0;
    forcePostATCold();
  }

  function rollDoubleChance() {
    const table = atActive ? [0.60, 0.70, 0.80] : hiddenMode === 'cold' ? [0.20, 0.30, 0.40, 0.50, 0.60] : [0.30, 0.40, 0.50, 0.60, 0.70];
    return table[Math.floor(Math.random() * table.length)];
  }

  function weightedPick(items) {
    const total = items.reduce((sum, item) => sum + item.w, 0);
    let r = Math.random() * total;
    for (const item of items) {
      r -= item.w;
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  }

  function makeDoubleHint(chance) {
    if (chance >= 0.80) return weightedPick([
      { text: 'かなり良い気配がする', sub: 'かなり強い示唆。だが確定ではない。', rank: 4, w: 52 },
      { text: '今日は攻めてもよさそうだ', sub: 'やや強めの示唆。', rank: 3, w: 26 },
      { text: '悪くない流れだ', sub: '中程度の示唆。', rank: 2, w: 14 },
      { text: '嫌な予感がする…', sub: 'まれに逆示唆もある。', rank: 1, w: 8 }
    ]);
    if (chance >= 0.60) return weightedPick([
      { text: 'かなり良い気配がする', sub: '強めの示唆。', rank: 4, w: 24 },
      { text: '今日は攻めてもよさそうだ', sub: '前向きな示唆。', rank: 3, w: 38 },
      { text: '悪くない流れだ', sub: '中程度の示唆。', rank: 2, w: 22 },
      { text: '嫌な予感がする…', sub: '外れる逆示唆もある。', rank: 1, w: 16 }
    ]);
    if (chance >= 0.45) return weightedPick([
      { text: '今日は攻めてもよさそうだ', sub: '少し前向きな示唆。', rank: 3, w: 18 },
      { text: '何とも言えない空気だ', sub: '五分前後かもしれない。', rank: 2, w: 36 },
      { text: '悪くない流れだ', sub: '中立より少し上。', rank: 2, w: 16 },
      { text: '嫌な予感がする…', sub: '少し後ろ向きな示唆。', rank: 1, w: 18 },
      { text: 'かなり危険な気配だ', sub: '強い警戒示唆。', rank: 0, w: 12 }
    ]);
    if (chance >= 0.30) return weightedPick([
      { text: 'かなり良い気配がする', sub: '逆示唆が出ることもある。', rank: 4, w: 9 },
      { text: '今日は攻めてもよさそうだ', sub: '弱い逆示唆。', rank: 3, w: 14 },
      { text: '何とも言えない空気だ', sub: '中立寄り。', rank: 2, w: 22 },
      { text: '嫌な予感がする…', sub: 'やや危険寄り。', rank: 1, w: 30 },
      { text: 'かなり危険な気配だ', sub: 'かなり危険。', rank: 0, w: 25 }
    ]);
    return weightedPick([
      { text: 'かなり良い気配がする', sub: 'ごく稀に逆の強示唆も出る。', rank: 4, w: 5 },
      { text: '悪くない流れだ', sub: '少し紛らわしい示唆。', rank: 2, w: 14 },
      { text: '嫌な予感がする…', sub: '危険寄りの示唆。', rank: 1, w: 32 },
      { text: 'かなり危険な気配だ', sub: 'かなり強い警戒示唆。', rank: 0, w: 49 }
    ]);
  }

  function makeATHint() {
    const pool80 = [
      { text: 'かなり強いATの気配', sub: '上位のATに期待できそう。確定ではない。', rank: 4, w: 45 },
      { text: 'まだまだ続きそうだ', sub: '強めの継続示唆。', rank: 3, w: 32 },
      { text: '悪くないATの流れ', sub: 'やや前向きなAT示唆。', rank: 2, w: 16 },
      { text: '少し不安な気配がする', sub: '強いATでも弱い示唆は出る。', rank: 1, w: 7 }
    ];
    const pool60 = [
      { text: 'かなり強いATの気配', sub: '低めのATでも強い示唆が出ることはある。', rank: 4, w: 8 },
      { text: 'まだまだ続きそうだ', sub: '少し期待できるが油断は禁物。', rank: 3, w: 18 },
      { text: '悪くないATの流れ', sub: 'どちらとも言い切れない。', rank: 2, w: 27 },
      { text: '少し不安な気配がする', sub: 'やや弱めのAT示唆。', rank: 1, w: 32 },
      { text: '油断できない流れだ', sub: '弱めのAT示唆。', rank: 0, w: 15 }
    ];
    return weightedPick(atHitRate >= 0.80 ? pool80 : pool60);
  }

  function renderAura(rank) {
    auraWrap.innerHTML = '';
    for (let i = 0; i < 5; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'aura-dot';
      if (rank === 2) {
        if (i < 3) dot.classList.add('neutral');
      } else if (rank >= 3) {
        if (i < rank + 1) dot.classList.add('on');
      } else if (i < 4 - rank) {
        dot.classList.add('bad');
      }
      auraWrap.appendChild(dot);
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
    hintSub.textContent = `${currentHint.sub} 60%AT / 80%ATのどちらかを推測する示唆です。`;
    hintBox.className = `hintbox rank${currentHint.rank}`;
    renderAura(currentHint.rank);
  }

  function setNewHint() {
    if (atActive) setATHint();
    else setNormalHint();
  }

  function clearHint() {
    currentHint = null;
    currentHintType = 'none';
    hintBox.className = 'hintbox';
    hintLabel.textContent = atActive ? 'AT MODE HINT' : 'NEXT DOUBLE-UP HINT';
    hintText.textContent = 'まだ示唆はありません';
    hintSub.textContent = atActive ? 'AT中に当たると、60%AT / 80%ATを推測する示唆が表示されます。' : '当選すると次のダブルアップ示唆が表示されます。';
    renderAura(2);
  }

  function updateHistory(result, oldPot, newPot, hint, hintType) {
    history.unshift({ result, oldPot, newPot, hint: hint ? hint.text : '示唆なし', hintType });
    history = history.slice(0, 6);
    historyList.innerHTML = '';
    history.forEach((item) => {
      const span = document.createElement('span');
      span.className = 'tag';
      const label = item.hintType === 'at' ? 'AT示唆' : 'DU示唆';
      span.textContent = item.result === 'win'
        ? `成功 ${fmt(item.oldPot)}→${fmt(item.newPot)} / ${label}「${item.hint}」`
        : `失敗 ${fmt(item.oldPot)}→0 / ${label}「${item.hint}」`;
      historyList.appendChild(span);
    });
  }

  async function drawLottery() {
    if (gameOver || locked || pot > 0) return;
    if (bank < 100 && !atActive) return;
    startTimer();
    const usedAT = atActive;
    if (!usedAT) bank -= 100;
    locked = true;
    streak = 0;
    clearHint();
    animateTicket('draw');
    ticketEl.textContent = '?';
    messageEl.textContent = usedAT ? 'AT中！ 無料で抽選中…' : '抽選中…';
    render();
    await suspenseSequence(usedAT ? ['AT', 'GO!'] : ['…', 'OPEN']);
    if (gameOver) return;

    const prize = lotteryByInternalState();
    if (!usedAT) advanceHiddenMode();
    let enteredATNow = false;
    if (!usedAT && shouldEnterAT(prize)) {
      startAT();
      enteredATNow = true;
    }

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
      vibrate([80, 40, 120, 40, 180]);
      showOverlay('good', 'AT突入', 'ボーナスタイム突入！\nAT中は無料抽選。ハズレを引くまで継続します。\n示唆はATが60%か80%かを推測する内容に切り替わります。', 'BONUS TIME');
      messageEl.textContent += ' さらにAT突入！';
    } else if (usedAT) {
      if (prize > 0) {
        atRound += 1;
        messageEl.textContent += ' AT継続！';
      } else {
        endAT();
        clearHint();
        vibrate([220]);
        showOverlay('overlay-blue', 'AT終了', 'ハズレを引いたためAT終了。ここからは再び通常状態です。', 'END');
      }
    }
    render();
  }

  async function doDoubleUp() {
    if (gameOver || pot <= 0 || locked) return;
    locked = true;
    const oldPot = pot;
    const usedChance = currentDoubleChance;
    const usedHint = currentHint;
    const usedHintType = currentHintType;
    const usedAT = atActive;
    messageEl.textContent = usedAT ? 'AT示唆はAT当選率のヒント。ダブルアップは別抽選…' : '示唆確認… ダブルアップ抽選へ';
    ticketEl.textContent = '???';
    animateTicket('flip');
    render();
    await suspenseSequence(['3', '2', '1']);
    if (gameOver) return;

    const win = Math.random() < usedChance;
    locked = false;
    if (win) {
      pot *= 2;
      streak += 1;
      ticketEl.textContent = 'DOUBLE!';
      vibrate([60, 35, 90]);
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
      vibrate([180, 70, 180]);
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
  }

  function takePrize() {
    if (gameOver || pot <= 0 || locked) return;
    const amount = pot;
    bank += pot;
    pot = 0;
    streak = 0;
    ticketEl.textContent = 'GET!';
    messageEl.textContent = `${fmt(amount)}コインを受け取りました。`;
    if (!atActive) clearHint();
    flash('win');
    showOverlay('green', 'GET!', '賞金を安全に受け取りました。', `${fmt(amount)} COIN`);
    render();
  }

  function resetGame() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    bank = 10000;
    pot = 0;
    streak = 0;
    locked = false;
    currentDoubleChance = 0.5;
    currentHint = null;
    currentHintType = 'none';
    history = [];
    hiddenMode = 'cold';
    hiddenTurns = 8;
    atActive = false;
    atHitRate = 0;
    atRound = 0;
    started = false;
    gameOver = false;
    endAt = 0;
    historyList.innerHTML = '<span class="tag">まだ記録なし</span>';
    ticketEl.textContent = 'LOTTERY';
    messageEl.textContent = '100コインでくじを1枚引けます。';
    countdownEl.textContent = '';
    hideOverlay();
    clearHint();
    renderTimer(DURATION);
    render();
  }

  drawBtn.addEventListener('click', drawLottery);
  doubleBtn.addEventListener('click', doDoubleUp);
  takeBtn.addEventListener('click', takePrize);
  resetBtn.addEventListener('click', resetGame);
  overlayClose.addEventListener('click', hideOverlay);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) hideOverlay();
  });

  createParticles();
  clearHint();
  renderTimer(DURATION);
  render();
})();
