import { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";

const Call = () => {
  const socket = useSocket();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [peerConnection, setPeerConnection] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const configuration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    const peer = new RTCPeerConnection(configuration);
    setPeerConnection(peer);

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { candidate: event.candidate });
      }
    };

    peer.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    socket.on("incoming-call", async ({ offer }) => {
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("answer-call", { answer });
    });

    socket.on("ice-candidate", ({ candidate }) => {
      peer.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      peer.close();
    };
  }, [socket]);

  const startCall = async () => {
    if (!peerConnection) return;

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("call-user", { offer });
  };

  return (
    <div>
      <video ref={localVideoRef} autoPlay muted style={{ width: "300px" }} />
      <video ref={remoteVideoRef} autoPlay style={{ width: "300px" }} />
      <button onClick={startCall}>Start Call</button>
    </div>
  );
};

export default Call;
