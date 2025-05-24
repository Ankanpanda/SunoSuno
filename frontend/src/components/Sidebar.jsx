import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupStore } from "../store/useGroupStore";
import { Users, MessageSquare, Plus } from "lucide-react";
import CreateGroupModal from "./CreateGroupModal";

const Sidebar = ({ isMobileMenuOpen, onCloseMobileMenu }) => {
  const [showGroups, setShowGroups] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { users, getUsers, selectedUser, setSelectedUser, isUsersLoading } =
    useChatStore();
  const {
    groups,
    getGroups,
    selectedGroup,
    setSelectedGroup,
    isGroupsLoading,
  } = useGroupStore();
  const { authUser, onlineUsers } = useAuthStore();

  useEffect(() => {
    getUsers();
    getGroups();
  }, [getUsers, getGroups]);

  // Close sidebar when clicking outside (mobile only)
  useEffect(() => {
    if (!isMobileMenuOpen || window.innerWidth >= 768) return;
    const handleClick = (e) => {
      if (e.target.closest(".sidebar-panel")) return;
      onCloseMobileMenu();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMobileMenuOpen, onCloseMobileMenu]);

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setSelectedGroup(null);
    onCloseMobileMenu();
  };

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    setSelectedUser(null);
    onCloseMobileMenu();
  };

  return (
    <div
      className={`border-r border-base-300 w-full max-w-xs flex flex-col fixed md:static left-0 transform transition-transform duration-200 ease-in-out z-40 bg-base-100 sidebar-panel
        ${
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
        }
        ${isMobileMenuOpen ? "top-16" : "top-16"} md:top-0
      `}
      style={{ height: isMobileMenuOpen ? "calc(100vh - 4rem)" : undefined }}
    >
      {/* Header */}
      <div className="p-2.5 border-b border-base-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="avatar">
              <div className="size-10 rounded-full">
                <img
                  src={authUser.profilePic || "/avatar.png"}
                  alt={authUser.fullName}
                />
              </div>
            </div>

            <div>
              <h3 className="font-medium">{authUser.fullName}</h3>
              <p className="text-sm text-base-content/70">{authUser.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Type Selector */}
      <div className="flex border-b border-base-300">
        <button
          onClick={() => setShowGroups(false)}
          className={`flex-1 p-2 flex items-center justify-center gap-2 ${
            !showGroups ? "text-primary border-b-2 border-primary" : ""
          }`}
        >
          <MessageSquare size={20} />
          {/* <span>Direct</span> */}
        </button>
        <button
          onClick={() => setShowGroups(true)}
          className={`flex-1 p-2 flex items-center justify-center gap-2 ${
            showGroups ? "text-primary border-b-2 border-primary" : ""
          }`}
        >
          <Users size={20} />
          {/* <span>Groups</span> */}
        </button>
      </div>

      {/* Users/Groups list */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {showGroups ? (
          // Groups List
          <>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="w-full flex items-center gap-2 p-2 rounded-lg bg-primary text-primary-content hover:bg-primary-focus transition-colors"
            >
              <Plus size={20} />
              <span>Create Group</span>
            </button>

            {isGroupsLoading ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : (
              groups.map((group) => (
                <button
                  key={group._id}
                  onClick={() => handleGroupSelect(group)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 transition-colors ${
                    selectedGroup?._id === group._id ? "bg-base-200" : ""
                  }`}
                >
                  <div className="avatar">
                    <div className="size-10 rounded-full">
                      <img
                        src={group.groupImage || "/group.png"}
                        alt={group.name}
                      />
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-medium truncate">{group.name}</h3>
                    <p className="text-sm text-base-content/70 truncate">
                      {group.members.length} members
                    </p>
                  </div>
                </button>
              ))
            )}
          </>
        ) : (
          // Users List
          <>
            {isUsersLoading ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : (
              users.map((user) => (
                <button
                  key={user._id}
                  onClick={() => handleUserSelect(user)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 transition-colors ${
                    selectedUser?._id === user._id ? "bg-base-200" : ""
                  }`}
                >
                  <div className="avatar">
                    <div className="size-10 rounded-full relative">
                      <img
                        src={user.profilePic || "/avatar.png"}
                        alt={user.fullName}
                      />
                      {onlineUsers.includes(user._id) && (
                        <div className="absolute bottom-0 right-0 size-3 bg-success rounded-full border-2 border-base-100"></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-medium truncate">{user.fullName}</h3>
                    <p className="text-sm text-base-content/70">
                      {onlineUsers.includes(user._id) ? "Online" : "Offline"}
                    </p>
                    {/* <p className="text-sm text-base-content/70 truncate">
                      {user.email}
                    </p> */}
                  </div>
                </button>
              ))
            )}
          </>
        )}
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />
    </div>
  );
};

export default Sidebar;