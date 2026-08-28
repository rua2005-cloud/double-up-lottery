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
  query,
  orderBy,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

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
const userCountEl = $('userCount');
const playCountEl = $('playCount');
const topScoreEl = $('topScore');
const userList = $('userList');

const config = window.FIREBASE_CONFIG || {};
const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

function setStatus(text, kind='') {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ` ${kind}` : ''}`;
}

function formatDate(value) {
  if (!value) return '保存中';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '日時不明';
  return new Intl.DateTimeFormat('ja-JP', {
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
  }).format(date);
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
  identity.append(email, uid);

  const stats = document.createElement('div');
  stats.className = 'userstats';
  const statDefs = [
    ['最高', `${entry.highest.toLocaleString('ja-JP')} COIN`],
    ['プレイ', `${entry.scores.length}回`],
    ['平均', `${entry.average.toLocaleString('ja-JP')} COIN`]
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

  if (!entry.scores.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '保存されたスコアはありません。';
    card.appendChild(empty);
    return card;
  }

  const scoresWrap = document.createElement('div');
  scoresWrap.className = 'scores';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  for (const text of ['最終スコア', '総ゲーム数', '総払い出し', '終了日時']) {
    const th = document.createElement('th');
    th.textContent = text;
    hrow.appendChild(th);
  }
  thead.appendChild(hrow);
  const tbody = document.createElement('tbody');
  for (const score of entry.scores) {
    const tr = document.createElement('tr');
    tr.append(
      makeCell(`${score.score.toLocaleString('ja-JP')} COIN`),
      makeCell(`${score.games.toLocaleString('ja-JP')}G`),
      makeCell(`${score.totalPaid.toLocaleString('ja-JP')} COIN`),
      makeCell(formatDate(score.finishedAt))
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

  async function loadDashboard() {
    if (!currentUser) return;
    refreshBtn.disabled = true;
    userList.innerHTML = '<div class="empty">全ユーザーを読み込み中…</div>';
    try {
      const userSnapshot = await getDocs(collection(db, 'users'));
      const entries = await Promise.all(userSnapshot.docs.map(async userDoc => {
        const profile = userDoc.data();
        const scoreSnapshot = await getDocs(query(
          collection(db, 'users', userDoc.id, 'scores'),
          orderBy('finishedAt', 'desc')
        ));
        const scores = scoreSnapshot.docs.map(s => {
          const d = s.data();
          return {
            score: Math.max(0, Math.floor(Number(d.score) || 0)),
            games: Math.max(0, Math.floor(Number(d.games) || 0)),
            totalPaid: Math.max(0, Math.floor(Number(d.totalPaid) || 0)),
            finishedAt: d.finishedAt || null
          };
        });
        const highest = scores.reduce((m, s) => Math.max(m, s.score), 0);
        const average = scores.length ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : 0;
        return { uid:userDoc.id, email:profile.email || '', scores, highest, average };
      }));

      entries.sort((a,b) => b.highest - a.highest || a.email.localeCompare(b.email));
      const totalPlays = entries.reduce((sum, e) => sum + e.scores.length, 0);
      const best = entries.reduce((m, e) => Math.max(m, e.highest), 0);
      userCountEl.textContent = entries.length.toLocaleString('ja-JP');
      playCountEl.textContent = totalPlays.toLocaleString('ja-JP');
      topScoreEl.textContent = `${best.toLocaleString('ja-JP')} COIN`;

      userList.innerHTML = '';
      if (!entries.length) {
        userList.innerHTML = '<div class="empty">ユーザープロフィールがまだありません。各ユーザーがゲームへ再ログインすると登録されます。</div>';
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
    }
  }

  async function verifyAdmin(user) {
    showLoggedIn(user);
    await syncOwnProfile(user);
    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      if (!adminSnap.exists()) {
        dashboard.classList.add('hidden');
        setStatus('このアカウントはまだ管理者登録されていません。上のUIDをFirestoreの admins コレクションに登録してください。', 'warn');
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
