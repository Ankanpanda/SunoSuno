import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import GroupChatContainer from "../components/GroupChatContainer";

const HomePage = () => {
  const { selectedUser } = useChatStore();
  const { selectedGroup } = useGroupStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderChatContainer = () => {
    if (selectedUser) return <ChatContainer />;
    if (selectedGroup) return <GroupChatContainer />;
    return <NoChatSelected />;
  };

  return (
    <div className="h-screen">
      <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} />
      <div className="flex items-center justify-center pt-20 px-4" style={{ paddingTop: '5rem' }} >
        <div className="bg-base-100 rounded-lg shadow-lg w-full max-w-6xl h-[calc(100vh-8rem)]">
          <div className="flex h-full rounded-lg overflow-hidden relative">
            {isMobileMenuOpen && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-10 md:bg-opacity-0 md:pointer-events-none"
                onClick={() => setIsMobileMenuOpen(false)}
              />
            )}
            <Sidebar
              isMobileMenuOpen={isMobileMenuOpen}
              onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
            />
            {renderChatContainer()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;