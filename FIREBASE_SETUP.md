# Firebase setup for LOTTERY AT

このゲームのログイン・スコア履歴保存を有効にするための最小設定です。

## 1. Firebaseプロジェクトを作る

1. Firebase Consoleで新規プロジェクトを作成
2. Webアプリを追加
3. 表示された `firebaseConfig` の値を `firebase-config.js` に貼り付ける

## 2. メール/パスワード認証を有効化

Firebase Console → Authentication → Sign-in method → Email/Password を有効化

## 3. Firestoreを作成

Firebase Console → Firestore Database → データベースを作成

## 4. Firestore Rulesを設定

Firebase Console → Firestore Database → Rules に、リポジトリの `firestore.rules` の内容を貼り付けて公開

このルールでは、ログインユーザー本人だけが `/users/{uid}/scores` を読めて、自分のスコアだけを追加できます。既存スコアの変更・削除は不可です。

## 5. 動作確認

GitHub Pagesの `auto100.html` を開き、

- 新規登録
- ログイン
- ゲーム終了
- 最終所持コインが過去スコア欄に追加される

ことを確認してください。

## 保存される項目

- `score`: 終了時の所持コイン
- `games`: 総ゲーム数
- `totalPaid`: 総払い出し
- `finishedAt`: Firebaseサーバー時刻

※ この軽量版では抽選・スコア計算はブラウザ側なので、開発者ツールを使ったスコア改変への強い不正対策はしていません。
