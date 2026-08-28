import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  runTransaction,
  updateDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const MAX_PLAYS = 10;
const INITIAL_SCORE = 1000;
const root = document.getElementById('accountPanel');
const statusEl = document.getElementById('accountStatus');
const historyEl = document.getElementById('scoreHistory');
const emailEl = document.getElementById('authEmail');
const passwordEl = document.getElementById('authPassword');
const signInBtn = document.getElementById('signInBtn');
const signUpBtn = document.getElementById('signUpBtn');
const signOutBtn = document.getElementById('signOutBtn');
const autoBtn = document.getElementById('autoBtn');
const endBtn = document.getElementById('endBtn');
const messageEl = document.getElementById('message');
const savedTitleEl = root?.querySelector('.saved-title');
const accountTitleEl = root?.querySelector('.account-title');
const prototypeNoteEl = document.querySelector('.prototype-note');
const rulesEl = document.querySelector('.rules');

const config = window.FIREBASE_CONFIG || {};
const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let state = {
  loggedIn:false,
  email:'',
  used:0,
  remaining:MAX_PLAYS,
  cumulativeNet:0
};

function signed(value) {
  const n = Math.trunc(Number(value) || 0);
  return `${n > 0 ? '+' : ''}${n.toLocaleString('ja-JP')}`;
}

function publishState() {
  window.dispatchEvent(new CustomEvent('lottery-account-updated', { detail:{...state} }));
}

