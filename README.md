# skyway-demo

SkyWay を使ったビデオ通話 Web アプリのプロトタイプです。  
Node.js + Express のトークンサーバーと静的フロントエンドをひとつの Web Service として Render にデプロイしています。

**実装・起動・デプロイの詳細は [`skyway-prototype/README.md`](./skyway-prototype/README.md) を参照してください。**

---

## 構成

```
skyway-demo/
├── package.json            # npm start でサーバーを起動
├── skyway-prototype/
│   ├── server.js           # Express サーバー（POST /token エンドポイント）
│   ├── index.html          # フロントエンド
│   ├── script.js           # SkyWay 接続ロジック
│   ├── style.css
│   ├── .env                # 環境変数（Git 管理外）
│   └── libs/               # SkyWay SDK（ローカルファイル）
└── README.md               # このファイル（案内用）
```

---

## ローカル起動（最短）

```bash
# 1. 依存パッケージをインストール
npm install

# 2. skyway-prototype/.env に環境変数を設定
#    SKYWAY_APP_ID / SKYWAY_SECRET_KEY / APP_ACCESS_KEY

# 3. サーバー起動
npm start
# → http://localhost:3000
```

---

## Render デプロイ概要

| 項目 | 値 |
|------|----|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| 環境変数 | `SKYWAY_APP_ID` / `SKYWAY_SECRET_KEY` / `APP_ACCESS_KEY` |

---

## セキュリティ対応の概要

- `/token` エンドポイントは `POST` のみ受け付け、`APP_ACCESS_KEY` による簡易保護を実装済み
- SkyWay トークンの有効期限は 10 分に設定（漏洩時の被害を最小化）
- `.env` は `.gitignore` で Git 管理から除外済み

> 詳細・注意事項は [`skyway-prototype/README.md`](./skyway-prototype/README.md) を参照してください。
