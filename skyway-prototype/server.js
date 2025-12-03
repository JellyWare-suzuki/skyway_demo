import "dotenv/config";
import express from "express";
import cors from "cors";
import {
  SkyWayAuthToken,
  nowInSec,
  uuidV4
} from "@skyway-sdk/token";

const app = express();
app.use(cors());
app.use(express.json());

// ★ 環境変数から読み込む（GitHub に載らない安全な方法）
const appId = process.env.SKYWAY_APP_ID;
const secretKey = process.env.SKYWAY_SECRET_KEY;

app.post("/token", (req, res) => {
  const token = new SkyWayAuthToken({
    jti: uuidV4(),
    iat: nowInSec(),
    exp: nowInSec() + 60 * 10, // 10分だけ有効
    scope: {
      app: {
        id: appId,
        turn: true,
        actions: ["write"],
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
                subscription: { actions: ["write"] }
              }
            ]
          }
        ]
      }
    }
  }).encode(secretKey);

  res.json({ token });
});

app.listen(3000, () => console.log("Token server running at :3000"));