function setStatus(text, kind='') {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

function friendlyError(error) {
  const code = error?.code || '';
  if (code.includes('invalid-credential')) return 'メールアドレスまたはパスワードが違います。';
  if (code.includes('email-already-in-use')) return 'このメールアドレスは登録済みです。';
  if (code.includes('weak-password')) return 'パスワードは6文字以上にしてください。';
  if (code.includes('invalid-email')) return 'メールアドレスの形式を確認してください。';
  if (code.includes('too-many-requests')) return '試行回数が多すぎます。少し時間を置いてください。';
  if (code.includes('permission-denied')) return 'Firestoreルールが10プレイ制の最新版になっているか確認してください。';
  return '処理に失敗しました。Firebase設定を確認してください。';
}

function clearHistory(text='ログインすると10プレイの成績を表示します。') {
  if (historyEl) historyEl.innerHTML = `<span class="account-empty">${text}</span>`;
}

function formatDate(value) {
  if (!value) return '未終了';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '日時不明';
  return new Intl.DateTimeFormat('ja-JP', {
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
  }).format(date);
}

if (savedTitleEl) savedTitleEl.textContent = '10 PLAY CHALLENGE';
if (accountTitleEl) accountTitleEl.textContent = 'ACCOUNT / 10 PLAY CHALLENGE';
if (prototypeNoteEl) prototypeNoteEl.textContent = 'AUTO 100G / 1 ACCOUNT = 10 PLAYS';
if (rulesEl) {
  rulesEl.innerHTML = rulesEl.innerHTML
    .replace('・ログイン中に終了したスコアは、そのアカウントの履歴に保存されます。', '・プレイにはログインが必要です。最初のAUTO 100Gを押した時点で1プレイ枠を消費します。')
    .replace('・終了後はそのプレイをやり直せません。', '・途中でリロード・離脱したプレイ枠も使用済みとなり、最終スコア0として累計収支は-1,000扱いです。')
    .replace('・初期所持コインは <strong>1,000コイン</strong>。回数上限はありません。', '・初期所持コインは <strong>1,000コイン</strong>。1アカウントにつき最大<strong>10プレイ</strong>です。');
}

if (!configured) {
  root?.classList.add('not-configured');
  setStatus('Firebase未接続：このゲームはアカウントログイン必須です。', 'warn');
  [emailEl, passwordEl, signInBtn, signUpBtn, signOutBtn].forEach(el => { if (el) el.disabled = true; });
  clearHistory('Firebase接続待ち');
  window.lotteryAccount = {
    isLoggedIn: () => false,
    getState: () => ({...state}),
    claimPlay: async () => ({ claimed:false, reason:'not-configured' }),
    finishPlay: async () => ({ saved:false, reason:'not-configured' }),
    saveScore: async () => ({ saved:false, reason:'not-configured' })
  };
  publishState();
} else {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let currentUser = null;
  let activePlayId = null;
  let claimingPlay = false;
  let bypassNextAutoClick = false;

  async function syncProfile(user) {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email || '',
        lastSeenAt: serverTimestamp()
      }, { merge:true });
    } catch (error) {
      console.warn('Profile sync failed', error);
    }
  }

  async function loadHistory() {
    if (!currentUser || !historyEl) return;
    historyEl.innerHTML = '<span class="account-empty">読み込み中…</span>';
    try {
      const snapshot = await getDocs(collection(db, 'users', currentUser.uid, 'plays'));
      const plays = snapshot.docs.map(snap => {
        const d = snap.data();
        const finished = d.status === 'finished';
        return {
          id:Number(snap.id),
          status:finished ? 'finished' : 'started',
          score:finished ? Math.max(0, Math.floor(Number(d.score) || 0)) : 0,
          games:finished ? Math.max(0, Math.floor(Number(d.games) || 0)) : 0,
          totalPaid:finished ? Math.max(0, Math.floor(Number(d.totalPaid) || 0)) : 0,
          finishedAt:d.finishedAt || null
        };
      }).filter(p => Number.isInteger(p.id) && p.id >= 1 && p.id <= MAX_PLAYS)
        .sort((a,b) => a.id - b.id);

      const cumulativeNet = plays.reduce((sum,p) => sum + (p.score - INITIAL_SCORE), 0);
      state = {
        loggedIn:true,
        email:currentUser.email || '',
        used:plays.length,
        remaining:Math.max(0, MAX_PLAYS - plays.length),
        cumulativeNet
      };

      setStatus(
        `ログイン中：${currentUser.email || 'ユーザー'} / ${state.used}/${MAX_PLAYS} PLAY / 累計 ${signed(cumulativeNet)} COIN`,
        state.remaining > 0 ? 'ok' : 'warn'
      );

      historyEl.innerHTML = '';
      if (!plays.length) {
        clearHistory('まだプレイしていません。残り10 PLAYです。');
      } else {
        for (const play of plays) {
          const row = document.createElement('div');
          row.className = 'score-row';
          const net = play.score - INITIAL_SCORE;
          const title = play.status === 'finished'
            ? `${play.score.toLocaleString('ja-JP')} COIN`
            : '0 COIN扱い';
          const meta = play.status === 'finished'
            ? `${play.games.toLocaleString('ja-JP')}G / ${signed(net)}`
            : '途中離脱・未終了 / -1,000';
          row.innerHTML = `
            <strong>PLAY ${play.id}　${title}</strong>
            <span>${meta}</span>
            <small>${formatDate(play.finishedAt)}</small>
          `;
          historyEl.appendChild(row);
        }
      }
      publishState();
      return plays;
    } catch (error) {
      console.error(error);
      clearHistory(friendlyError(error));
      publishState();
      return [];
    }
  }

  async function claimPlay() {
    if (!currentUser) return { claimed:false, reason:'not-logged-in' };
    if (state.remaining <= 0) return { claimed:false, reason:'limit-reached' };
    try {
      const uid = currentUser.uid;
      const playId = await runTransaction(db, async transaction => {
        for (let i=1; i<=MAX_PLAYS; i++) {
          const ref = doc(db, 'users', uid, 'plays', String(i));
          const snap = await transaction.get(ref);
          if (!snap.exists()) {
            transaction.set(ref, {
              status:'started',
              score:0,
              games:0,
              totalPaid:0,
              startedAt:serverTimestamp(),
              finishedAt:null
            });
            return String(i);
          }
        }
        return null;
      });

      if (!playId) {
        await loadHistory();
        return { claimed:false, reason:'limit-reached' };
      }

      activePlayId = playId;
      window.__lotteryPlayStarted = true;
      window.__lotteryGameOver = false;
      await loadHistory();
      setStatus(`PLAY ${playId}/${MAX_PLAYS} を開始しました。この枠は使用済みです。`, 'ok');
      return { claimed:true, playId };
    } catch (error) {
      console.error(error);
      setStatus(friendlyError(error), 'error');
      return { claimed:false, reason:'error' };
    }
  }

  async function finishPlay(playId, payload) {
    if (!currentUser || !playId) return { saved:false, reason:'no-active-play' };
    const score = Math.max(0, Math.floor(Number(payload?.score) || 0));
    const games = Math.max(0, Math.floor(Number(payload?.games) || 0));
    const totalPaid = Math.max(0, Math.floor(Number(payload?.totalPaid) || 0));
    try {
      await updateDoc(doc(db, 'users', currentUser.uid, 'plays', String(playId)), {
        status:'finished',
        score,
        games,
        totalPaid,
        finishedAt:serverTimestamp()
      });
      await loadHistory();
      setStatus(`PLAY ${playId}：${score.toLocaleString('ja-JP')} COIN で確定しました。`, 'ok');
      activePlayId = null;
      window.__lotteryGameOver = true;
      return { saved:true };
    } catch (error) {
      console.error(error);
      setStatus(friendlyError(error), 'error');
      return { saved:false, reason:'error' };
    }
  }

  // Compatibility hook used by the existing game core on FINAL SCORE.
  async function saveScore(payload) {
    return finishPlay(activePlayId, payload);
  }

  // Capture AUTO before the game core sees it. The first AUTO consumes a slot.
  autoBtn?.addEventListener('click', async event => {
    if (bypassNextAutoClick) {
      bypassNextAutoClick = false;
      return;
    }

    if (activePlayId) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!currentUser) {
      setStatus('プレイするにはログインしてください。', 'warn');
      if (messageEl) messageEl.textContent = 'ログイン後にAUTO 100Gを押してください。';
      return;
    }
    if (claimingPlay) return;
    if (state.remaining <= 0) {
      setStatus('10 PLAYをすべて使用済みです。このアカウントではこれ以上プレイできません。', 'warn');
      if (messageEl) messageEl.textContent = '10 PLAY COMPLETE';
      return;
    }

    claimingPlay = true;
    const originalText = autoBtn.textContent;
    autoBtn.disabled = true;
    autoBtn.textContent = 'PLAY SLOT CHECK…';
    const result = await claimPlay();
    claimingPlay = false;
    autoBtn.disabled = false;

    if (!result.claimed) {
      autoBtn.textContent = originalText;
      if (result.reason === 'limit-reached' && messageEl) messageEl.textContent = '10 PLAY COMPLETE';
      return;
    }

    bypassNextAutoClick = true;
    autoBtn.textContent = originalText;
    autoBtn.click();
  }, true);

  // A 1,000-point no-play record cannot be created by pressing END before AUTO.
  endBtn?.addEventListener('click', event => {
    if (activePlayId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus(currentUser ? 'まずAUTO 100Gを押してプレイを開始してください。' : 'プレイするにはログインしてください。', 'warn');
  }, true);

  signInBtn?.addEventListener('click', async () => {
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    if (!email || !password) { setStatus('メールアドレスとパスワードを入力してください。', 'warn'); return; }
    signInBtn.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      passwordEl.value = '';
    } catch (error) {
      setStatus(friendlyError(error), 'error');
    } finally {
      signInBtn.disabled = false;
    }
  });

  signUpBtn?.addEventListener('click', async () => {
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    if (!email || !password) { setStatus('メールアドレスとパスワードを入力してください。', 'warn'); return; }
    signUpBtn.disabled = true;
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      passwordEl.value = '';
    } catch (error) {
      setStatus(friendlyError(error), 'error');
    } finally {
      signUpBtn.disabled = false;
    }
  });

  signOutBtn?.addEventListener('click', async () => {
    if (activePlayId && !window.__lotteryGameOver) {
      const ok = window.confirm('進行中のプレイがあります。ログアウトするとその枠は0 COIN扱いになります。ログアウトしますか？');
      if (!ok) return;
    }
    try { await signOut(auth); }
    catch (error) { setStatus(friendlyError(error), 'error'); }
  });

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (user) {
      root?.classList.add('logged-in');
      if (emailEl) emailEl.value = user.email || '';
      if (emailEl) emailEl.disabled = true;
      if (passwordEl) passwordEl.disabled = true;
      if (signInBtn) signInBtn.hidden = true;
      if (signUpBtn) signUpBtn.hidden = true;
      if (signOutBtn) signOutBtn.hidden = false;
      await syncProfile(user);
      await loadHistory();
    } else {
      root?.classList.remove('logged-in');
      activePlayId = null;
      state = { loggedIn:false, email:'', used:0, remaining:MAX_PLAYS, cumulativeNet:0 };
      setStatus('未ログイン：プレイするにはログインしてください。');
      if (emailEl) emailEl.disabled = false;
      if (passwordEl) passwordEl.disabled = false;
      if (signInBtn) signInBtn.hidden = false;
      if (signUpBtn) signUpBtn.hidden = false;
      if (signOutBtn) signOutBtn.hidden = true;
      clearHistory();
      publishState();
    }
  });

  window.lotteryAccount = {
    isLoggedIn: () => Boolean(currentUser),
    getState: () => ({...state}),
    claimPlay,
    finishPlay,
    saveScore,
    reloadHistory: loadHistory
  };
}
