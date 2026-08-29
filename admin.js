import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const INITIAL_SCORE = 1000;
const MAX_PLAYS = 10;
const $ = id => document.getElementById(id);
const emailEl = $('adminEmail');
const passwordEl = $('adminPassword');
const signInBtn = $('adminSignIn');
const signOutBtn = $('adminSignOut');
const statusEl = $('adminStatus');
const uidBox = $('uidBox');
const uidEl = $('currentUid');
const copyUidBtn = $('copyUid');
const dashboard = $('dashboard');
const refreshBtn = $('refreshBtn');
const resetAllBtn = $('resetAllBtn');
const userCountEl = $('userCount');
const playCountEl = $('playCount');
const topScoreEl = $('topScore');
const totalNetEl = $('totalNet');
const userList = $('userList');

const config = window.FIREBASE_CONFIG || {};
const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

function setStatus(text, kind='') {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ` ${kind}` : ''}`;
}

function formatDate(value) {
  if (!value) return '未終了';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '日時不明';
  return new Intl.DateTimeFormat('ja-JP', {
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
  }).format(date);
}

function formatSigned(value) {
  const n = Math.trunc(Number(value) || 0);
  return `${n > 0 ? '+' : ''}${n.toLocaleString('ja-JP')}`;
}

function showLoggedOut() {
  dashboard.classList.add('hidden');
  uidBox.classList.add('hidden');
  signInBtn.classList.remove('hidden');
  signOutBtn.classList.add('hidden');
  emailEl.disabled = false;
  passwordEl.disabled = false;
}

function showLoggedIn(user) {
  uidEl.textContent = user.uid;
  uidBox.classList.remove('hidden');
  signInBtn.classList.add('hidden');
  signOutBtn.classList.remove('hidden');
  emailEl.value = user.email || '';
  emailEl.disabled = true;
  passwordEl.value = '';
  passwordEl.disabled = true;
}

function makeCell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function makeUserCard(entry) {
  const card = document.createElement('article');
  card.className = 'user';

  const head = document.createElement('div');
  head.className = 'userhead';

  const identity = document.createElement('div');
  const email = document.createElement('div');
  email.className = 'email';
  email.textContent = entry.email || '(メール未登録)';
  const uid = document.createElement('div');
  uid.className = 'uid';
  uid.textContent = entry.uid;

  const userActions = document.createElement('div');
  userActions.className = 'user-actions';
  const resetUserBtn = document.createElement('button');
  resetUserBtn.type = 'button';
  resetUserBtn.className = 'btn danger user-reset';
  resetUserBtn.textContent = 'このユーザーの成績をリセット';
  resetUserBtn.dataset.resetUser = entry.uid;
  resetUserBtn.dataset.resetEmail = entry.email || '';
  userActions.appendChild(resetUserBtn);
  identity.append(email, uid, userActions);

  const stats = document.createElement('div');
  stats.className = 'userstats';
  const statDefs = [
    ['累計収支', `${formatSigned(entry.cumulativeNet)} COIN`],
    ['最高', `${entry.highest.toLocaleString('ja-JP')} COIN`],
    ['使用枠', `${entry.plays.length}/${MAX_PLAYS}`],
    ['残り', `${MAX_PLAYS-entry.plays.length} PLAY`]
  ];
  for (const [label, value] of statDefs) {
    const box = document.createElement('div');
    const s = document.createElement('span');
    s.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value;
    box.append(s, strong);
    stats.appendChild(box);
  }

  head.append(identity, stats);
  card.appendChild(head);

  if (!entry.plays.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'まだ10プレイチャレンジを開始していません。';
    card.appendChild(empty);
    return card;
  }

  const scoresWrap = document.createElement('div');
  scoresWrap.className = 'scores';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  for (const text of ['PLAY', '状態', '最終スコア', '収支', '総ゲーム数', '総払い出し', '終了日時']) {
    const th = document.createElement('th');
    th.textContent = text;
    hrow.appendChild(th);
  }
  thead.appendChild(hrow);
  const tbody = document.createElement('tbody');
  for (const play of entry.plays) {
    const net = play.score - INITIAL_SCORE;
    const tr = document.createElement('tr');
    tr.append(
      makeCell(String(play.id)),
      makeCell(play.status === 'finished' ? '確定' : '未終了・0扱い'),
      makeCell(`${play.score.toLocaleString('ja-JP')} COIN`),
      makeCell(`${formatSigned(net)} COIN`),
      makeCell(`${play.games.toLocaleString('ja-JP')}G`),
      makeCell(`${play.totalPaid.toLocaleString('ja-JP')} COIN`),
      makeCell(formatDate(play.finishedAt))
    );
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  scoresWrap.appendChild(table);
  card.appendChild(scoresWrap);
  return card;
}

if (!configured) {
  setStatus('Firebase設定が見つかりません。', 'error');
  signInBtn.disabled = true;
} else {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let currentUser = null;

  async function syncOwnProfile(user) {
    try {
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email || '',
        lastSeenAt: serverTimestamp()
      }, { merge:true });
    } catch (error) {
      console.warn('Profile sync failed', error);
    }
  }

  async function resetUserResults(uid) {
    const [legacySnapshot, playSnapshot] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'scores')),
      getDocs(collection(db, 'users', uid, 'plays'))
    ]);

    let deletedLegacy = 0;
    let deletedPlays = 0;
    await Promise.all([
      ...legacySnapshot.docs.map(async scoreDoc => {
        await deleteDoc(scoreDoc.ref);
        deletedLegacy++;
      }),
      ...playSnapshot.docs.map(async playDoc => {
        await deleteDoc(playDoc.ref);
        deletedPlays++;
      })
    ]);

    return { deletedLegacy, deletedPlays };
  }

  async function resetAllResults() {
    const userSnapshot = await getDocs(collection(db, 'users'));
    let deletedLegacy = 0;
    let deletedPlays = 0;

    for (const userDoc of userSnapshot.docs) {
      const result = await resetUserResults(userDoc.id);
      deletedLegacy += result.deletedLegacy;
      deletedPlays += result.deletedPlays;
    }

    return { deletedLegacy, deletedPlays };
  }

  async function loadDashboard() {
    if (!currentUser) return;
    refreshBtn.disabled = true;
    if (resetAllBtn) resetAllBtn.disabled = true;
    userList.innerHTML = '<div class="empty">全ユーザーを読み込み中…</div>';
    try {
      const userSnapshot = await getDocs(collection(db, 'users'));
      const entries = await Promise.all(userSnapshot.docs.map(async userDoc => {
        const profile = userDoc.data();
        const playSnapshot = await getDocs(collection(db, 'users', userDoc.id, 'plays'));
        const plays = playSnapshot.docs.map(s => {
          const d = s.data();
          const id = Number(s.id);
          const finished = d.status === 'finished';
          return {
            id,
            status:finished ? 'finished' : 'started',
            score:finished ? Math.max(0, Math.floor(Number(d.score) || 0)) : 0,
            games:finished ? Math.max(0, Math.floor(Number(d.games) || 0)) : 0,
            totalPaid:finished ? Math.max(0, Math.floor(Number(d.totalPaid) || 0)) : 0,
            finishedAt:d.finishedAt || null
          };
        }).filter(p => Number.isInteger(p.id) && p.id >= 1 && p.id <= MAX_PLAYS)
          .sort((a,b) => a.id - b.id);

        const highest = plays.reduce((m,p) => Math.max(m,p.score), 0);
        const cumulativeNet = plays.reduce((sum,p) => sum + (p.score - INITIAL_SCORE), 0);
        return { uid:userDoc.id, email:profile.email || '', plays, highest, cumulativeNet };
      }));

      entries.sort((a,b) => b.cumulativeNet - a.cumulativeNet || b.highest - a.highest || a.email.localeCompare(b.email));
      const totalPlays = entries.reduce((sum,e) => sum + e.plays.length, 0);
      const best = entries.reduce((m,e) => Math.max(m,e.highest), 0);
      const totalNet = entries.reduce((sum,e) => sum + e.cumulativeNet, 0);
      userCountEl.textContent = entries.length.toLocaleString('ja-JP');
      playCountEl.textContent = totalPlays.toLocaleString('ja-JP');
      topScoreEl.textContent = `${best.toLocaleString('ja-JP')} COIN`;
      totalNetEl.textContent = `${formatSigned(totalNet)} COIN`;

      userList.innerHTML = '';
      if (!entries.length) {
        userList.innerHTML = '<div class="empty">ユーザープロフィールがまだありません。</div>';
      } else {
        for (const entry of entries) userList.appendChild(makeUserCard(entry));
      }

      setStatus(`管理者としてログイン中：${currentUser.email || currentUser.uid}`, 'ok');
    } catch (error) {
      console.error(error);
      dashboard.classList.add('hidden');
      setStatus('全ユーザーの読み込みに失敗しました。Firestoreルールと管理者登録を確認してください。', 'error');
    } finally {
      refreshBtn.disabled = false;
      if (resetAllBtn) resetAllBtn.disabled = false;
    }
  }

  async function verifyAdmin(user) {
    showLoggedIn(user);
    await syncOwnProfile(user);
    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      if (!adminSnap.exists()) {
        dashboard.classList.add('hidden');
        setStatus('このアカウントは管理者登録されていません。', 'warn');
        return;
      }
      dashboard.classList.remove('hidden');
      await loadDashboard();
    } catch (error) {
      console.error(error);
      dashboard.classList.add('hidden');
      setStatus('管理者判定に失敗しました。Firestoreルールが最新版か確認してください。', 'error');
    }
  }

  signInBtn.addEventListener('click', async () => {
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    if (!email || !password) {
      setStatus('メールアドレスとパスワードを入力してください。', 'warn');
      return;
    }
    signInBtn.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error(error);
      setStatus('ログインできませんでした。メールアドレスとパスワードを確認してください。', 'error');
    } finally {
      signInBtn.disabled = false;
    }
  });

  signOutBtn.addEventListener('click', async () => {
    try { await signOut(auth); }
    catch (error) { console.error(error); }
  });

  refreshBtn.addEventListener('click', loadDashboard);

  userList.addEventListener('click', async event => {
    const button = event.target.closest('[data-reset-user]');
    if (!button || !currentUser) return;

    const uid = button.dataset.resetUser || '';
    if (!uid) return;
    const label = button.dataset.resetEmail || uid;
    const ok = window.confirm(
      `${label} の成績だけをリセットします。\n旧履歴と10プレイ記録を削除し、0/10 PLAYに戻します。\n\nこの操作は元に戻せません。実行しますか？`
    );
    if (!ok) return;

    button.disabled = true;
    refreshBtn.disabled = true;
    if (resetAllBtn) resetAllBtn.disabled = true;
    setStatus(`${label} の成績をリセット中…`, 'warn');
    try {
      const result = await resetUserResults(uid);
      await loadDashboard();
      setStatus(
        `${label} をリセットしました。10プレイ記録 ${result.deletedPlays}件 / 旧履歴 ${result.deletedLegacy}件を削除。0/10 PLAYです。`,
        'ok'
      );
    } catch (error) {
      console.error(error);
      setStatus('このユーザーのリセットに失敗しました。Firestoreルールが最新版か確認してください。', 'error');
    } finally {
      refreshBtn.disabled = false;
      if (resetAllBtn) resetAllBtn.disabled = false;
    }
  });

  resetAllBtn?.addEventListener('click', async () => {
    if (!currentUser) return;
    const ok = window.confirm(
      '全ユーザーの旧履歴と10プレイ成績をすべて削除します。\n使用プレイ数も0/10に戻り、全員が10 PLAYから再スタートします。\n\nこの操作は元に戻せません。実行しますか？'
    );
    if (!ok) return;

    resetAllBtn.disabled = true;
    refreshBtn.disabled = true;
    setStatus('全成績をリセット中…', 'warn');
    try {
      const result = await resetAllResults();
      await loadDashboard();
      setStatus(
        `全成績をリセットしました。10プレイ記録 ${result.deletedPlays}件 / 旧履歴 ${result.deletedLegacy}件を削除。全アカウント 0/10 PLAY です。`,
        'ok'
      );
    } catch (error) {
      console.error(error);
      setStatus('全成績のリセットに失敗しました。Firestoreルールが最新版か確認してください。', 'error');
    } finally {
      resetAllBtn.disabled = false;
      refreshBtn.disabled = false;
    }
  });

  copyUidBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(uidEl.textContent || '');
      copyUidBtn.textContent = 'コピー済み';
      setTimeout(() => { copyUidBtn.textContent = 'コピー'; }, 1200);
    } catch {
      setStatus('UIDを選択してコピーしてください。', 'warn');
    }
  });

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (!user) {
      showLoggedOut();
      setStatus('管理者アカウントでログインしてください。');
      return;
    }
    await verifyAdmin(user);
  });
}
