import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.MODE === "development" ? "https://suno-suno-backend.vercel.app" : "/";

// Helper function to get token from cookies
const getTokenFromCookies = () => {
  const cookies = document.cookie.split("; ");
  const jwtCookie = cookies.find((row) => row.startsWith("jwt="));
  return jwtCookie ? jwtCookie.split("=")[1] : null;
};

// Helper function to get token from localStorage
const getTokenFromLocalStorage = () => {
  return localStorage.getItem("token");
};

export const useAuthStore = create((set, get) => ({
  authUser: null,
  token: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,
  socketConnected: false,
  peerConnection: null,
  localStream: null,
  remoteStream: null,

  checkAuth: async () => {
    try {
      console.log("Checking authentication...");
      
      // First check if we have any token in cookies or localStorage
      const cookieToken = getTokenFromCookies();
      const localStorageToken = getTokenFromLocalStorage();
      
      if (!cookieToken && !localStorageToken) {
        console.log("No tokens found in cookies or localStorage, skipping auth check");
        set({ authUser: null, token: null, isCheckingAuth: false });
        return;
      }
      
      const res = await axiosInstance.get("/auth/check");
      console.log("Auth check response:", res.data);
      
      // Try to get token from multiple sources
      let token = cookieToken;
      console.log("Token from cookie:", token ? "Found" : "Not found");
      
      if (!token) {
        token = localStorageToken;
        console.log("Token from localStorage:", token ? "Found" : "Not found");
      }
      
      if (res.data && res.data._id) {
        console.log("User data found:", res.data);
      set({ authUser: res.data });
        
        if (token) {
          console.log("Setting token in store");
          set({ token });
          get().connectSocket();
        } else {
          console.log("No token found in any source");
          // If we have user data but no token, try to continue anyway
      get().connectSocket();
        }
      } else {
        console.log("No valid user data found");
        set({ authUser: null, token: null });
      }
    } catch (error) {
      console.log("Error in checkAuth:", error?.response?.data || error.message);
      set({ authUser: null, token: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      console.log("Signing up...");
      
      // Clear any existing tokens before signup
      localStorage.removeItem("token");
      
      const res = await axiosInstance.post("/auth/signup", data);
      console.log("Signup response:", res.data);
      
      // Try to get token from multiple sources
      let token = res.headers['authorization']?.split(' ')[1];
      console.log("Token from response headers:", token ? "Found" : "Not found");
      
      if (!token) {
        token = getTokenFromCookies();
        console.log("Token from cookie:", token ? "Found" : "Not found");
      }
      
      if (!token) {
        token = getTokenFromLocalStorage();
        console.log("Token from localStorage:", token ? "Found" : "Not found");
      }
      
      if (token) {
        // Store token in localStorage as backup
        localStorage.setItem("token", token);
        set({ authUser: res.data, token });
      toast.success("Account created successfully");
      get().connectSocket();
      } else {
        console.error("No token received after signup");
        toast.error("Failed to get authentication token");
        // Still set the user data even if token is missing
        set({ authUser: res.data });
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast.error(error.response?.data?.message || "Signup failed");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      console.log("Logging in with data:", { email: data.email, password: "***" });
      
      // Clear any existing tokens
      localStorage.removeItem("token");
      
      // Validate input data
      if (!data.email || !data.password) {
        toast.error("Email and password are required");
        return;
      }
      
      const res = await axiosInstance.post("/auth/login", {
        email: data.email.trim(),
        password: data.password
      });
      
      console.log("Login response:", {
        status: res.status,
        headers: res.headers,
        data: { ...res.data, token: res.data.token ? "***" : null }
      });
      
      let token = null;
      
      // 1. Try to get token from response data
      if (res.data && res.data.token) {
        token = res.data.token;
        console.log("Found token in response data");
      }
      
      // 2. Try to get token from Authorization header
      if (!token && res.headers["authorization"]) {
        token = res.headers["authorization"].replace("Bearer ", "");
        console.log("Found token in Authorization header");
      }
      
      // 3. Try to get token from cookies
      if (!token) {
        token = getTokenFromCookies();
        console.log("Found token in cookies:", !!token);
      }
      
      if (token && res.data._id) {
        console.log("Setting token and user data");
        localStorage.setItem("token", token);
        set({ 
          authUser: {
            _id: res.data._id,
            fullName: res.data.fullName,
            email: res.data.email,
            profilePic: res.data.profilePic
          }, 
          token 
        });
        
      toast.success("Logged in successfully");

        // Initialize socket connection after successful login
      get().connectSocket();
      } else {
        console.error("No token or user data received after login");
        toast.error("Failed to get authentication token");
        set({ authUser: null, token: null, socket: null, socketConnected: false });
      }
    } catch (error) {
      console.error("Login error:", error);
      console.error("Login error details:", {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error.message
      });
      toast.error(error?.response?.data?.message || "Login failed");
      set({ authUser: null, token: null, socket: null, socketConnected: false });
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: () => {
    try {
      const { socket, authUser } = get();
      if (socket && authUser?._id) {
        // Emit user-offline event before disconnecting
        socket.emit("user-offline", {
          userId: authUser._id,
          socketId: socket.id
        });
        socket.disconnect();
      }
      localStorage.removeItem("token");
      set({
        authUser: null,
        token: null,
        socket: null,
        socketConnected: false,
        onlineUsers: []
      });
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      console.log("Updating profile...");
      const res = await axiosInstance.put("/auth/update-profile", data);
      console.log("Profile update response:", res.data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error(error.response?.data?.message || "Profile update failed");
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    try {
      const { authUser } = get();
      if (!authUser?._id) {
        console.log("No user ID available for socket connection");
        return;
      }

      const socket = io(SOCKET_URL, {
        query: { userId: authUser._id }
      });

      socket.on("connect", () => {
        console.log("Socket connected");
        set({ socket, socketConnected: true });
        
        // Emit user-online event
        socket.emit("user-online", {
          userId: authUser._id,
          socketId: socket.id
        });
      });

      socket.on("online-users", (users) => {
        console.log("Received online users:", users);
        get().setOnlineUsers(users);
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected");
        set({ socketConnected: false });
      });

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        set({ socket: null, socketConnected: false });
      });

    } catch (error) {
      console.error("Socket connection error:", error);
      set({ socket: null, socketConnected: false });
    }
  },

  disconnectSocket: () => {
    if (get().socket?.connected) {
      console.log("Disconnecting socket...");
      get().socket.disconnect();
      set({ socketConnected: false });
    }
  },

  initializePeer: () => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    set({ peerConnection: peer });
    return peer;
  },

  startCall: async (receiverId) => {
    const peer = get().initializePeer();

    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    set({ localStream });

    localStream
      .getTracks()
      .forEach((track) => peer.addTrack(track, localStream));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    get().socket?.emit("call-user", { offer, to: receiverId });
  },

  setOnlineUsers: (users) => {
    console.log("Setting online users:", users);
    set({ onlineUsers: users });
  },
}));
