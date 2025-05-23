import { useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { formatMessageTime } from "../lib/utils";
import GroupMessageInput from "./GroupMessageInput";

const GroupChatContainer = () => {
  const {
    groupMessages,
    getGroupMessages,
    isGroupMessagesLoading,
    selectedGroup,
    subscribeToGroupMessages,
    unsubscribeFromGroupMessages,
  } = useGroupStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  useEffect(() => {
    let isSubscribed = false;

    if (selectedGroup?._id) {
      getGroupMessages(selectedGroup._id);
      
      const socket = useAuthStore.getState().socket;
      if (socket && !isSubscribed) {
        socket.emit("join-group", selectedGroup._id);
        subscribeToGroupMessages();
        isSubscribed = true;
      }
      
      return () => {
        const socket = useAuthStore.getState().socket;
        if (socket) {
          socket.emit("leave-group", selectedGroup._id);
          unsubscribeFromGroupMessages();
          isSubscribed = false;
        }
      };
    }
  }, [selectedGroup?._id, getGroupMessages, subscribeToGroupMessages, unsubscribeFromGroupMessages]);

  useEffect(() => {
    if (messageEndRef.current && groupMessages.length > 0) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [groupMessages]);

  if (isGroupMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <GroupChatHeader />
        <MessageSkeleton />
        <MessageInput isGroupChat={true} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <GroupChatHeader />

      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4">
        {groupMessages.map((message, index) => (
          <div
            key={`${message._id}-${index}`}
            className={`chat ${message.senderId._id === authUser._id ? "chat-end" : "chat-start"}`}
            ref={index === groupMessages.length - 1 ? messageEndRef : null}
          >
            <div className="chat-image avatar">
              <div className="size-8 sm:size-10 rounded-full border border-base-300">
                <img
                  src={message.senderId.profilePic || "/avatar.png"}
                  alt="profile pic"
                />
              </div>
            </div>
            <div className="chat-header mb-1">
              <span className="font-bold mr-2 text-sm sm:text-base">{message.senderId.fullName}</span>
              <time className="text-[10px] sm:text-xs text-base-content/50">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>
            <div className={`chat-bubble flex flex-col no-select ${message.senderId._id === authUser._id ? "bg-primary text-primary-content" : "bg-base-200 text-primary"}`}>
              {message.image && (
                <img
                  src={message.image}
                  alt="Attachment"
                  className="max-w-[150px] sm:max-w-[200px] rounded-md mb-2"
                />
              )}
              {message.text && <p className="text-sm sm:text-base">{message.text}</p>}
            </div>
          </div>
        ))}
      </div>

      <GroupMessageInput />
    </div>
  );
};

const GroupChatHeader = () => {
  const { selectedGroup } = useGroupStore();
  const { authUser } = useAuthStore();
  const { leaveGroup } = useGroupStore();
  const navigate = useNavigate();

  const handleLeaveGroup = async () => {
    if (confirm("Are you sure you want to leave this group?")) {
      await leaveGroup(selectedGroup._id);
    }
  };

  const handleProfileClick = () => {
    navigate(`/group/${selectedGroup._id}/profile`);
  };

  return (
    <div className="p-2 sm:p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={handleProfileClick}
            className="avatar hover:opacity-80 transition-opacity"
          >
            <div className="size-8 sm:size-10 rounded-full relative">
              <img
                src={selectedGroup.groupImage || "/group-avatar.png"}
                alt={selectedGroup.name}
              />
            </div>
          </button>

          <div>
            <h3 className="font-medium text-sm sm:text-base">{selectedGroup.name}</h3>
            <p className="text-xs sm:text-sm text-base-content/70">
              {selectedGroup.members.length} members
            </p>
          </div>
        </div>
        <button 
          onClick={handleLeaveGroup}
          className="btn btn-ghost btn-xs sm:btn-sm text-error"
        >
          Leave Group
        </button>
      </div>
    </div>
  );
};

export default GroupChatContainer;