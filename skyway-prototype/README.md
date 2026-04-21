# SkyWay Prototype

SkyWay を使ったビデオ通話サンプルアプリです。  
Node.js + Express のトークンサーバー + 静的フロントエンドの構成です。

---

## ローカル起動手順

### 1. 依存パッケージをインストール（初回のみ）

```bash
# プロジェクトルート（package.json があるディレクトリ）で実行
npm install
```

### 2. `.env` を設定する

`skyway-prototype/.env` に以下を記入してください。

```
SKYWAY_APP_ID=your-skyway-app-id
SKYWAY_SECRET_KEY=your-skyway-secret-key
APP_ACCESS_KEY=your-secret-access-key
```

あわせて `skyway-prototype/index.html` 内の `window.APP_CONFIG.accessKey` を  
`.env` の `APP_ACCESS_KEY` と同じ値にしてください。

### 3. サーバーを起動する

```bash
npm start
```

### 4. ブラウザでアクセスする

```
http://localhost:3000
```

複数タブ・LAN内の別端末から同じ Room 名を入力して参加できます。

---

## Render デプロイ手順

### 1. GitHub にプッシュ

このリポジトリを GitHub に push し、Render の New Web Service で接続してください。

### 2. Render の設定値

| 項目 | 値 |
|------|-----|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |

### 3. Render の Environment Variables

Render ダッシュボードの「Environment」タブで以下を設定してください。

| 変数名 | 説明 |
|--------|------|
| `SKYWAY_APP_ID` | SkyWay ダッシュボードの App ID |
| `SKYWAY_SECRET_KEY` | SkyWay ダッシュボードの Secret Key |
| `APP_ACCESS_KEY` | フロントと共有するアクセスキー（任意の文字列） |

`PORT` は Render が自動設定するため不要です。

### 4. index.html の accessKey を合わせる

`skyway-prototype/index.html` 内の以下の値を、Render に設定した `APP_ACCESS_KEY` と同じにしてください。

```html
<script>
  window.APP_CONFIG = {
    accessKey: "Render に設定した APP_ACCESS_KEY と同じ値"
  };
</script>
```

---

## セキュリティについて

### `/token` エンドポイントの保護

`/token` は `POST` リクエストのみ受け付け、`body.accessKey` が  
サーバーの `APP_ACCESS_KEY` と一致しない場合は **403** を返します。

> ⚠️ `accessKey` は HTML に含まれるため、技術者には見えます。  
> これは「気軽なアクセスを防ぐ」最低限の保護です。  
> 本格的な運用では Google ログイン等の認証システムを導入してください。

### Room 名の命名

- `test` `aaa` `room1` などの単純な名前は第三者に推測されやすいです
- `x7k2-meeting-apr` のような推測されにくい文字列を使ってください

### .env は Git に含めない

`skyway-prototype/.gitignore` に `.env` が記載されているため、  
`.env` は Git に含まれません。絶対に commit しないでください。

---

## ファイル構成

```
skyway-prototype/
├── server.js       # Express サーバー（/token エンドポイント）
├── index.html      # フロントエンド HTML
├── script.js       # SkyWay 接続ロジック
├── style.css       # スタイル
├── .env            # 環境変数（Git に含めない）
├── .gitignore
└── libs/           # SkyWay SDK（ローカルファイル）
    ├── skyway_core-1.15.2.js
    └── skyway_room-1.15.2.js
```
