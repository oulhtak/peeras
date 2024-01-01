import { RtcConnection } from "./rtcconnection.js";
import { manageMainChannel } from "./mainChannel.js";
import { manageStreams } from "./mediaStream.js";
import { startRead, endRead } from "./fileStream.js";

export default class Peeras extends RtcConnection {
  constructor(config, servers) {
    super(config, servers);
    this.development = true;
    this.localFile = null;
    this.remoteFile = null;
    this.localMediaStreams = null;
    this.channel = null;
  }

  initialize({ localStreams } = {}) {
    return new Promise(async (resolve) => {
      //guard to prevent calling initialize twice
      if (this.connection?.localDescription?.sdp) {
        throw Error("initialize can only be called once");
      }

      // You must add at least a datachannel before you create an offer
      // https://stackoverflow.com/questions/15324500/creating-webrtc-data-channels-after-peerconnection-established
      manageMainChannel(this);
      manageStreams(this, localStreams);

      const offer = await this.connection.createOffer();
      await this.connection.setLocalDescription(offer);

      this.connection.onicecandidate = (e) => {
        if (e.candidate) {
          const sdp = this.connection.localDescription.sdp.toString();
          resolve(sdp);
        }
      };
    });
  }

  async verify(sdp) {
    const answer = new RTCSessionDescription({
      type: "answer",
      sdp: sdp,
    });
    await this.connection.setRemoteDescription(answer);
  }

  answer({ offer, localStreams }) {
    return new Promise(async (resolve) => {
      this.connection.ondatachannel = (e) => {
        manageMainChannel(this, e.channel);
      };

      manageStreams(this, localStreams);

      const remoteOffer = new RTCSessionDescription({
        type: "offer",
        sdp: offer,
      });

      await this.connection.setRemoteDescription(remoteOffer);

      const answer = await this.connection.createAnswer();
      await this.connection.setLocalDescription(answer);

      this.connection.onicecandidate = (e) => {
        if (e.candidate) {
          const sdp = this.connection.localDescription.sdp.toString();
          resolve(sdp);
        }
      };
    });
  }

  checkCallOrAnswerType(callid) {
    const sdpObject = callid;
    const video = sdpObject.includes("m=video");
    const audio = sdpObject.includes("m=audio");
    return {
      video,
      audio,
    };
  }

  sendMessage(content) {
    if (!this.channel || this.channel.readyState !== "open") {
      throw Error("channel not ready");
    }
    this.channel.send(
      JSON.stringify({
        type: "message",
        data: content,
      })
    );
  }

  sendFile = async (file) => {
    if (!this.channel || this.channel.readyState !== "open") {
      throw Error("channel not ready");
    }

    if (this.localFile) {
      throw Error("another file is sending");
    }

    startRead(this, file);

    this.channel.send(
      JSON.stringify({
        type: "initializing",
        data: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
      })
    );
  };

  abortFile = () => {
    if (this.localFile) {
      endRead(this);
      this.channel.send(
        JSON.stringify({
          type: "fileStreamAborted",
        })
      );
    }
  };
}
