(() => {
  const bankEl = document.getElementById('bank');
  const potEl = document.getElementById('pot');
  const streakEl = document.getElementById('streak');
  const atView = document.getElementById('atView');
  const atStat = document.getElementById('atStat');
  const atBanner = document.getElementById('atBanner');
  const atMain = document.getElementById('atMain');
  const atSub = document.getElementById('atSub');
  const atBadge = document.getElementById('atBadge');

  const messageEl = document.getElementById('message');
  const ticketEl = document.getElementById('ticket');
  const stageEl = document.getElementById('stage');
  const drawBtn = document.getElementById('drawBtn');
  const doubleBtn = document.getElementById('doubleBtn');
  const takeBtn = document.getElementById('takeBtn');
  const resetBtn = document.getElementById('resetBtn');

  const hintText = document.getElementById('hintText');
  const hintSub = document.getElementById('hintSub');
  const hintBox = document.getElementById('hintBox');
  const auraWrap = document.getElementById('auraWrap');
  const historyList = document.getElementById('historyList');
  const countdownEl = document.getElementById('countdown');

  const overlay = document.getElementById('overlay');
  const overlayCard = document.getElementById('overlayCard');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySub = document.getElementById('overlaySub');
  const overlayAmount = document.getElementById('overlayAmount');
  const overlayClose = document.getElementById('overlayClose');

  const game = document.getElementById('game');
  const particles = document.getElementById('particles');

  let bank = 10000;
  let pot = 0;
  let streak = 0;
  let locked = false;
  let currentDoubleChance = 0.5;
  let currentHint = null;
  let history = [];

  // Hidden internal waves
  let hiddenMode = 'cold';       // hidden only
  let hiddenTurns = 8;

  // AT state
  let atActive = false;
  let atHitRate = 0;             // 0.60 / 0.80, hidden from player
  let atRound = 0;

  const fmt = n => n.toLocaleString('ja-JP');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vibrate = pattern => { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e) {} };
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  function createParticles() {
    particles.innerHTML = '';
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      const left = Math.random() * 100;
      const size = 3 + Math.random() * 7;
      const dur = 6 + Math.random() * 8;
      const delay = Math.random() * 8;
      p.style.left = left + 'vw';
      p.style.bottom = (-20 - Math.random() * 60) + 'px';
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.animationDuration = dur + 's';
      p.style.animationDelay = delay + 's';
      p.style.opacity = 0.35 + Math.random() * 0.4;
      particles.appendChild(p);
    }
  }

  function renderATStatus() {
    if (atActive) {
      atView.textContent = `AT中`;
      atStat.className = 'stat at-on';
      atBanner.classList.add('active');
      atMain.textContent = `AT中 (${atRound}回成功)`;
      atSub.textContent = `無料抽選 / ハズレを引くとAT終了`;
      atBadge.textContent = `AT`;
    } else {
      atView.textContent = `通常状態`;
      atStat.className = 'stat at-off';
      atBanner.classList.remove('active');
      atMain.textContent = `ATはまだ始まっていません`;
      atSub.textContent = `通常時の内部状態は非表示。AT突入時だけ告知されます。`;
      atBadge.textContent = `—`;
    }
  }

  function render() {
    bankEl.textContent = fmt(bank);
    potEl.textContent = fmt(pot);
    streakEl.textContent = streak;
    renderATStatus();
    drawBtn.disabled = locked || (bank < 100 && !atActive) || pot > 0;
    doubleBtn.disabled = locked || pot <= 0;
    takeBtn.disabled = locked || pot <= 0;
    drawBtn.textContent = atActive ? 'AT中：無料で引く' : 'くじを引く';
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

  function animateTicket(type='draw') {
    ticketEl.classList.remove('draw', 'flip');
    void ticketEl.offsetWidth;
    ticketEl.classList.add(type);
  }

  function showOverlay(kind, title, sub, amount='') {
    overlay.className = 'overlay show ' + kind;
    overlayCard.className = 'overlay-card';
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
      const hitLine = atHitRate * 100;
      if (r >= hitLine) return 0;

      // Prize distribution conditional on having hit.
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

    // normal
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
    const pool = [0.60, 0.80];
    atHitRate = pool[Math.floor(Math.random() * pool.length)];
  }

  function endAT() {
    atActive = false;
    atHitRate = 0;
    atRound = 0;
    forcePostATCold();
  }

  function rollDoubleChance() {
    if (atActive) {
      const table = [0.60, 0.70, 0.80];
      return table[Math.floor(Math.random() * table.length)];
    }
    const table = hiddenMode === 'cold'
      ? [0.20, 0.30, 0.40, 0.50, 0.60]
      : [0.30, 0.40, 0.50, 0.60, 0.70];
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

  function makeHint(chance) {
    let pool;
    if (chance >= 0.80) {
      pool = [
        {text:"かなり良い気配がする", sub:"かなり強い示唆。だが確定ではない。", rank:4, w:52},
        {text:"今日は攻めてもよさそうだ", sub:"やや強めの示唆。", rank:3, w:26},
        {text:"悪くない流れだ", sub:"中程度の示唆。", rank:2, w:14},
        {text:"嫌な予感がする…", sub:"まれに逆示唆もある。", rank:1, w:8}
      ];
    } else if (chance >= 0.60) {
      pool = [
        {text:"かなり良い気配がする", sub:"強めの示唆。", rank:4, w:24},
        {text:"今日は攻めてもよさそうだ", sub:"前向きな示唆。", rank:3, w:38},
        {text:"悪くない流れだ", sub:"中程度の示唆。", rank:2, w:22},
        {text:"嫌な予感がする…", sub:"外れる逆示唆もある。", rank:1, w:16}
      ];
    } else if (chance >= 0.45) {
      pool = [
        {text:"今日は攻めてもよさそうだ", sub:"少し前向きな示唆。", rank:3, w:18},
        {text:"何とも言えない空気だ", sub:"五分前後かもしれない。", rank:2, w:36},
        {text:"悪くない流れだ", sub:"中立より少し上。", rank:2, w:16},
        {text:"嫌な予感がする…", sub:"少し後ろ向きな示唆。", rank:1, w:18},
        {text:"かなり危険な気配だ", sub:"強い警戒示唆。", rank:0, w:12}
      ];
    } else if (chance >= 0.30) {
      pool = [
        {text:"かなり良い気配がする", sub:"逆示唆が出ることもある。", rank:4, w:9},
        {text:"今日は攻めてもよさそうだ", sub:"弱い逆示唆。", rank:3, w:14},
        {text:"何とも言えない空気だ", sub:"中立寄り。", rank:2, w:22},
        {text:"嫌な予感がする…", sub:"やや危険寄り。", rank:1, w:30},
        {text:"かなり危険な気配だ", sub:"かなり危険。", rank:0, w:25}
      ];
    } else {
      pool = [
        {text:"かなり良い気配がする", sub:"ごく稀に逆の強示唆も出る。", rank:4, w:5},
        {text:"悪くない流れだ", sub:"少し紛らわしい示唆。", rank:2, w:14},
        {text:"嫌な予感がする…", sub:"危険寄りの示唆。", rank:1, w:32},
        {text:"かなり危険な気配だ", sub:"かなり強い警戒示唆。", rank:0, w:49}
      ];
    }
    return weightedPick(pool);
  }

  function renderAura(rank) {
    auraWrap.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const dot = document.createElement('span');
      dot.className = 'aura-dot';
      if (rank === 2) {
        if (i < 3) dot.classList.add('neutral');
      } else if (rank >= 3) {
        if (i < rank + 1) dot.classList.add('on');
      } else {
        if (i < (2 - rank + 2)) dot.classList.add('bad');
      }
      auraWrap.appendChild(dot);
    }
  }

  function setNewHint() {
    currentDoubleChance = rollDoubleChance();
    currentHint = makeHint(currentDoubleChance);
    hintText.textContent = currentHint.text;
    hintSub.textContent = currentHint.sub + (atActive ? '（AT中）' : '');
    hintBox.className = 'hintbox rank' + currentHint.rank;
    renderAura(currentHint.rank);
  }

  function clearHint() {
    currentHint = null;
    hintBox.className = 'hintbox';
    hintText.textContent = 'まだ示唆はありません';
    hintSub.textContent = '当選すると次のダブルアップ示唆が表示されます。';
    renderAura(2);
  }

  function updateHistory(result, oldPot, newPot, hint) {
    const item = {
      result,
      oldPot,
      newPot,
      hint: hint ? hint.text : '示唆なし'
    };
    history.unshift(item);
    history = history.slice(0, 6);

    historyList.innerHTML = '';
    history.forEach(h => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent =
        h.result === 'win'
        ? `成功 ${fmt(h.oldPot)}→${fmt(h.newPot)} / 「${h.hint}」`
        : `失敗 ${fmt(h.oldPot)}→0 / 「${h.hint}」`;
      historyList.appendChild(span);
    });
  }

  async function drawLottery() {
    if (locked || pot > 0) return;
    if (bank < 100 && !atActive) return;

    const usedAT = atActive;
    const cost = usedAT ? 0 : 100;
    if (cost > 0) bank -= cost;

    locked = true;
    streak = 0;
    clearHint();
    animateTicket('draw');
    ticketEl.textContent = '?';
    messageEl.textContent = usedAT ? 'AT中！ 無料で抽選中…' : '抽選中…';
    render();

    await suspenseSequence(usedAT ? ['AT', 'GO!'] : ['…', 'OPEN']);

    const prize = lotteryByInternalState();

    // Hidden wave only advances outside AT
    if (!usedAT) {
      advanceHiddenMode();
    }

    let enteredATNow = false;
    if (!usedAT && shouldEnterAT(prize)) {
      startAT();
      enteredATNow = true;
    }

    pot = prize;
    locked = false;

    if (prize === 0) {
      ticketEl.textContent = 'LOSE';
      messageEl.textContent = usedAT ? 'AT中でもハズレ…。まだ継続に期待。' : 'ハズレ。';
      flash('lose');
      shakeScreen();
    } else {
      ticketEl.textContent = `${fmt(prize)}`;
      messageEl.textContent = `${fmt(prize)}コイン当選。示唆を見て、攻めるか守るか。`;
      flash('win');
      if (prize >= 500) {
        showOverlay('good', 'CHANCE', '大きめの当選。ここから伸ばせるかも。', `${fmt(prize)} COIN`);
      }
      setNewHint();
    }

    if (enteredATNow) {
      vibrate([80,40,120,40,180]);
      showOverlay(
        'good',
        'AT突入',
        `ボーナスタイム突入！\nAT中は無料抽選。ハズレを引くまで継続します。`,
        `BONUS TIME`
      );
      messageEl.textContent += ' さらにAT突入！';
    } else if (usedAT) {
      if (prize > 0) {
        atRound += 1;
        messageEl.textContent += ' AT継続！';
      } else {
        endAT();
        vibrate([220]);
        showOverlay('overlay-blue', 'AT終了', 'ハズレを引いたためAT終了。ここからは再び通常状態です。', 'END');
      }
    }

    render();
  }

  async function doDoubleUp() {
    if (pot <= 0 || locked) return;

    locked = true;
    const oldPot = pot;
    const usedChance = currentDoubleChance;
    const usedHint = currentHint;

    messageEl.textContent = '示唆確認… ダブルアップ抽選へ';
    ticketEl.textContent = '???';
    animateTicket('flip');
    render();

    await suspenseSequence(['3', '2', '1']);
    const win = Math.random() < usedChance;
    locked = false;

    if (win) {
      pot *= 2;
      streak += 1;
      ticketEl.textContent = 'DOUBLE!';
      vibrate([60,35,90]);
      messageEl.textContent = `成功！ 賞金は ${fmt(pot)} コイン。次の示唆も確認できます。`;
      updateHistory('win', oldPot, pot, usedHint);
      flash('win');
      game.classList.add('glow-gold');
      setTimeout(() => game.classList.remove('glow-gold'), 700);

      if (pot >= 2000 || streak >= 3) {
        showOverlay('good', 'SUCCESS', 'ダブルアップ成功！', `${fmt(pot)} COIN`);
      }
      setNewHint();
    } else {
      pot = 0;
      streak = 0;
      ticketEl.textContent = 'BUST';
      vibrate([180,70,180]);
      messageEl.textContent = '失敗。今回の賞金は0になりました。示唆は確実ではありません。';
      updateHistory('lose', oldPot, 0, usedHint);
      clearHint();
      flash('lose');
      shakeScreen();
      showOverlay('bad', 'BUST', 'ダブルアップ失敗。今回の賞金は消滅しました。', '0 COIN');
    }
    render();
  }

  function takePrize() {
    if (pot <= 0 || locked) return;
    const taken = pot;
    bank += pot;
    pot = 0;
    streak = 0;
    ticketEl.textContent = 'GET!';
    messageEl.textContent = `${fmt(taken)}コインを受け取りました。`;
    clearHint();
    flash('win');
    showOverlay('green', 'GET!', '賞金を安全に受け取りました。', `${fmt(taken)} COIN`);
    render();
  }

  function resetGame() {
    bank = 10000;
    pot = 0;
    streak = 0;
    locked = false;
    currentDoubleChance = 0.5;
    currentHint = null;
    history = [];

    hiddenMode = 'cold';
    hiddenTurns = 8;

    atActive = false;
    atHitRate = 0;
    atRound = 0;

    historyList.innerHTML = '<span class="tag">まだ記録なし</span>';
    ticketEl.textContent = 'LOTTERY';
    messageEl.textContent = '100コインでくじを1枚引けます。';
    countdownEl.textContent = '';
    clearHint();
    hideOverlay();
    render();
  }

  drawBtn.addEventListener('click', drawLottery);
  doubleBtn.addEventListener('click', doDoubleUp);
  takeBtn.addEventListener('click', takePrize);
  resetBtn.addEventListener('click', resetGame);
  overlayClose.addEventListener('click', hideOverlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) hideOverlay(); });

  createParticles();
  clearHint();
  render();
})();
