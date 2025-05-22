import React, { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X } from "lucide-react";
import toast from "react-hot-toast";
import { useThemeStore } from "../store/useThemeStore";
import { THEMES } from "../constants";

const CallPage = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const { socket, socketConnected } = useAuthStore();
  const {
    isCallActive,
    isCallIncoming,
    localStream,
    remoteStream,
    startCall,
    handleIncomingCall,
    handleCallAnswer,
    handleIceCandidate,
    endCall,
    isCaller
  } = useCallStore();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const { authUser } = useAuthStore();
  const [localIsCaller, setLocalIsCaller] = useState(false);
  const { theme, setTheme } = useThemeStore();

  // Determine if the current user is the caller
  const isUserCaller = useMemo(() => {
    if (!callId || !authUser) return false;
    // Get the call session ID from the store
    const { callSessionId } = useCallStore.getState();
    // If we have a callSessionId in the store and it matches the URL parameter, we're the caller
    return callSessionId === callId;
  }, [callId, authUser]);

  useEffect(() => {
    if (!socketConnected) {
      toast.error("Waiting for socket connection...");
      return;
    }

    // Validate callId parameter
    if (!callId) {
      console.error("Call ID is missing");
      toast.error("Invalid call URL");
      navigate("/");
      return;
    }

    try {
      // Get the call session ID from the store
      const { callSessionId, isCaller } = useCallStore.getState();
      
      // Validate that we have a call session ID
      if (!callSessionId) {
        console.error("No call session ID in store");
        toast.error("Invalid call session");
        navigate("/");
        return;
      }
      
      if (!authUser) {
        toast.error("User not authenticated");
        navigate("/login");
        return;
      }

      setLocalIsCaller(isCaller);

      console.log("Call page initialized:", {
        isCaller,
        callSessionId,
        authUserId: authUser._id,
        socketConnected,
        socketId: socket?.id
      });

      // Only start the call if we're the caller and there's no active call
      if (isCaller && !isCallActive) {
        console.log("Call already initiated as caller");
      }

      // Set up socket event listeners
      socket.on("call-offer", async ({ offer, from, callSessionId }) => {
        console.log("Received call offer:", { from, callSessionId });
        if (!isCaller) {
          try {
            await handleIncomingCall({ offer, from, callSessionId });
          } catch (error) {
            console.error("Error handling incoming call:", error);
            toast.error("Failed to handle incoming call");
            navigate("/");
          }
        }
      });

      socket.on("call-answer", async ({ answer, from, callSessionId }) => {
        console.log("Received call answer:", { from, callSessionId });
        if (isCaller) {
          try {
            await handleCallAnswer(answer, from, callSessionId);
          } catch (error) {
            console.error("Error handling call answer:", error);
            toast.error("Failed to handle call answer");
            navigate("/");
          }
        }
      });

      socket.on("ice-candidate", async ({ candidate, from, callSessionId }) => {
        console.log("Received ICE candidate:", { from, callSessionId });
        try {
          await handleIceCandidate(candidate, from, callSessionId);
      } catch (error) {
          console.error("Error handling ICE candidate:", error);
        }
      });

      socket.on("end-call", ({ callSessionId, from }) => {
        console.log("Call ended by:", from);
        endCall();
        navigate("/");
      });

    return () => {
        console.log("Cleaning up call page");
        socket.off("call-offer");
        socket.off("call-answer");
        socket.off("ice-candidate");
        socket.off("end-call");
        // Only end the call if we're actually navigating away from the call page
        if (window.location.pathname !== `/call/${callId}`) {
          console.log("Navigating away from call page, ending call");
          endCall();
        } else {
          console.log("Still on call page, not ending call");
        }
      };
    } catch (error) {
      console.error("Error in useEffect:", error);
      toast.error("An error occurred");
      navigate("/");
    }
  }, [callId, socket, socketConnected, endCall]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log("Setting local video stream");
      localVideoRef.current.srcObject = localStream;
      
      // Log the tracks in the local stream
      const tracks = localStream.getTracks();
      console.log("Local stream tracks:", tracks.map(track => ({
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      })));
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log("Setting remote video stream");
      remoteVideoRef.current.srcObject = remoteStream;
      
      // Log the tracks in the remote stream
      const tracks = remoteStream.getTracks();
      console.log("Remote stream tracks:", tracks.map(track => ({
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      })));
    }
  }, [remoteStream]);

  // Add a debug effect to log state changes
  useEffect(() => {
    console.log("Call state updated:", {
      isCallActive,
      isCallIncoming,
      localStream: !!localStream,
      remoteStream: !!remoteStream,
      isCaller
    });
  }, [isCallActive, isCallIncoming, localStream, remoteStream, isCaller]);

  // Handle call end
  useEffect(() => {
    if (!isCallActive) {
      console.log("Call is no longer active, navigating away");
      navigate("/");
    }
  }, [isCallActive, navigate]);

  // Update local state when store state changes
  useEffect(() => {
    setLocalIsCaller(isUserCaller);
  }, [isUserCaller]);

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const handleEndCall = () => {
    console.log("Ending call");
    endCall();
    navigate("/");
  };

  if (!socketConnected) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Connecting...</h2>
          <p className="text-gray-600">Please wait while we establish the connection.</p>
        </div>
      </div>
    );
  }

  // if (isCallIncoming) {
  //   return (
  //     <div className="flex items-center justify-center h-screen">
  //       {/* <div className="text-center">
  //         <h2 className="text-2xl font-bold mb-4">Incoming Call</h2>
  //         <div className="space-x-4">
  //           <button
  //             onClick={() => handleIncomingCall()}
  //             className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600"
  //           >
  //             Accept
  //           </button>
  //           <button
  //             onClick={handleEndCall}
  //             className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600"
  //           >
  //             Decline
  //           </button>
  //         </div>
  //       </div> */}
  //     </div>
  //   );
  // }

  if (!isCallActive) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Call not active</h1>
          <p className="mb-4">Redirecting you back to home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-6xl">
          {/* Remote Video (larger) */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-xl mb-2">Waiting for remote video...</p>
                  <p className="text-sm text-gray-400">
                    {localIsCaller ? "Waiting for receiver to join" : "Connecting to caller"}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Local Video (smaller) */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
            {localStream ? (
        <video
          ref={localVideoRef}
          autoPlay
                playsInline
          muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p>Local video not available</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Call Controls */}
      <div className="bg-gray-800 p-4 flex justify-center space-x-4">
        <button
          onClick={toggleAudio}
          className={`p-3 rounded-full ${
            isMuted ? "bg-red-500" : "bg-gray-700"
          }`}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        
          <button
          onClick={toggleVideo}
          className={`p-3 rounded-full ${
            isVideoOff ? "bg-red-500" : "bg-gray-700"
          }`}
        >
          {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
        
          <button
          onClick={handleEndCall}
          className="p-3 rounded-full bg-red-500"
          >
          <Phone size={24} className="rotate-135" />
          </button>
      </div>
    </div>
  );
};

export default CallPage;
