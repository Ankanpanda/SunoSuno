import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import CryptoJS from "crypto-js";

export const useGroupStore = create((set, get) => ({
  groups: [],
  selectedGroup: null,
  groupMessages: [],
  isGroupsLoading: false,
  isGroupMessagesLoading: false,

  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      // Check if we have a valid token
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const res = await axiosInstance.get("/groups/user-groups");
      if (res.data) {
        set({ groups: res.data });
      } else {
        throw new Error("No data received from server");
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
      if (error.response?.status === 401) {
        toast.error("Please login to view groups");
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to fetch groups");
      }
      set({ groups: [] }); // Reset groups on error
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  createGroup: async (groupData) => {
    try {
      // Validate group data
      if (!groupData.name || !groupData.members || groupData.members.length === 0) {
        throw new Error("Group name and at least one member are required");
      }

      // Check authentication
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const res = await axiosInstance.post("/groups/create", groupData);
      if (res.data) {
        // Refresh the groups list after creating a new group
        await get().getGroups();
        toast.success("Group created successfully");
        return res.data;
      } else {
        throw new Error("No response data from server");
      }
    } catch (error) {
      console.error("Error creating group:", error);
      if (error.response?.status === 401) {
        toast.error("Please login to create a group");
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to create group");
      }
      throw error;
    }
  },

  getGroupMessages: async (groupId) => {
    set({ isGroupMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/groups/messages/${groupId}`);
      
      // Decrypt messages if needed (though backend should already decrypt them)
      const SECRET_KEY = "test123"; // Ensure this matches the server-side key
      const decryptedMessages = res.data.map(message => {
        if (message.text) {
          try {
            // Check if the text is already decrypted (not in encrypted format)
            // Encrypted text typically contains special characters and is longer
            if (message.text.includes("U2F") || message.text.includes("U2Fs")) {
              const bytes = CryptoJS.AES.decrypt(message.text, SECRET_KEY);
              message.text = bytes.toString(CryptoJS.enc.Utf8);
            }
            // If not encrypted, leave as is
          } catch (error) {
            console.error("Decryption error for message:", message._id, error.message);
            // Don't modify the text if decryption fails
          }
        }
        return message;
      });
      
      set({ groupMessages: decryptedMessages });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch messages");
    } finally {
      set({ isGroupMessagesLoading: false });
    }
  },

  sendGroupMessage: async (messageData) => {
    const { selectedGroup, groupMessages } = get();
    try {
      const res = await axiosInstance.post(
        `/groups/messages/${selectedGroup._id}`,
        messageData
      );
      
      // Decrypt the message text if needed
      const SECRET_KEY = "test123"; // Ensure this matches the server-side key
      if (res.data.text) {
        try {
          // Check if the text is already decrypted
          if (res.data.text.includes("U2F") || res.data.text.includes("U2Fs")) {
            const bytes = CryptoJS.AES.decrypt(res.data.text, SECRET_KEY);
            res.data.text = bytes.toString(CryptoJS.enc.Utf8);
          }
          // If not encrypted, leave as is
        } catch (error) {
          console.error("Decryption error for sent message:", res.data._id, error.message);
          // Don't modify the text if decryption fails
        }
      }
      
      // Update messages for sender immediately
      const updatedMessages = [...groupMessages, res.data];
      set({ groupMessages: updatedMessages });

      // Emit socket event for real-time updates
      const socket = useAuthStore.getState().socket;
      if (socket) {
        socket.emit("group-message", {
          groupId: selectedGroup._id,
          message: res.data
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  subscribeToGroupMessages: () => {
    const { selectedGroup } = get();
    if (!selectedGroup) return;
  
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
  
    // Listen for new group messages
    socket.on("newGroupMessage", (newMessage) => {
      // Check if the message belongs to the currently selected group
      if (newMessage.groupId === selectedGroup._id) {
        // Decrypt the message text if needed
        const SECRET_KEY = "test123"; // Ensure this matches the server-side key
        if (newMessage.text) {
          try {
            // Check if the text is already decrypted
            if (newMessage.text.includes("U2F") || newMessage.text.includes("U2Fs")) {
              const bytes = CryptoJS.AES.decrypt(newMessage.text, SECRET_KEY);
              newMessage.text = bytes.toString(CryptoJS.enc.Utf8);
            }
            // If not encrypted, leave as is
          } catch (error) {
            console.error("Decryption error for new message:", newMessage._id, error.message);
            // Don't modify the text if decryption fails
          }
        }
        
        // Update the messages state immediately, avoiding duplicates
        set((state) => {
          // Check if message already exists
          const messageExists = state.groupMessages.some(msg => msg._id === newMessage._id);
          if (messageExists) return state;
          
          return {
            groupMessages: [...state.groupMessages, newMessage],
          };
        });
      }
    });
  },

  unsubscribeFromGroupMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newGroupMessage");
    socket.off("groupCreated");
  },

  setSelectedGroup: (group) => set({ selectedGroup: group }),
  leaveGroup: async (groupId) => {
    try {
      const res = await axiosInstance.delete(`/groups/leave/${groupId}`);
      
      // Refresh groups list
      await get().getGroups();
      
      // If leaving the currently selected group, clear selection
      if (get().selectedGroup?._id === groupId) {
        set({ selectedGroup: null });
      }
      
      toast.success(res.data.message || "Left group successfully");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to leave group");
      return false;
    }
  },

  updateGroupProfile: async (groupId, data) => {
    set({ isUpdatingGroupProfile: true });
    try {
      console.log("Updating group profile...");
      const res = await axiosInstance.put(`/groups/${groupId}/update-profile`, data);
      console.log("Group profile update response:", res.data);
      
      set((state) => ({
        selectedGroup: {
          ...state.selectedGroup,
          ...res.data
        }
      }));
      
      toast.success("Group profile updated successfully");
      return res.data;
    } catch (error) {
      console.error("Group profile update error:", error);
      toast.error(error.response?.data?.message || "Group profile update failed");
      throw error;
    } finally {
      set({ isUpdatingGroupProfile: false });
}},
}));