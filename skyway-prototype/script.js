import skywayVideoProcessors from "https://esm.sh/skyway-video-processors";
const { BlurBackground } = skywayVideoProcessors;
const backgroundProcessor = new BlurBackground();

const skywayRoomLib = globalThis.skyway_room;
if (!skywayRoomLib) {
  throw new Error("SkyWay SDK (skyway_room) ????????????CDN???????????????");
}
const { nowInSec, SkyWayAuthToken, SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } = skywayRoomLib;

// STEP1: SkyWayAuthToken???
// TODO: ????AppID?SecretKey??????????
const appId = "9ce04826-c26a-4dc3-b74b-84317a915529"; // Replace with your AppID
const secretKey = "8Z2RdMT/+rlCnC9CGjpDSPTcNpKV7xrfOPEuZcuS7ag="; // Replace with your SecretKey
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
              publication: {
                actions: ["write"],
              },
              subscription: {
                actions: ["write"],
              },
            },
          ],
          sfuBots: [
            {
              actions: ["write"],
              forwardings: [
                {
                  actions: ["write"],
                },
              ],
            },
          ],
        },
      ],
    },
  },
}).encode(secretKey);

(async () => {
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
  const maxNumberParticipants = 2;

  let isJoined = false;
  let isMuted = false;
  let selectBox = null;
  let me = null;
  let room = null;
  let localAudioPublication = null;
  let localVideoPublication = null;

  leaveButton.disabled = true;
  localMuteButton.disabled = true;

  await backgroundProcessor.initialize();
  const video = await SkyWayStreamFactory.createCustomVideoStream(backgroundProcessor, {
    stopTrackWhenDisabled: true,
  });
  const audio = await SkyWayStreamFactory.createMicrophoneAudioStream();
  audio.attach(localAudio);
  video.attach(localVideo);

  const closeRoom = () => {
    buttonArea.innerHTML = "";
    remoteId.textContent = "";
    myId.textContent = "";
    localMuteButton.disabled = true;
    leaveButton.disabled = true;
    isMuted = false;
    isJoined = false;
    localMuteButton.textContent = "映像・音声OFF";
  };

  const toggleLocalMute = async () => {
    if (!localAudioPublication || !localVideoPublication) return;
    if (isMuted) {
      await localAudioPublication.enable();
      await localVideoPublication.enable();
      isMuted = false;
      localMuteButton.textContent = "映像・音声OFF";
    } else {
      await localAudioPublication.disable();
      await localVideoPublication.disable();
      isMuted = true;
      localMuteButton.textContent = "映像・音声 ON";
    }
  };

  const subscribeAndAttach = (publication) => {
    if (!me) return;
    if (publication.publisher.id === me.id) return;

    remoteId.textContent = publication.publisher.id;

    if (buttonArea.childElementCount >= 3) {
      buttonArea.innerHTML = "";
    }

    const subscribeButton = document.createElement("button");
    subscribeButton.textContent = publication.contentType;
    buttonArea.appendChild(subscribeButton);

    let encodingSelector = null;
    if (publication.contentType === "video") {
      const selectData = [
        { value: "low", label: "低画質" },
        { value: "middle", label: "中画質" },
        { value: "high", label: "高画質" },
      ];
      encodingSelector = document.createElement("select");
      selectData.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.value;
        option.text = item.label;
        encodingSelector.appendChild(option);
      });
      buttonArea.appendChild(encodingSelector);
    }

    subscribeButton.onclick = async () => {
      const { stream, subscription } = await me.subscribe(publication.id);
      switch (stream.track.kind) {
        case "video":
          stream.attach(remoteVideo);
          subscription.changePreferredEncoding("low");
          if (encodingSelector) {
            encodingSelector.addEventListener("change", function () {
              switch (this.value) {
                case "low":
                  subscription.changePreferredEncoding("low");
                  break;
                case "middle":
                  subscription.changePreferredEncoding("middle");
                  break;
                case "high":
                  subscription.changePreferredEncoding("high");
                  break;
                default:
                  break;
              }
            });
          }
          publication.onDisabled.add(() => remoteVideo.load());
          break;
        case "audio":
          stream.attach(remoteAudio);
          break;
        default:
          return;
      }
      subscribeButton.disabled = true;
    };
  };

  joinButton.onclick = async () => {
    if (roomNameInput.value === "") return;
    if (isJoined) return;

    const context = await SkyWayContext.Create(token);
    room = await SkyWayRoom.FindOrCreate(context, {
      type: "sfu",
      name: roomNameInput.value,
    });

    if (room.members.length > maxNumberParticipants) {
      console.log("最大参加人数(" + maxNumberParticipants + ")を超えています");
      room.dispose();
      return;
    }

    me = await room.join();
    myId.textContent = me.id;
    isJoined = true;

    localMuteButton.disabled = false;
    leaveButton.disabled = false;

    localAudioPublication = await me.publish(audio);
    localVideoPublication = await me.publish(video, {
      encodings: [
        { maxBitrate: 80_000, id: "low" },
        { maxBitrate: 500_000, id: "middle" },
        { maxBitrate: 5_000_000, id: "high" },
      ],
    });

    room.publications.forEach(subscribeAndAttach);
    room.onStreamPublished.add((e) => subscribeAndAttach(e.publication));

    localMuteButton.onclick = toggleLocalMute;

    leaveButton.onclick = async () => {
      await me.leave();
      await room.close();
      closeRoom();
    };

    room.onMemberLeft.add(() => closeRoom());
  };
})();
