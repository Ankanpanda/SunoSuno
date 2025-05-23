import Navbar from "./components/Navbar";

import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import CallPage from "./pages/CallPage"; 
import GroupProfileUpdate from "./components/GroupProfileUpdate";


import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useThemeStore } from "./store/useThemeStore";
import { useCallStore } from "./store/useCallStore";
import { useEffect } from "react";

import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, socket, socketConnected } = useAuthStore();
  const { theme } = useThemeStore();
  const { 
    incomingCall, 
    setIncomingCall, 
    acceptCall, 
    rejectCall, 
    isCallActive, 
    handleCallAnswer, 
    getIncomingCalls,
    handleIceCandidate 
  } = useCallStore();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    let isInitialized = false;
    let retryCount = 0;
    const maxRetries = 5;

    const initializeSocket = () => {
      if (isInitialized) return;

      const { socket, socketConnected } = useAuthStore.getState();
      
      if (!socket) {
        console.log("Socket not available yet, waiting...");
        return;
      }

      if (!socketConnected) {
        console.log("Socket not connected yet, waiting...");
        return;
      }

      console.log("Setting up socket listeners in App.jsx");
      console.log("Socket connected:", socket.connected);
      console.log("Socket ID:", socket.id);

      // Set up socket event handlers
      socket.on("connect", () => {
        console.log("Socket connected successfully");
        console.log("Socket ID:", socket.id);
        
        // Emit user online event
        console.log("Emitting user-online event from App.jsx:", { userId: authUser._id, socketId: socket.id });
        socket.emit("user-online", {
          userId: authUser._id,
          socketId: socket.id
        });
      });
      
      socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        
        // Emit user offline event
        console.log("Emitting user-offline event from App.jsx:", { userId: authUser._id, socketId: socket.id });
        socket.emit("user-offline", {
          userId: authUser._id,
          socketId: socket.id
        });
      });
      
      socket.on("online-users", (users) => {
        console.log("Online users updated in App.jsx:", users);
        useAuthStore.getState().setOnlineUsers(users);
      });

      // Handle incoming call
      socket.on("call-offer", async ({ offer, from, callSessionId }) => {
        console.log("Received incoming call from:", from);
        console.log("Call session ID:", callSessionId);
        console.log("Offer data:", offer);
        
        // Log current call state
        console.log("Current call state:", {
          isCallActive: useCallStore.getState().isCallActive,
          incomingCall: useCallStore.getState().incomingCall,
          incomingCallsQueue: useCallStore.getState().incomingCallsQueue
        });
        
        // If we're already in a call, add this to the queue
        if (useCallStore.getState().isCallActive) {
          console.log("Already in a call, adding to queue");
          useCallStore.getState().setIncomingCallsQueue((state) => ({
            incomingCallsQueue: [
              ...state.incomingCallsQueue,
              { offer, from, callSessionId }
            ]
          }));
          return;
        }
        
        // Set the incoming call
        console.log("Setting incoming call");
        const success = useCallStore.getState().setIncomingCall({ offer, from, callSessionId });
        
        if (!success) {
          console.error("Failed to set incoming call");
          return;
        }
        
        // Log the new call state
        console.log("New call state:", {
          isCallActive: useCallStore.getState().isCallActive,
          incomingCall: useCallStore.getState().incomingCall,
          incomingCallsQueue: useCallStore.getState().incomingCallsQueue
        });
      });

      // Also handle the call-user event for backward compatibility
      socket.on("call-user", async ({ offer, from, callSessionId }) => {
        console.log("Received call-user event from:", from);
        console.log("Call session ID:", callSessionId);
        console.log("Offer data:", offer);
        
        // Forward to the call-offer handler
        socket.emit("call-offer", { offer, from, callSessionId });
      });

      // Listen for call answers
      socket.on("call-answer", ({ answer, from, callSessionId }) => {
        console.log("Call answer received from:", from, "with session ID:", callSessionId);
        console.log("Answer data:", answer);
        
        // If we're the caller, handle the answer
        if (isCallActive) {
          console.log("Handling call answer as caller");
          
          // Validate the answer data
          if (!answer) {
            console.error("No answer data received");
            toast.error("No answer data received");
            return;
          }
          
          // Handle the answer
          handleCallAnswer(answer, from, callSessionId);
        } else {
          console.log("Not in an active call, ignoring answer");
        }
      });

      // Listen for ICE candidates
      socket.on("ice-candidate", async ({ candidate, from, callSessionId }) => {
        console.log("Received ICE candidate from:", from, "with session ID:", callSessionId);
        console.log("Candidate data:", candidate);
        
        // Get the current call state
        const { isCallActive, callSessionId: currentCallSessionId, incomingCall } = useCallStore.getState();
        
        // If we have a callSessionId, use it
        // If not, try to use the current call session ID
        // If we have an incoming call, use its session ID
        const effectiveCallSessionId = callSessionId || currentCallSessionId || (incomingCall ? incomingCall.callSessionId : null);
        
        // If we have a from ID but no call session ID, try to find a matching call
        if (from && !effectiveCallSessionId) {
          console.log("Have from ID but no call session ID, checking for matching call");
          
          // Check if we have an incoming call from this user
          if (incomingCall && incomingCall.from === from) {
            console.log("Found matching incoming call, using its session ID");
            const matchedCallSessionId = incomingCall.callSessionId;
            
            // If we're not in an active call yet, we should still process this ICE candidate
            // as it might be part of establishing the call
            if (!isCallActive) {
              console.log("Not in active call yet, but processing ICE candidate for incoming call");
              try {
                await handleIceCandidate(candidate, from, matchedCallSessionId);
                return;
              } catch (error) {
                console.error("Error handling ICE candidate for incoming call:", error);
              }
            }
          }
          
          // If we don't have a matching incoming call, store the ICE candidate for later
          console.log("No matching incoming call, storing ICE candidate for later");
          useCallStore.getState().storeEarlyIceCandidate(candidate, from);
          return;
        }
        
        // If we're not in an active call and don't have a matching incoming call, store the ICE candidate for later
        if (!isCallActive && !effectiveCallSessionId) {
          console.log("No active call and no matching incoming call, storing ICE candidate for later");
          useCallStore.getState().storeEarlyIceCandidate(candidate, from);
          return;
        }
        
        try {
          await handleIceCandidate(candidate, from, effectiveCallSessionId);
        } catch (error) {
          console.error("Error handling ICE candidate:", error);
        }
      });

      // Listen for call end
      socket.on("end-call", ({ from }) => {
        console.log("Call ended by:", from);
        setIncomingCall(null);
      });

      // Listen for call rejected
      socket.on("call-rejected", ({ from }) => {
        console.log("Call rejected by:", from);
        toast.error("Call was rejected");
        setIncomingCall(null);
      });

      isInitialized = true;
      console.log("Socket listeners initialized successfully");
    };

    // Try to initialize immediately
    initializeSocket();

    // Set up a retry mechanism
    const retryInterval = setInterval(() => {
      if (!isInitialized && retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying socket initialization (${retryCount}/${maxRetries})...`);
        initializeSocket();
      } else if (retryCount >= maxRetries) {
        console.log("Max retries reached, stopping socket initialization attempts");
        clearInterval(retryInterval);
      }
    }, 2000);

    return () => {
      clearInterval(retryInterval);
      const { socket, socketConnected } = useAuthStore.getState();
      if (socket && socketConnected) {
        console.log("Cleaning up socket listeners in App.jsx");
        socket.off("call-user");
        socket.off("call-answer");
        socket.off("ice-candidate");
        socket.off("end-call");
        socket.off("call-rejected");
        socket.off("call-failed");
      }
    };
  }, [authUser, setIncomingCall, isCallActive]);

  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;

    return () => {
      if (socket) {
        socket.off("call-failed");
      }
    };
  }, [socket, setIncomingCall]);

  // Handle call failed event
  useEffect(() => {
    if (!socket) return;

    const handleCallFailed = (data) => {
      console.log("Call failed event received:", data);
      
      if (data.reason === "busy") {
        toast.error("User is busy on another call");
      } else {
        toast.error(data.message || "Call failed");
      }
      
      // Reset incoming call state
      setIncomingCall(null);
    };

    socket.on("call-failed", handleCallFailed);

    return () => {
      socket.off("call-failed", handleCallFailed);
    };
  }, [socket]);

  // Handle call ended event
  useEffect(() => {
    const handleCallEnded = (data) => {
      console.log("Call ended event received:", data);
      setIncomingCall(null);
    };

    const handleCallEndedConfirmation = (data) => {
      console.log("Call ended confirmation received:", data);
      // Force update the call store state to ensure UI reflects the call has ended
      useCallStore.getState().endCall();
    };

    socket?.on("call-ended", handleCallEnded);
    socket?.on("call-ended-confirmation", handleCallEndedConfirmation);

    return () => {
      socket?.off("call-ended", handleCallEnded);
      socket?.off("call-ended-confirmation", handleCallEndedConfirmation);
    };
  }, [socket]);

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <Toaster position="top-center" />
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={isCheckingAuth ? <LoadingScreen /> : authUser ? <HomePage /> : <Navigate to="/login" />} />
          <Route path="/login" element={isCheckingAuth ? <LoadingScreen /> : authUser ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/signup" element={isCheckingAuth ? <LoadingScreen /> : authUser ? <Navigate to="/" /> : <SignUpPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={isCheckingAuth ? <LoadingScreen /> : authUser ? <Navigate to={`/profile/${authUser._id}`} /> : <Navigate to="/login" />} />
          <Route path="/profile/:userId" element={isCheckingAuth ? <LoadingScreen /> : authUser ? <ProfilePage /> : <Navigate to="/login" />} />
          <Route path="/call/:callId" element={isCheckingAuth ? <LoadingScreen /> : authUser ? <CallPage /> : <Navigate to="/login" />} />
          <Route path="/group/:groupId/profile" element={isCheckingAuth ? <LoadingScreen /> : authUser ? <GroupProfileUpdate /> : <Navigate to="/login" />} />
        </Routes>
      </div>

      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Incoming Call</h2>
            
            {/* Display current incoming call */}
            <div className="mb-4 p-4 border rounded-lg">
              <p className="font-semibold">Call from: {incomingCall.callerName || incomingCall.from}</p>
              {isCallActive && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Current call duration: {Math.floor(useCallStore.getState().getCallDuration() / 60)}:{(useCallStore.getState().getCallDuration() % 60).toString().padStart(2, '0')}
                </p>
              )}
              <div className="flex justify-end space-x-2 mt-2">
              <button
                  onClick={async () => {
                    try {
                      console.log("Accepting call from:", incomingCall.from);
                      console.log("Call data:", incomingCall);
                      
                      // Validate the call data
                      if (!incomingCall.offer) {
                        console.error("No offer data available");
                        toast.error("Cannot accept call: Missing offer data");
                        return;
                      }
                      
                      const success = await acceptCall(
                        incomingCall.offer, 
                        incomingCall.from, 
                        incomingCall.callSessionId
                      );
                      
                      if (success) {
                        console.log("Call accepted successfully, navigating to call page");
                        navigate(`/call/${incomingCall.callSessionId}`);
                      } else {
                        console.error("Failed to accept call");
                        toast.error("Failed to accept call. Please try again.");
                      }
                    } catch (error) {
                      console.error("Error accepting call:", error);
                      toast.error("Error accepting call: " + error.message);
                    }
                  }}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Accept
              </button>
              <button
                  onClick={() => {
                    console.log("Rejecting call from:", incomingCall.from);
                    rejectCall(incomingCall.callSessionId);
                  }}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Decline
                </button>
              </div>
            </div>
            
            {/* Display queued incoming calls */}
            {getIncomingCalls().length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-4 mb-2">Queued Calls ({getIncomingCalls().length})</h3>
                {getIncomingCalls().map((call) => (
                  <div key={call.callSessionId} className="mb-4 p-4 border rounded-lg">
                    <p className="font-semibold">Call from: {call.from}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Estimated wait time: {Math.floor(useCallStore.getState().getQueuedCallWaitTime(call.callSessionId) / 60)}:{(useCallStore.getState().getQueuedCallWaitTime(call.callSessionId) % 60).toString().padStart(2, '0')}
                    </p>
                    <div className="flex justify-end space-x-2 mt-2">
                      <button
                        onClick={async () => {
                          try {
                            console.log("Switching to queued call from:", call.from);
                            const success = await useCallStore.getState().switchToQueuedCall(call);
                            if (success) {
                              navigate(`/call/${call.callSessionId}`);
                            }
                          } catch (error) {
                            console.error("Error switching to queued call:", error);
                            toast.error("Error switching to queued call: " + error.message);
                          }
                        }}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                      >
                        Switch to Call
                      </button>
                      <button
                        onClick={() => {
                          console.log("Rejecting queued call from:", call.from);
                          rejectCall(call.callSessionId);
                        }}
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Decline
              </button>
            </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
