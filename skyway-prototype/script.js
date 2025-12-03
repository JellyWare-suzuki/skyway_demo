// 🔹 背景ぼかしライブラリを読み込む
import skywayVideoProcessors from "https://esm.sh/skyway-video-processors";
const { BlurBackground } = skywayVideoProcessors;

// 🔹 SkyWay Room SDK が読み込まれるまで待つ
const waitForSkywayRoom = async (retries = 40, intervalMs = 200) => {
  for (let i = 0; i < retries; i++) {
    if (globalThis.skyway_room) return globalThis.skyway_room;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("SkyWay SDK（room）が読み込まれていません。CDN を確認してください。");
};

const main = async () => {
  const skywayRoom = await waitForSkywayRoom();
  const {
    nowInSec,
    SkyWayAuthToken,
    SkyWayContext,
    SkyWayRoom,
    SkyWayStreamFactory,
    uuidV4,
  } = skywayRoom;

  // ==============================
  // 🔐 SkyWay 認証トークン
  // ==============================
  const appId = "9ce04826-c26a-4dc3-b74b-84317a915529";
  const secretKey = "8Z2RdMT/+rlCnC9CGjpDSPTcNpKV7xrfOPEuZcuS7ag=";

  const token = new SkyWayAuthToken({
    jti: uuidV4(),
    iat: nowInSec(),
    exp: nowInSec() + 60 * 60 * 24,
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

  // ==============================
  // 🔧 DOM 取得
  // ==============================
  const localAudio = document.getElementById("local-audio");
  const localVideo = document.getElementById("local-video");
  const roomNameInput = document.getElementById("room-name");
  const joinButton = document.getElementById("join-button");
  const localMuteButton = document.getElementById("local-mute-buton");
  const leaveButton = document.getElementById("leave-button");
  const myId = document.getElementById("my-id");
  const remoteId = document.getElementById("remote-id");
  const remoteVideo = document.getElementById("remote-video");
  const remoteAudio = document.getElementById("remote-audio");
  const buttonArea = document.querySelector("#button-area");

  let isJoined = false;
  let isMuted = false;
  let me = null;
  let room = null;

  localMuteButton.disabled = true;
  leaveButton.disabled = true;

  // ==============================
  // 🎥 背景ぼかしの初期化
  // ==============================
  let backgroundProcessor = null;
  try {
    backgroundProcessor = new BlurBackground();
    await backgroundProcessor.initialize();
  } catch (e) {
    console.warn("背景ぼかしが利用できません:", e);
    backgroundProcessor = null;
  }

  // ==============================
  // 🎥 カメラ・マイクの取得
  // ==============================
  let video;
  if (SkyWayStreamFactory.createCustomVideoStream && backgroundProcessor) {
    video = await SkyWayStreamFactory.createCustomVideoStream(backgroundProcessor, {
      stopTrackWhenDisabled: true,
    });
  } else {
    video = await SkyWayStreamFactory.createCameraVideoStream();
  }

  const audio = await SkyWayStreamFactory.createMicrophoneAudioStream();

  audio.attach(localAudio);
  video.attach(localVideo);

  // ==============================
  // 🔁 ミュート切替
  // ==============================
  let localAudioPublication = null;
  let localVideoPublication = null;

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
  // 🔗 Room 接続
  // ==============================
  joinButton.onclick = async () => {
    if (roomNameInput.value === "") return;
    if (isJoined) return;

    const context = await SkyWayContext.Create(token);
    room = await SkyWayRoom.FindOrCreate(context, {
      type: "sfu",
      name: roomNameInput.value,
    });

    me = await room.join();
    myId.textContent = me.id;
    isJoined = true;

    localAudioPublication = await me.publish(audio);
    localVideoPublication = await me.publish(video, {
      encodings: [
        { id: "low", maxBitrate: 80_000 },
        { id: "middle", maxBitrate: 500_000 },
        { id: "high", maxBitrate: 5_000_000 },
      ],
    });

    localMuteButton.disabled = false;
    leaveButton.disabled = false;

    room.publications.forEach(subscribeAndAttach);
    room.onStreamPublished.add((e) => subscribeAndAttach(e.publication));

    localMuteButton.onclick = toggleLocalMute;

    leaveButton.onclick = async () => {
      await me.leave();
      await room.close();
      resetUI();
    };
  };

  // ==============================
  // 📡 ストリーム購読
  // ==============================
  const subscribeAndAttach = (publication) => {
    if (!me || publication.publisher.id === me.id) return;

    remoteId.textContent = publication.publisher.id;

    const subscribeButton = document.createElement("button");
    subscribeButton.textContent = publication.contentType;
    buttonArea.appendChild(subscribeButton);

    subscribeButton.onclick = async () => {
      const { stream } = await me.subscribe(publication.id);

      if (stream.track.kind === "video") {
        stream.attach(remoteVideo);
      } else if (stream.track.kind === "audio") {
        stream.attach(remoteAudio);
      }

      subscribeButton.disabled = true;
    };
  };

  // ==============================
  // UI リセット
  // ==============================
  const resetUI = () => {
    myId.textContent = "";
    remoteId.textContent = "";
    buttonArea.innerHTML = "";
    localMuteButton.disabled = true;
    leaveButton.disabled = true;
    localMuteButton.textContent = "映像・音声OFF";
    isJoined = false;
    isMuted = false;
  };
};

main().catch((err) => {
  console.error(err);
  alert("エラー: " + err.message);
});
