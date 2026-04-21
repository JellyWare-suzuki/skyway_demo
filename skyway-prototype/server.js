import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { SkyWayAuthToken, nowInSec, uuidV4 } from "@skyway-sdk/token";

// LAN の IPv4 アドレスを取得（起動ログ用）
const getLanIp = () => {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "取得できませんでした";
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// このファイルと同じディレクトリの静的ファイル（index.html 等）を配信
app.use(express.static(__dirname));

// 環境変数
const appId      = process.env.SKYWAY_APP_ID;
const secretKey  = process.env.SKYWAY_SECRET_KEY;
const accessKey  = process.env.APP_ACCESS_KEY; // フロントが送るアクセスキー

// POST /token : SkyWay 認証トークンを発行する
// フロントは body に { accessKey: "..." } を含めること
app.post("/token", (req, res) => {
  // ── 1. アクセスキー検証 ──
  // APP_ACCESS_KEY が未設定の場合はサーバー側の設定ミスとして 500 を返す
  if (!accessKey) {
    console.error("❌ APP_ACCESS_KEY が環境変数に設定されていません");
    return res.status(500).json({ error: "サーバーの設定エラーです。管理者に連絡してください。" });
  }

  if (req.body.accessKey !== accessKey) {
    console.warn("⚠️  /token: アクセスキー不一致 → 403");
    return res.status(403).json({ error: "アクセスが拒否されました" });
  }

  // ── 2. SkyWay 環境変数チェック ──
  if (!appId || !secretKey) {
    console.error("❌ SKYWAY_APP_ID / SKYWAY_SECRET_KEY が設定されていません");
    return res.status(500).json({ error: "サーバーの環境変数が設定されていません" });
  }

  // ── 3. トークン生成 ──
  try {
    const token = new SkyWayAuthToken({
      jti: uuidV4(),
      iat: nowInSec(),
      exp: nowInSec() + 60 * 10, // 本番では短め推奨（ここでは 10 分）
      scope: {
        app: {
          id: appId,
          turn: true,
          actions: ["read"],
          channels: [
            {
              id: "*",
              name: "*",
              actions: ["write"],
              members: [
                {
                  id: "*",
                  name: "*",
                  actions: ["write"],
                  publication: { actions: ["write"] },
                  subscription: { actions: ["write"] },
                },
              ],
              sfuBots: [
                {
                  actions: ["write"],
                  forwardings: [{ actions: ["write"] }],
                },
              ],
            },
          ],
        },
      },
    }).encode(secretKey);

    console.log(`✅ トークン発行成功 (appId: ${appId})`);
    res.json({ token });
  } catch (err) {
    console.error("❌ トークン生成エラー:", err.message);
    res.status(500).json({ error: "トークン生成に失敗しました: " + err.message });
  }
});

// Render は PORT を自動注入する。ローカルは 3000 にフォールバック
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  const lanIp = getLanIp();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ サーバー起動");
  console.log(`   ポート      : ${PORT}`);
  console.log(`   このPC     : http://localhost:${PORT}`);
  console.log(`   LAN内の端末 : http://${lanIp}:${PORT}`);
  console.log(`   APP_ID     : ${appId     ?? "❌ 未設定"}`);
  console.log(`   SECRET     : ${secretKey  ? "✅ 設定済み" : "❌ 未設定"}`);
  console.log(`   ACCESS_KEY : ${accessKey  ? "✅ 設定済み" : "❌ 未設定"}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});
