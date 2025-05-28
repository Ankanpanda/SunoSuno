import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";

export const useCallStore = create((set, get) => ({
  isCallActive: false,
  isCallIncoming: false,
  callSessionId: null,
  peerConnection: null,
  localStream: null,
  remoteStream: null,
  caller: null,
  receiver: null,
  incomingCall: null,
  incomingCallsQueue: [],
  queuedCallNotifications: [],
  activeCallStartTime: null,
  earlyIceCandidates: {},

  setIncomingCall: (callData) => {
    try {
      console.log("Setting incoming call data:", callData);
      
      // Validate call data
      if (!callData || typeof callData !== 'object') {
        console.error("Invalid call data:", callData);
        return false;
      }
      
      const { offer, from, callSessionId } = callData;
      
      // Validate required fields
      if (!offer || !from || !callSessionId) {
        console.error("Missing required fields in call data:", { offer, from, callSessionId });
        return false;
      }
      
      // Validate offer data
      if (!offer.sdp || !offer.type) {
        console.error("Invalid offer data:", offer);
        return false;
      }
      
      // Check if we're already in a call
      const { isCallActive, peerConnection } = get();
      const { socket, authUser } = useAuthStore.getState();
      
      // Get caller's name from users list if available
      let callerName = from;
      const { users } = useChatStore.getState();
      if (users && users.length > 0) {
        const caller = users.find(user => user._id === from);
        if (caller) {
          callerName = caller.fullName;
        }
      }
      
      // Process the call data
      const processedCallData = {
        offer: {
          sdp: offer.sdp,
          type: offer.type
        },
        from,
        callerName,
        callSessionId,
        timestamp: Date.now() // Add timestamp for queue management
      };
      
      // If we're in an active call, notify the caller that the user is busy
      if (isCallActive && peerConnection && peerConnection.connectionState === "connected") {
        console.log("User is busy, sending busy notification to caller");
        
        // Send a "user busy" notification to the caller
        if (socket && authUser) {
          socket.emit("call-rejected", {
            to: from,
            from: authUser._id,
            callSessionId,
            reason: "User is busy in another call"
          });
          
          // Show a toast notification
          toast.info(`Call from ${callerName} rejected - you are busy in another call`);
        }
        
        return true;
      }
      
      // If we're not in a call or the current call is disconnected, set as incoming call
      console.log("Setting new incoming call");
      set((state) => ({
        ...state,
        incomingCall: processedCallData,
        isCallIncoming: true
      }));
      
      // Show a toast notification
      toast.success(`Incoming call from ${callerName}`);
      
      return true;
    } catch (error) {
      console.error("Error setting incoming call:", error);
      return false;
    }
  },

  getIncomingCalls: () => {
    return get().incomingCallsQueue;
  },

  removeIncomingCall: (callSessionId) => {
    set((state) => ({
      incomingCallsQueue: state.incomingCallsQueue.filter(call => call.callSessionId !== callSessionId),
      incomingCall: state.incomingCall?.callSessionId === callSessionId ? null : state.incomingCall
    }));
  },

  clearIncomingCalls: () => {
    set({
      incomingCallsQueue: [],
      incomingCall: null
    });
  },

  acceptCall: async (offer, from, callSessionId) => {
    try {
      console.log("Accepting call from:", from, "with session ID:", callSessionId);
      console.log("Offer data:", offer);
      
      const { socket, authUser } = useAuthStore.getState();
      
      if (!socket || !authUser) {
        console.error("Socket or auth user not initialized");
        toast.error("Connection error: Socket or user not initialized");
        return false;
      }

      // First, reject all other incoming calls
      const { incomingCallsQueue } = get();
      console.log("Current incoming calls queue:", incomingCallsQueue);
      
      // Reject all other calls before proceeding
      for (const call of incomingCallsQueue) {
        if (call.callSessionId !== callSessionId) {
          console.log("Rejecting other incoming call:", call.callSessionId);
          socket.emit("call-rejected", {
            to: call.from,
            from: authUser._id,
            reason: "User accepted another call"
          });
        }
      }

      // Clear all incoming calls
      get().clearIncomingCalls();

      // Validate offer data
      if (!offer || typeof offer !== 'object') {
        console.error("Invalid offer data:", offer);
        toast.error("Invalid call offer received");
        return false;
      }

      // Make sure offer has the required properties
      if (!offer.sdp || !offer.type) {
        console.error("Offer missing required properties:", offer);
        toast.error("Call offer is missing required data");
        return false;
      }

      // Initialize WebRTC with more detailed configuration
      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" }
        ],
        iceCandidatePoolSize: 10
      });

      // Get local stream with error handling
      let stream;
      try {
        console.log("Requesting local media stream...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        console.log("Local stream obtained successfully");
      } catch (mediaError) {
        console.error("Error getting local media stream:", mediaError);
        toast.error("Failed to access camera/microphone. Please check permissions.");
        return false;
      }

      // Add tracks to peer connection
      try {
        console.log("Adding tracks to peer connection...");
        stream.getTracks().forEach(track => {
          console.log("Adding track:", track.kind);
          peer.addTrack(track, stream);
        });
        console.log("All tracks added successfully");
      } catch (trackError) {
        console.error("Error adding tracks to peer connection:", trackError);
        toast.error("Failed to set up media tracks");
        return false;
      }

      // Set up event handlers with detailed logging
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("New ICE candidate (incoming call):", event.candidate);
          
          // Create a properly formatted ICE candidate object
          const iceCandidate = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          };
          
          console.log("Sending ICE candidate:", iceCandidate);
          
          socket.emit("ice-candidate", {
            candidate: iceCandidate,
            to: from,
            from: authUser._id,
            callSessionId
          });
        } else {
          console.log("ICE candidate gathering completed");
        }
      };

      peer.onicegatheringstatechange = () => {
        console.log("ICE gathering state changed:", peer.iceGatheringState);
      };

      peer.ontrack = (event) => {
        console.log("Received remote track (incoming call):", event.streams[0]);
        console.log("Remote track details:", {
          id: event.streams[0]?.id,
          active: event.streams[0]?.active,
          tracks: event.streams[0]?.getTracks().map(track => ({
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState
          }))
        });
        
        // Make sure we're setting the remote stream correctly
        if (event.streams && event.streams[0]) {
          console.log("Setting remote stream from track event");
          set({ remoteStream: event.streams[0] });
        } else {
          console.warn("No streams in track event");
        }
      };

      peer.onconnectionstatechange = () => {
        console.log("Connection state changed (incoming call):", peer.connectionState);
        
        // Only end the call if we've been disconnected for a while
        if (peer.connectionState === "disconnected" || peer.connectionState === "failed") {
          console.log("Connection state is disconnected/failed, checking if we should end call");
          
          // Check if we have an active stream
          const { localStream, remoteStream } = get();
          const hasActiveStreams = localStream?.active || remoteStream?.active;
          
          if (!hasActiveStreams) {
            console.log("No active streams found, ending call");
            get().endCall();
          } else {
            console.log("Active streams found, keeping call alive");
          }
        }
      };

      // Set remote description and create answer with detailed error handling
      try {
        console.log("Setting remote description with offer:", offer);
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        console.log("Remote description set successfully");
        
        console.log("Creating answer");
        const answer = await peer.createAnswer();
        console.log("Answer created successfully:", answer);
        
        console.log("Setting local description with answer");
        await peer.setLocalDescription(answer);
        console.log("Local description set successfully");

        // Emit call answer with proper format
        console.log("Emitting call-answer to:", from);
        socket.emit("call-answer", {
          answer: {
            sdp: answer.sdp,
            type: answer.type
          },
          to: from,
          from: authUser._id,
          callSessionId
        });

        // Update call state
        set({
          isCallActive: true,
          isCallIncoming: false,
          peerConnection: peer,
          localStream: stream,
          receiver: authUser._id,
          caller: from,
          callSessionId
        });

        // Apply any stored ICE candidates
        console.log("Applying any stored ICE candidates for:", from);
        await get().applyStoredIceCandidates(from);

        console.log("Call accepted successfully");
        return true;
      } catch (error) {
        console.error("Error setting up peer connection:", error);
        toast.error("Failed to set up call connection: " + error.message);
        return false;
      }
    } catch (error) {
      console.error("Error accepting call:", error);
      toast.error("Failed to accept call");
      return false;
    }
  },

  rejectCall: (callSessionId) => {
    try {
      const { incomingCallsQueue } = get();
      const { socket, authUser } = useAuthStore.getState();
      
      const callToReject = callSessionId 
        ? incomingCallsQueue.find(call => call.callSessionId === callSessionId)
        : get().incomingCall;
      
      if (callToReject && socket && authUser) {
        console.log("Rejecting call from:", callToReject.from, "with session ID:", callToReject.callSessionId);
        socket.emit("call-rejected", {
          to: callToReject.from,
          from: authUser._id,
          callSessionId: callToReject.callSessionId,
          reason: "Call was rejected by the user"
        });
      }
      
      // Remove the rejected call from the queue
      if (callSessionId) {
        get().removeIncomingCall(callSessionId);
      } else {
        set({ incomingCall: null });
      }
      
      return true;
    } catch (error) {
      console.error("Error rejecting call:", error);
      toast.error("Failed to reject call");
      return false;
    }
  },

  startCall: async (to) => {
    try {
      console.log("Starting call to:", to);
      const { socket, socketConnected } = useAuthStore.getState();
      
      if (!socket) {
        console.error("No socket connection available");
        throw new Error("No socket connection available");
      }
      
      if (!socketConnected) {
        console.error("Socket is not connected");
        throw new Error("Socket is not connected");
      }
      
      console.log("Socket connection status:", {
        connected: socket.connected,
        id: socket.id,
        socketConnected
      });

      // Check if the target user is in a call
      return new Promise((resolve, reject) => {
        // Add a small delay to ensure backend has updated call status
        setTimeout(() => {
          socket.emit("check-user-call-status", { userId: to }, async (response) => {
            console.log("User call status response:", response);
            
            if (response && response.isInCall) {
              console.log("Target user is in a call");
              reject(new Error("User is busy on another call"));
              return;
            }
            
            // If user is not in a call, proceed with creating the call
            try {
              const callSessionId = await createCall();
              
              // Record the call in the backend
              try {
                await axiosInstance.post("/calls/call", {
                  receiverId: to,
                  callSessionId
                });
                console.log("Call recorded in backend successfully");
              } catch (apiError) {
                console.error("Error recording call in backend:", apiError);
                // Don't throw the error, just log it since the call is already started
              }
              
              resolve(callSessionId);
            } catch (error) {
              reject(error);
            }
          });
        }, 500); // 500ms delay to ensure backend has updated
      });
      
      // Function to create the call
      async function createCall() {
        // Create a new peer connection
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
          ],
        });

        // Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        // Add tracks to peer connection
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        // Set up ontrack handler before creating the offer
        peerConnection.ontrack = (event) => {
          console.log("Received remote track (caller side):", event.streams[0]);
          console.log("Remote track details:", {
            id: event.streams[0]?.id,
            active: event.streams[0]?.active,
            tracks: event.streams[0]?.getTracks().map(track => ({
              kind: track.kind,
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState
            }))
          });
          
          // Make sure we're setting the remote stream correctly
          if (event.streams && event.streams[0]) {
            console.log("Setting remote stream from track event (caller side)");
            set({ remoteStream: event.streams[0] });
          } else {
            console.warn("No streams in track event (caller side)");
          }
        };

        // Create and set local description
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Generate a unique call session ID
        const callSessionId = crypto.randomUUID();
        console.log("Generated call session ID:", callSessionId);

        // Set up ICE candidate handling before emitting the call signal
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("New ICE candidate:", event.candidate);
            
            // Create a properly formatted ICE candidate
            const iceCandidate = {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex
            };
            
            console.log("Sending ICE candidate:", iceCandidate);
            
            socket.emit("ice-candidate", {
              candidate: iceCandidate,
              to,
              from: useAuthStore.getState().authUser._id,
              callSessionId
            });
          }
        };

        // Emit the call signal
        const signalData = {
          to,
          from: useAuthStore.getState().authUser._id,
          offer: peerConnection.localDescription,
          callSessionId,
        };

        console.log("Emitting call-user event with data:", {
          to: signalData.to,
          from: signalData.from,
          callSessionId: signalData.callSessionId,
          offerType: signalData.offer.type,
          offerSDP: signalData.offer.sdp
        });

        // Emit both call-user and call-offer events for compatibility
        socket.emit("call-user", signalData);
        
        // Also emit call-offer event directly
        socket.emit("call-offer", {
          to,
          from: useAuthStore.getState().authUser._id,
          offer: peerConnection.localDescription,
          callSessionId
        });

        // Update the store state
        set((state) => ({
          ...state,
          isCallActive: true,
          isCaller: true,
          peerConnection,
          localStream: stream,
          remoteStream: null,
          callSessionId,
        }));

        // Apply any stored ICE candidates
        console.log("Applying any stored ICE candidates for:", to);
        await get().applyStoredIceCandidates(to);

        console.log("Call state updated successfully");
        return callSessionId;
      }
    } catch (error) {
      console.error("Error in startCall:", error);
      throw error;
    }
  },

  handleIncomingCall: async ({ offer, from, callSessionId }) => {
    try {
      const { authUser, socket, token } = useAuthStore.getState();
      
      if (!authUser) {
        throw new Error("User not authenticated");
      }

      if (!socket) {
        throw new Error("Socket not connected");
      }

      let callToken = token;
      if (!callToken) {
        const cookies = document.cookie.split("; ");
        const jwtCookie = cookies.find((row) => row.startsWith("jwt="));
        callToken = jwtCookie ? jwtCookie.split("=")[1] : null;
        console.log("Token from cookies for incoming call:", callToken ? "Found" : "Not found");
      }
      
      if (!callToken) {
        callToken = localStorage.getItem("token");
        console.log("Token from localStorage for incoming call:", callToken ? "Found" : "Not found");
      }

      if (!callToken) {
        throw new Error("Authentication token not found");
      }

      set({
        isCallIncoming: true,
        callSessionId,
        caller: from,
      });

      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      stream.getTracks().forEach(track => {
        peer.addTrack(track, stream);
      });

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("New ICE candidate (incoming call):", event.candidate);
          
          // Create a properly formatted ICE candidate
          const iceCandidate = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          };
          
          console.log("Sending ICE candidate:", iceCandidate);
          
          socket.emit("ice-candidate", {
            candidate: iceCandidate,
            to: from,
            from: authUser._id,
            callSessionId
          });
        }
      };

      peer.ontrack = (event) => {
        console.log("Received remote track (incoming call):", event.streams[0]);
        set({ remoteStream: event.streams[0] });
      };

      peer.onconnectionstatechange = () => {
        console.log("Connection state changed (incoming call):", peer.connectionState);
        if (peer.connectionState === "disconnected" || peer.connectionState === "failed") {
          console.log("Connection lost, ending call");
          get().endCall();
        }
      };

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("call-answer", {
          answer,
          to: from,
          callSessionId,
        });

        set({
          isCallActive: true,
          isCallIncoming: false,
          peerConnection: peer,
          localStream: stream,
          receiver: authUser._id,
        });

        return callSessionId;
      } catch (error) {
        console.error("Error handling incoming call:", error);
        toast.error("Failed to handle incoming call");
        throw error;
      }
    } catch (error) {
      console.error("Error handling incoming call:", error);
      toast.error("Failed to handle incoming call");
      throw error;
    }
  },

  handleCallAnswer: async (answer, from, callSessionId) => {
    try {
      console.log("Handling call answer from:", from, "with session ID:", callSessionId);
      console.log("Raw answer data:", answer);
      
      const { peerConnection, callSessionId: currentCallSessionId } = get();
      
      if (!peerConnection) {
        console.error("No active peer connection");
        toast.error("No active peer connection");
        return false;
      }
      
      // Verify this answer is for the current call
      if (callSessionId && currentCallSessionId && callSessionId !== currentCallSessionId) {
        console.warn("Received answer for a different call session:", callSessionId, "current:", currentCallSessionId);
        return false;
      }
      
      // Check if peer connection is in a valid state
      if (peerConnection.signalingState === "closed") {
        console.error("Peer connection is closed");
        toast.error("Call connection is closed");
        return false;
      }
      
      // Validate answer data
      if (!answer) {
        console.error("No answer data received");
        toast.error("No answer data received");
        return false;
      }
      
      // Handle different answer data formats
      let answerData;
      
      if (typeof answer === 'object') {
        // If answer is already an object, check if it has the required properties
        if (answer.sdp && answer.type) {
          answerData = answer;
        } else if (answer.answer && answer.answer.sdp && answer.answer.type) {
          // Some implementations nest the answer in an 'answer' property
          answerData = answer.answer;
        } else if (answer.signalData && answer.signalData.sdp && answer.signalData.type) {
          // Some implementations use signalData property
          answerData = answer.signalData;
        } else {
          console.error("Answer object missing required properties:", answer);
          toast.error("Answer is missing required data");
          return false;
        }
      } else if (typeof answer === 'string') {
        // If answer is a string, try to parse it as JSON
        try {
          const parsedAnswer = JSON.parse(answer);
          if (parsedAnswer.sdp && parsedAnswer.type) {
            answerData = parsedAnswer;
          } else if (parsedAnswer.answer && parsedAnswer.answer.sdp && parsedAnswer.answer.type) {
            answerData = parsedAnswer.answer;
          } else if (parsedAnswer.signalData && parsedAnswer.signalData.sdp && parsedAnswer.signalData.type) {
            answerData = parsedAnswer.signalData;
          } else {
            console.error("Parsed answer missing required properties:", parsedAnswer);
            toast.error("Answer is missing required data");
            return false;
          }
        } catch (parseError) {
          console.error("Failed to parse answer string:", parseError);
          toast.error("Invalid answer format");
          return false;
        }
      } else {
        console.error("Invalid answer data type:", typeof answer);
        toast.error("Invalid answer format");
        return false;
      }
      
      console.log("Using answer data:", answerData);
      
      try {
        // Check if we can set remote description
        if (peerConnection.signalingState !== "have-local-offer") {
          console.error("Peer connection not in correct state for setting remote description");
          toast.error("Call connection is in an invalid state");
          return false;
        }
        
        console.log("Setting remote description with answer");
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answerData));
        console.log("Remote description set successfully");
        
        // Check connection state after setting remote description
        console.log("Connection state after setting remote description:", peerConnection.connectionState);
        
        // Add a connection state change handler if it doesn't exist
        if (!peerConnection.onconnectionstatechange) {
          peerConnection.onconnectionstatechange = () => {
            console.log("Connection state changed after answer:", peerConnection.connectionState);
            if (peerConnection.connectionState === "connected") {
              console.log("Connection established successfully");
              toast.success("Call connected successfully");
            } else if (peerConnection.connectionState === "disconnected" || peerConnection.connectionState === "failed") {
              console.log("Connection lost, ending call");
              get().endCall();
            }
          };
        }
        
        // Make sure we have an ontrack handler
        if (!peerConnection.ontrack) {
          peerConnection.ontrack = (event) => {
            console.log("Received remote track (caller side):", event.streams[0]);
            console.log("Remote track details:", {
              id: event.streams[0]?.id,
              active: event.streams[0]?.active,
              tracks: event.streams[0]?.getTracks().map(track => ({
                kind: track.kind,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState
              }))
            });
            
            // Make sure we're setting the remote stream correctly
            if (event.streams && event.streams[0]) {
              console.log("Setting remote stream from track event (caller side)");
              set({ remoteStream: event.streams[0] });
            } else {
              console.warn("No streams in track event (caller side)");
            }
          };
        }
        
        // Set active call start time
        set({ activeCallStartTime: Date.now() });
        
        return true;
      } catch (descError) {
        console.error("Error setting remote description:", descError);
        toast.error("Failed to set remote description: " + descError.message);
        return false;
      }
    } catch (error) {
      console.error("Error handling call answer:", error);
      toast.error("Failed to handle call answer: " + error.message);
      return false;
    }
  },

  storeEarlyIceCandidate: (candidate, from) => {
    try {
      console.log("Storing early ICE candidate from:", from);
      console.log("Candidate data:", candidate);
      
      const { earlyIceCandidates } = get();
      
      // Create a properly formatted ICE candidate
      const iceCandidate = {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid || null,
        sdpMLineIndex: candidate.sdpMLineIndex !== undefined ? candidate.sdpMLineIndex : null
      };
      
      // Store the candidate with the sender's ID
      set((state) => ({
        ...state,
        earlyIceCandidates: {
          ...state.earlyIceCandidates,
          [from]: [...(state.earlyIceCandidates[from] || []), iceCandidate]
        }
      }));
      
      console.log("Stored early ICE candidate for:", from);
      console.log("Current early ICE candidates:", get().earlyIceCandidates);
      
      return true;
    } catch (error) {
      console.error("Error storing early ICE candidate:", error);
      return false;
    }
  },

  applyStoredIceCandidates: async (from) => {
    try {
      console.log("Applying stored ICE candidates for:", from);
      
      const { peerConnection, earlyIceCandidates } = get();
      
      if (!peerConnection) {
        console.warn("No peer connection available to apply stored ICE candidates");
        return false;
      }
      
      const candidates = earlyIceCandidates[from] || [];
      console.log("Found stored ICE candidates:", candidates);
      
      if (candidates.length === 0) {
        console.log("No stored ICE candidates to apply");
        return true;
      }
      
      for (const candidate of candidates) {
        try {
          console.log("Applying stored ICE candidate:", candidate);
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("Successfully applied stored ICE candidate");
        } catch (error) {
          console.error("Error applying stored ICE candidate:", error);
        }
      }
      
      // Clear the stored candidates for this user
      set((state) => {
        const newEarlyIceCandidates = { ...state.earlyIceCandidates };
        delete newEarlyIceCandidates[from];
        return {
          ...state,
          earlyIceCandidates: newEarlyIceCandidates
        };
      });
      
      console.log("Cleared stored ICE candidates for:", from);
      return true;
    } catch (error) {
      console.error("Error applying stored ICE candidates:", error);
      return false;
    }
  },

  handleIceCandidate: async (candidate, from, callSessionId) => {
    try {
      console.log("Handling ICE candidate from:", from, "with session ID:", callSessionId);
      console.log("Candidate data:", candidate);
      
      const { peerConnection, callSessionId: currentCallSessionId, incomingCall, earlyIceCandidates } = get();
      
      // If we don't have a peer connection, try to create one if we have an incoming call
      if (!peerConnection && incomingCall && incomingCall.from === from) {
        console.log("No peer connection but have incoming call, creating one");
        
        // Create a new peer connection
        const newPeerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });
        
        // Set up event handlers
        newPeerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("New ICE candidate (incoming call):", event.candidate);
            
            // Create a properly formatted ICE candidate
            const iceCandidate = {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex
            };
            
            console.log("Sending ICE candidate:", iceCandidate);
            
            // Get the socket from the auth store
            const { socket, authUser } = useAuthStore.getState();
            
            if (socket && authUser) {
              socket.emit("ice-candidate", {
                candidate: iceCandidate,
                to: from,
                from: authUser._id,
                callSessionId: incomingCall.callSessionId
              });
            }
          }
        };
        
        // Set up ontrack handler
        newPeerConnection.ontrack = (event) => {
          console.log("Received remote track (incoming call):", event.streams[0]);
          console.log("Remote track details:", {
            id: event.streams[0]?.id,
            active: event.streams[0]?.active,
            tracks: event.streams[0]?.getTracks().map(track => ({
              kind: track.kind,
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState
            }))
          });
          
          // Make sure we're setting the remote stream correctly
          if (event.streams && event.streams[0]) {
            console.log("Setting remote stream from track event (incoming call)");
            set({ remoteStream: event.streams[0] });
          } else {
            console.warn("No streams in track event (incoming call)");
          }
        };
        
        // Update the store state
        set((state) => ({
          ...state,
          peerConnection: newPeerConnection,
          callSessionId: incomingCall.callSessionId
        }));
        
        // Use the new peer connection
        const effectivePeerConnection = newPeerConnection;
        console.log("Created new peer connection for incoming call");
        
        // Validate candidate data
        if (!candidate || typeof candidate !== 'object') {
          console.error("Invalid ICE candidate data:", candidate);
          return false;
        }
        
        // Check if candidate has the required properties
        if (!candidate.candidate) {
          console.error("ICE candidate missing required properties:", candidate);
          return false;
        }
        
        // Create a properly formatted ICE candidate
        const iceCandidate = {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid || null,
          sdpMLineIndex: candidate.sdpMLineIndex !== undefined ? candidate.sdpMLineIndex : null
        };
        
        console.log("Adding ICE candidate to new peer connection:", iceCandidate);
        
        try {
          // Only add the candidate if it's not null
          if (iceCandidate.candidate) {
            await effectivePeerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
            console.log("ICE candidate added successfully to new peer connection");
          } else {
            console.log("Skipping null ICE candidate");
          }
          return true;
        } catch (iceError) {
          console.error("Error adding ICE candidate to new peer connection:", iceError);
          return false;
        }
      }
      
      // If we still don't have a peer connection, store the candidate for later
      if (!peerConnection) {
        console.log("No active peer connection, storing ICE candidate for later");
        get().storeEarlyIceCandidate(candidate, from);
        return true;
      }
      
      // If callSessionId is missing, try to use the current call session ID
      const effectiveCallSessionId = callSessionId || currentCallSessionId;
      
      // Verify this candidate is for the current call
      if (effectiveCallSessionId && currentCallSessionId && effectiveCallSessionId !== currentCallSessionId) {
        console.warn("Received ICE candidate for a different call session:", effectiveCallSessionId, "current:", currentCallSessionId);
        return false;
      }
      
      // Validate candidate data
      if (!candidate || typeof candidate !== 'object') {
        console.error("Invalid ICE candidate data:", candidate);
        return false;
      }
      
      // Check if candidate has the required properties
      if (!candidate.candidate) {
        console.error("ICE candidate missing required properties:", candidate);
        return false;
      }
      
      // Create a properly formatted ICE candidate
      const iceCandidate = {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid || null,
        sdpMLineIndex: candidate.sdpMLineIndex !== undefined ? candidate.sdpMLineIndex : null
      };
      
      console.log("Adding ICE candidate:", iceCandidate);
      
      try {
        // Only add the candidate if it's not null
        if (iceCandidate.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
          console.log("ICE candidate added successfully");
        } else {
          console.log("Skipping null ICE candidate");
        }
        return true;
      } catch (iceError) {
        console.error("Error adding ICE candidate:", iceError);
        return false;
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
      return false;
    }
  },

  endCall: async () => {
    try {
      const { callSessionId, caller, receiver, localStream, remoteStream, peerConnection } = get();
      const { socket, token } = useAuthStore.getState();

      if (!callSessionId) {
        console.log("No active call to end");
        return;
      }

      let callToken = token;
      if (!callToken) {
        const cookies = document.cookie.split("; ");
        const jwtCookie = cookies.find((row) => row.startsWith("jwt="));
        callToken = jwtCookie ? jwtCookie.split("=")[1] : null;
        console.log("Token from cookies for ending call:", callToken ? "Found" : "Not found");
      }
      
      if (!callToken) {
        callToken = localStorage.getItem("token");
        console.log("Token from localStorage for ending call:", callToken ? "Found" : "Not found");
      }

      // First update local state to prevent new calls from being blocked
      set({
        isCallActive: false,
        isCallIncoming: false,
        callSessionId: null,
        peerConnection: null,
        localStream: null,
        remoteStream: null,
        caller: null,
        receiver: null,
      });

      // Close the peer connection and remove all tracks
      if (peerConnection) {
        // Remove all tracks from the peer connection
        const senders = peerConnection.getSenders();
        senders.forEach(sender => {
          if (sender.track) {
            sender.track.stop();
          }
        });
        peerConnection.close();
      }

      // Stop all tracks in the local stream
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }

      // Stop all tracks in the remote stream
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }

      // Then notify the backend
      if (socket) {
        console.log("Emitting end-call event to socket");
        socket.emit("end-call", {
          callSessionId,
          from: caller || receiver,
        });
      }

      // Call the API to end the call and update call logs
      if (callToken) {
        try {
          console.log("Calling API to end call with session ID:", callSessionId);
          await axiosInstance.post("/calls/end", {
            callSessionId,
            from: caller || receiver
          });
          console.log("Call ended successfully via API");
        } catch (apiError) {
          console.error("API error ending call:", apiError);
          // Don't throw the error, just log it since the call is already ended locally
        }
      }

      console.log("Call ended successfully");
    } catch (error) {
      console.error("Error ending call:", error);
      toast.error("Failed to end call");
    }
  },

  setIncomingCallsQueue: (updater) => {
    const currentQueue = get().incomingCallsQueue;
    const newQueue = typeof updater === 'function' ? updater({ incomingCallsQueue: currentQueue }).incomingCallsQueue : updater;
    
    // Play notification sound for new queued calls
    if (newQueue.length > currentQueue.length) {
      const notificationSound = new Audio('/notification.mp3');
      notificationSound.play().catch(err => console.error('Error playing notification sound:', err));
    }
    
    set({ incomingCallsQueue: newQueue });
  },
  
  switchToQueuedCall: async (queuedCall) => {
    try {
      const { isCallActive, peerConnection, localStream, callSessionId: currentCallSessionId } = get();
      const { socket, authUser } = useAuthStore.getState();
      
      if (isCallActive && peerConnection) {
        console.log("Ending current call before switching");
        
        // Notify the other party that we're ending the call
        if (socket) {
          socket.emit("end-call", {
            callSessionId: currentCallSessionId,
            from: authUser._id,
            reason: "Switching to another call"
          });
        }
        
        // Close the peer connection
        peerConnection.close();
        
        // Stop all tracks in the local stream
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        
        // Reset call state
        set({
          isCallActive: false,
          peerConnection: null,
          localStream: null,
          remoteStream: null,
          callSessionId: null,
          caller: null,
          receiver: null
        });
        
        // Small delay to ensure cleanup is complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log("Switching to queued call:", queuedCall);
      
      // Accept the queued call
      const success = await get().acceptCall(
        queuedCall.offer,
        queuedCall.from,
        queuedCall.callSessionId
      );
      
      if (success) {
        console.log("Successfully switched to queued call");
        
        // Remove from queue
        get().removeIncomingCall(queuedCall.callSessionId);
        
        // Set call start time
        set({ activeCallStartTime: Date.now() });
        
        // Update the queue wait times for remaining calls
        const remainingCalls = get().incomingCallsQueue;
        if (remainingCalls.length > 0) {
          toast.info(`${remainingCalls.length} call${remainingCalls.length > 1 ? 's' : ''} remaining in queue`);
        }
        
        return true;
      }
      
      console.error("Failed to switch to queued call");
      return false;
    } catch (error) {
      console.error('Error switching to queued call:', error);
      toast.error('Failed to switch to queued call: ' + error.message);
      return false;
    }
  },
  
  getCallDuration: () => {
    const { activeCallStartTime } = get();
    if (!activeCallStartTime) return 0;
    return Math.floor((Date.now() - activeCallStartTime) / 1000);
  },
  
  getQueuedCallWaitTime: (callSessionId) => {
    const { incomingCallsQueue } = get();
    const callIndex = incomingCallsQueue.findIndex(call => call.callSessionId === callSessionId);
    if (callIndex === -1) return 0;
    return callIndex * 30; // Estimate 30 seconds per call in queue
  },
}));


