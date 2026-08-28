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
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const root = document.getElementById('accountPanel');
const statusEl = document.getElementById('accountStatus');
const historyEl = document.getElementById('scoreHistory');
const emailEl = document.getElementById('authEmail');
const passwordEl = document.getElementById('authPassword');
const signInBtn = document.getElementById('signInBtn');
const signUpBtn = document.getElementById('signUpBtn');
const signOutBtn = document.getElementById('signOutBtn');

const config = window.FIREBASE_CONFIG || {};
const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

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
  if (code.includes('permission-denied')) return 'Firestoreの権限設定を確認してください。';
  return '処理に失敗しました。Firebase設定を確認してください。';
}

function clearHistory(text='ログインすると過去スコアを表示します。') {
  if (historyEl) historyEl.innerHTML = `<span class="account-empty">${text}</span>`;
}

function formatDate(value) {
  if (!value) return '保存中';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '日時不明';
  return new Intl.DateTimeFormat('ja-JP', {
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
  }).format(date);
}

if (!configured) {
  root?.classList.add('not-configured');
  setStatus('Firebase未接続：接続設定を入れるとログインと履歴保存が有効になります。', 'warn');
  [emailEl, passwordEl, signInBtn, signUpBtn, signOutBtn].forEach(el => { if (el) el.disabled = true; });
  clearHistory('Firebase接続待ち');
  window.lotteryAccount = {
    isLoggedIn: () => false,
    saveScore: async () => ({ saved:false, reason:'not-configured' })
  };
} else {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let currentUser = null;

  async function loadHistory() {
    if (!currentUser || !historyEl) return;
    historyEl.innerHTML = '<span class="account-empty">読み込み中…</span>';
    try {
      const scoresRef = collection(db, 'users', currentUser.uid, 'scores');
      const snapshot = await getDocs(query(scoresRef, orderBy('finishedAt', 'desc'), limit(20)));
      if (snapshot.empty) {
        clearHistory('まだ保存されたスコアはありません。');
        return;
      }
      historyEl.innerHTML = '';
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const row = document.createElement('div');
        row.className = 'score-row';
        row.innerHTML = `
          <strong>${Number(d.score || 0).toLocaleString('ja-JP')} COIN</strong>
          <span>${Number(d.games || 0).toLocaleString('ja-JP')}G</span>
          <small>${formatDate(d.finishedAt)}</small>
        `;
        historyEl.appendChild(row);
      });
    } catch (error) {
      console.error(error);
      clearHistory(friendlyError(error));
    }
  }

  async function saveScore(payload) {
    if (!currentUser) return { saved:false, reason:'not-logged-in' };
    const score = Math.max(0, Math.floor(Number(payload?.score) || 0));
    const games = Math.max(0, Math.floor(Number(payload?.games) || 0));
    const totalPaid = Math.max(0, Math.floor(Number(payload?.totalPaid) || 0));
    try {
      await addDoc(collection(db, 'users', currentUser.uid, 'scores'), {
        score,
        games,
        totalPaid,
        finishedAt: serverTimestamp()
      });
      setStatus(`スコア ${score.toLocaleString('ja-JP')} COIN を保存しました。`, 'ok');
      await loadHistory();
      return { saved:true };
    } catch (error) {
      console.error(error);
      setStatus(friendlyError(error), 'error');
      return { saved:false, reason:'error' };
    }
  }

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
    try { await signOut(auth); }
    catch (error) { setStatus(friendlyError(error), 'error'); }
  });

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (user) {
      root?.classList.add('logged-in');
      setStatus(`ログイン中：${user.email || 'ユーザー'}`, 'ok');
      if (emailEl) emailEl.value = user.email || '';
      if (emailEl) emailEl.disabled = true;
      if (passwordEl) passwordEl.disabled = true;
      if (signInBtn) signInBtn.hidden = true;
      if (signUpBtn) signUpBtn.hidden = true;
      if (signOutBtn) signOutBtn.hidden = false;
      await loadHistory();
    } else {
      root?.classList.remove('logged-in');
      setStatus('未ログイン：終了スコアを保存するにはログインしてください。');
      if (emailEl) emailEl.disabled = false;
      if (passwordEl) passwordEl.disabled = false;
      if (signInBtn) signInBtn.hidden = false;
      if (signUpBtn) signUpBtn.hidden = false;
      if (signOutBtn) signOutBtn.hidden = true;
      clearHistory();
    }
  });

  window.lotteryAccount = {
    isLoggedIn: () => Boolean(currentUser),
    saveScore,
    reloadHistory: loadHistory
  };
}
