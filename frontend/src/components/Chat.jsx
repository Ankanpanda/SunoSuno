import { useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import VideoCall from './VideoCall';
import { Video } from 'lucide-react';

const Chat = () => {
  const { selectedUser } = useChatStore();
  const [showVideoCall, setShowVideoCall] = useState(false);

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Select a user to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="w-10 h-10 rounded-full">
              <img src={selectedUser.profilePic} alt={selectedUser.fullName} />
            </div>
          </div>
          <div>
            <h3 className="font-semibold">{selectedUser.fullName}</h3>
            <p className="text-sm text-gray-500">Online</p>
          </div>
        </div>
        <button
          onClick={() => setShowVideoCall(true)}
          className="btn btn-circle btn-sm"
          title="Start video call"
        >
          <Video size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <MessageList />
      </div>

      <MessageInput />

      {showVideoCall && (
        <VideoCall
          targetUserId={selectedUser._id}
          onClose={() => setShowVideoCall(false)}
        />
      )}
    </div>
  );
};

export default Chat; 