import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import CryptoJS from "crypto-js";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);

      // Decrypt the message text
      const SECRET_KEY = "test123"; // Ensure this matches the server-side key
      if (res.data.text) {
        try {
          const bytes = CryptoJS.AES.decrypt(res.data.text, SECRET_KEY);
          res.data.text = bytes.toString(CryptoJS.enc.Utf8);
        } catch (error) {
          console.error("Decryption error for sent message:", res.data._id, error.message);
          res.data.text = "[Error: Could not decrypt message]";
        }
      }

      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      // Decrypt the message text
      const SECRET_KEY = "test123"; // Ensure this matches the server-side key
      if (newMessage.text) {
        try {
          const bytes = CryptoJS.AES.decrypt(newMessage.text, SECRET_KEY);
          newMessage.text = bytes.toString(CryptoJS.enc.Utf8);
        } catch (error) {
          console.error("Decryption error for new message:", newMessage._id, error.message);
          newMessage.text = "[Error: Could not decrypt message]";
        }
      }

      set({
        messages: [...get().messages, newMessage],
      });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));