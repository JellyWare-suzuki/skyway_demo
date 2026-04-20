import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { SkyWayAuthToken, nowInSec, uuidV4 } from "@skyway-sdk/token";

// LAN内の IPv4 アドレスを取得する
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

// このファイルと同じディレクトリの静的ファイルを配信する
app.use(express.static(__dirname));

const appId = process.env.SKYWAY_APP_ID;
const secretKey = process.env.SKYWAY_SECRET_KEY;

// GET /token : フロントエンドがトークンを取得するエンドポイント
app.get("/token", (req, res) => {
  if (!appId || !secretKey) {
    console.error("❌ .env に SKYWAY_APP_ID / SKYWAY_SECRET_KEY が設定されていません");
    return res.status(500).json({ error: "サーバーの環境変数が設定されていません" });
  }

  try {
    const token = new SkyWayAuthToken({
      jti: uuidV4(),
      iat: nowInSec(),
      exp: nowInSec() + 60 * 60, // 1時間有効
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

// 0.0.0.0 にバインドすることで LAN 内の他端末からもアクセス可能になる
app.listen(3000, "0.0.0.0", () => {
  const lanIp = getLanIp();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ サーバー起動");
  console.log(`   このPC     : http://localhost:3000`);
  console.log(`   LAN内の端末 : http://${lanIp}:3000`);
  console.log(`   APP_ID : ${appId  ?? "❌ 未設定 (.env を確認)"}`);
  console.log(`   SECRET : ${secretKey ? "✅ 設定済み" : "❌ 未設定 (.env を確認)"}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});
