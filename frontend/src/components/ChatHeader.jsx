import { X, Phone, Video } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useNavigate } from "react-router-dom";
import { useCallStore } from "../store/useCallStore";
import toast from "react-hot-toast";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers, authUser, socket, socketConnected, token } = useAuthStore();
  const { startCall } = useCallStore();
  const navigate = useNavigate();

  const handleCall = async () => {
    try {
      console.log("Initiating call to user:", selectedUser);
      
      // Check if user is authenticated
      if (!authUser) {
        console.error("User not authenticated");
        toast.error("You must be logged in to make calls");
        return;
      }
      
      // Check if socket is connected
      if (!socket || !socket.connected) {
        console.error("Socket not connected:", { socket: !!socket, connected: socket?.connected });
        toast.error("Connection error. Please refresh the page and try again");
        return;
      }
      
      // Check if selected user is valid
      if (!selectedUser || !selectedUser._id) {
        console.error("Invalid selected user:", selectedUser);
        toast.error("Invalid user selected");
        return;
      }
      
      console.log("Call prerequisites met:", {
        authUser: authUser._id,
        selectedUser: selectedUser._id,
      from: authUser._id,
        socketId: socket.id,
        token: "Present"
      });
      
      // Start the call using the call store
      console.log("Starting call...");
      const callSessionId = await startCall(selectedUser._id);
      console.log("Call started successfully, session ID:", callSessionId);
      
      if (!callSessionId) {
        console.error("No call session ID returned");
        throw new Error("Failed to get call session ID");
      }
      
      // Navigate to the call page with the correct format
      const callUrl = `/call/${callSessionId}`;
      console.log("Navigating to:", callUrl);
      navigate(callUrl);
    } catch (error) {
      console.error("Error in handleCall:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      
      let errorMessage = "Failed to start call";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img
                src={selectedUser.profilePic || "/avatar.png"}
                alt={selectedUser.fullName}
              />
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        {/* Actions: Call & Close */}
        <div className="flex items-center gap-2">
          {/* Call Button */}
          {onlineUsers.includes(selectedUser._id) && (
            <button
              onClick={handleCall}
              className="text-primary hover:text-primary-focus"
              disabled={!socketConnected || !authUser || !token}
              title={
                !socketConnected
                  ? "Waiting for connection..."
                  : !authUser || !token
                  ? "Please log in to make calls"
                  : "Start call"
              }
            >
              <Video size={25} />
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={() => setSelectedUser(null)}
            className="text-base-content/70 hover:text-base-content" style={{ paddingLeft: '1rem' }}
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
