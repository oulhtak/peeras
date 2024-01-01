export function manageStreams(self, streams) {
  if (!streams) {
    return;
  }
  self.localStreams = streams.map((stream, index) => {
    return stream.getTracks().reduce((acc, track) => {
      const type = track.kind; // audio or video
      const sender = self.connection.addTrack(track, stream);
      acc[type] = {
        sender,
        stop: function () {
          this.sender.track.enabled = false; // rtpSender.track will point on our actual track
          self.channel.send(
            JSON.stringify({
              type: "mediaStreamStoped",
              data: {
                type: type,
                streamId: stream.id,
                streamIndex: index,
              },
            })
          );
        },
        resume: function () {
          this.sender.track.enabled = true;
          self.channel.send(
            JSON.stringify({
              type: "mediaStreamResumed",
              data: {
                type: type,
                streamId: stream.id,
                streamIndex: index,
              },
            })
          );
        },
        // replaceTrack(newTrack) {
        //   // not implemented yet
        //   // if (newTrack.constructor.name) ref.sender.replaceTrack(newTrack);
        // },
      };
      return acc;
    }, {});
  });
}
