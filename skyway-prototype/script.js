// ==============================
// ユーティリティ
// ==============================

// タイムスタンプ付きのコンソールログ
const log = (label, data) => {
  const ts = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  if (data !== undefined) {
    console.log(`[${ts}] ${label}`, data);
  } else {
    console.log(`[${ts}] ${label}`);
  }
};

// SkyWay Room SDK がグローバルに読み込まれるまで待つ
const waitForSkywayRoom = async (retries = 40, intervalMs = 200) => {
  for (let i = 0; i < retries; i++) {
    if (globalThis.skyway_room) return globalThis.skyway_room;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("SkyWay SDK（room）が読み込まれていません。libs/ 配下のファイルを確認してください。");
};

// サーバーからトークンを取得する
const fetchToken = async () => {
  log("🔑 トークン取得開始 → GET /token");
  const res = await fetch("/token");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`トークン取得失敗 (HTTP ${res.status}): ${body}`);
  }
  const { token } = await res.json();
  log("🔑 トークン取得成功", token.slice(0, 50) + "…");
  return token;
};

// ==============================
// メイン処理
// ==============================
const main = async () => {
  log("🚀 アプリ初期化開始");

  const skywayRoom = await waitForSkywayRoom();
  log("✅ SkyWay SDK 読み込み完了");

  const { SkyWayContext, SkyWayRoom, SkyWayStreamFactory } = skywayRoom;

  // DOM 取得
  const localVideo      = document.getElementById("local-video");
  const localAudio      = document.getElementById("local-audio");
  const remoteVideo     = document.getElementById("remote-video");
  const remoteAudio     = document.getElementById("remote-audio");
  const roomNameInput   = document.getElementById("room-name");
  const joinButton      = document.getElementById("join-button");
  const localMuteButton = document.getElementById("local-mute-buton");
  const leaveButton     = document.getElementById("leave-button");
  const myId            = document.getElementById("my-id");
  const remoteId        = document.getElementById("remote-id");

  let isJoined = false;
  let isMuted  = false;
  let me       = null;
  let room     = null;
  let localAudioPublication = null;
  let localVideoPublication = null;

  localMuteButton.disabled = true;
  leaveButton.disabled     = true;

  // カメラ・マイク取得（ページ読み込み時に一度だけ）
  log("📷 カメラ・マイク取得開始");
  const video = await SkyWayStreamFactory.createCameraVideoStream();
  const audio = await SkyWayStreamFactory.createMicrophoneAudioStream();
  video.attach(localVideo);
  audio.attach(localAudio);
  log("📷 カメラ・マイク取得完了");

  // ==============================
  // ミュート切替
  // ==============================
  const toggleLocalMute = async () => {
    if (!localAudioPublication || !localVideoPublication) return;
    if (isMuted) {
      await localAudioPublication.enable();
      await localVideoPublication.enable();
      localMuteButton.textContent = "映像・音声OFF";
      isMuted = false;
    } else {
      await localAudioPublication.disable();
      await localVideoPublication.disable();
      localMuteButton.textContent = "映像・音声ON";
      isMuted = true;
    }
  };

  // ==============================
  // 相手のストリームを自動購読して表示
  // ==============================
  const subscribeAndAttach = async (publication) => {
    if (!me || publication.publisher.id === me.id) return;

    log("📡 購読開始", `publisher=${publication.publisher.id}  type=${publication.contentType}`);
    remoteId.textContent = publication.publisher.id;

    const { stream } = await me.subscribe(publication.id);
    log("📡 購読完了", `kind=${stream.track.kind}`);

    if (stream.track.kind === "video") {
      stream.attach(remoteVideo);
    } else if (stream.track.kind === "audio") {
      stream.attach(remoteAudio);
    }
  };

  // ==============================
  // Room 参加ボタン
  // ==============================
  joinButton.onclick = async () => {
    if (roomNameInput.value === "" || isJoined) return;
    joinButton.disabled = true;

    try {
      // ── Step 1: トークン取得 ──
      const token = await fetchToken();

      // ── Step 2: SkyWayContext 作成 ──
      log("🔐 SkyWayContext.Create 開始");
      const context = await SkyWayContext.Create(token);
      log("🔐 SkyWayContext.Create 完了");

      // ── Step 3: Room 作成 or 検索 ──
      const roomName = roomNameInput.value;
      log(`🏠 Room.FindOrCreate 開始  name="${roomName}"  type=p2p`);
      room = await SkyWayRoom.FindOrCreate(context, {
        type: "p2p",   // SFU より設定がシンプルで2人通話に最適
        name: roomName,
      });
      log("🏠 Room.FindOrCreate 完了", `roomId=${room.id}`);

      // ── Step 4: Room 参加 ──
      log("🚪 room.join 開始");
      me = await room.join();
      log("🚪 room.join 完了", `myId=${me.id}`);
      myId.textContent = me.id;
      isJoined = true;

      // ── Step 5: 音声 publish ──
      log("🎙️ audio publish 開始");
      localAudioPublication = await me.publish(audio);
      log("🎙️ audio publish 完了");

      // ── Step 6: 映像 publish ──
      log("🎥 video publish 開始");
      localVideoPublication = await me.publish(video);
      log("🎥 video publish 完了");

      localMuteButton.disabled = false;
      leaveButton.disabled     = false;
      localMuteButton.onclick  = toggleLocalMute;

      // ── Step 7: 既存ストリームを購読 ──
      log("📋 既存 publication 確認", `${room.publications.length} 件`);
      room.publications.forEach(subscribeAndAttach);

      // ── Step 8: 新しいストリームを購読 ──
      room.onStreamPublished.add((e) => {
        log("🔔 onStreamPublished 発火", `publisher=${e.publication.publisher.id}`);
        subscribeAndAttach(e.publication);
      });

      // ── 退出ボタン ──
      leaveButton.onclick = async () => {
        log("👋 退出開始");
        await me.leave();
        log("👋 退出完了");
        me   = null;
        room = null;
        resetUI();
      };

    } catch (err) {
      log("❌ 接続エラー", err.message);

      // WebSocket / 接続系のエラーに分かりやすいメッセージ
      if (
        err.message?.includes("WebSocket") ||
        err.message?.includes("connectRace") ||
        err.message?.includes("wss://")
      ) {
        alert(
          "【SkyWayサーバーへの接続に失敗しました】\n\n" +
          "考えられる原因:\n" +
          "1. ネットワーク・ファイアウォールが wss://rtc-api.skyway.ntt.com をブロックしている\n" +
          "2. .env の SKYWAY_APP_ID / SKYWAY_SECRET_KEY が間違っている\n\n" +
          "ブラウザのコンソール(F12 → Console)で詳細ログを確認してください。"
        );
      } else {
        alert("エラー: " + err.message);
      }

      joinButton.disabled = false;
    }
  };

  // ==============================
  // UI リセット
  // ==============================
  const resetUI = () => {
    myId.textContent       = "";
    remoteId.textContent   = "";
    remoteVideo.srcObject  = null;
    remoteAudio.srcObject  = null;
    joinButton.disabled    = false;
    localMuteButton.disabled = true;
    leaveButton.disabled   = true;
    localMuteButton.textContent = "映像・音声OFF";
    isJoined = false;
    isMuted  = false;
    localAudioPublication  = null;
    localVideoPublication  = null;
  };

  log("✅ アプリ初期化完了 — Room名を入力して「Room作成/参加」を押してください");
};

main().catch((err) => {
  console.error("❌ 致命的エラー:", err);
  alert("起動エラー: " + err.message);
});
