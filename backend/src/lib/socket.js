import { Server } from "socket.io";
import http from "http";
import express from "express";
import { isUserInCall, addActiveCall, removeActiveCall, getAllActiveCalls, removeCallSession } from "./activeCalls.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
    credentials: true
  },
});

// Store online users (userId → socketId mapping)
const userSocketMap = {}; // {userId: socketId}

// Get receiver's socket ID
export function getReceiverSocketId(userId) {
  return userSocketMap[userId] || null;
}

io.on("connection", (socket) => {

  // Store userId → socketId mapping
  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;
    
    // Emit updated online users
    io.emit("online-users", Object.keys(userSocketMap));
  }

  // Handle joining group
  socket.on("join-group", (groupId) => {
    if (groupId) {
      socket.join(`group_${groupId}`);
    }
  });

  // Handle leaving group
  socket.on("leave-group", (groupId) => {
    if (groupId) {
      socket.leave(`group_${groupId}`);
    }
  });

  // Handle group messages
  socket.on("group-message", ({ groupId, message }) => {
    if (groupId) {
      io.to(`group_${groupId}`).emit("newGroupMessage", message);
    }
  });

  // Handle user-online event
  socket.on("user-online", ({ userId, socketId }) => {
    if (userId) {
      userSocketMap[userId] = socketId;
      
      // Emit updated online users
      io.emit("online-users", Object.keys(userSocketMap));
    }
  });

  // Handle user-offline event
  socket.on("user-offline", ({ userId, socketId }) => {
    if (userId && userSocketMap[userId] === socketId) {
      delete userSocketMap[userId];
      
      // Emit updated online users
      io.emit("online-users", Object.keys(userSocketMap));
    }
  });

  // Emit updated online users
  io.emit("online-users", Object.keys(userSocketMap));

  // WebRTC Signaling Events
  socket.on("call-offer", ({ offer, to, from, callSessionId }) => {
    
    // Check if the target user is in a call
    const isUserBusy = isUserInCall(to);
    
    if (isUserBusy) {
      // Only emit call-failed if it hasn't been emitted by call-user handler
      if (!socket.callFailedEmitted) {
        io.to(socket.id).emit("call-failed", { 
          message: "User is busy on another call",
          reason: "busy"
        });
        socket.callFailedEmitted = true;
        
        // Reset the flag after a short delay
        setTimeout(() => {
          socket.callFailedEmitted = false;
        }, 1000);
      }
      return;
    }
    
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
     
      io.to(receiverSocketId).emit("call-offer", { offer, from, callSessionId });
     
    } else {
      console.warn(`User ${to} is not online`);
      io.to(socket.id).emit("call-failed", { message: "User is offline" });
    }
  });

  // Handle Call User (alternative event name)
  socket.on("call-user", ({ to, from, signalData, callSessionId }) => {
    
    
    // Check if the target user is in a call
    const isUserBusy = isUserInCall(to);
   
    
    if (isUserBusy) {
      
      // Only emit call-failed if it hasn't been emitted by call-offer handler
      // We'll use a flag to track this
      if (!socket.callFailedEmitted) {
        io.to(socket.id).emit("call-failed", { 
          message: "User is busy on another call",
          reason: "busy"
        });
        socket.callFailedEmitted = true;
        
        // Reset the flag after a short delay
        setTimeout(() => {
          socket.callFailedEmitted = false;
        }, 1000);
      }
      return;
    }
    
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      
      const effectiveCallSessionId = callSessionId || `${from}_${to}_${Date.now()}`;
      io.to(receiverSocketId).emit("call-offer", { 
        offer: signalData, 
        from, 
        callSessionId: effectiveCallSessionId
      });
    } else {
      
      io.to(socket.id).emit("call-failed", { message: "User is offline" });
    }
  });

  // Handle Answering the Call
  socket.on("call-answer", ({ answer, to, from, callSessionId }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-answer", { answer, from, callSessionId });
      
      
      // Add both users to active calls
      if (callSessionId) {
        
        addActiveCall(from, callSessionId, to);
        addActiveCall(to, callSessionId, from);
      
      }
    } else {
      console.warn(`User ${to} is not online`);
    }
  });

  // Handle ICE Candidates
  socket.on("ice-candidate", ({ to, from, candidate, callSessionId }) => {
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      
      io.to(receiverSocketId).emit("ice-candidate", { from, candidate, callSessionId });
    }
  });

  // Handle Call End
  socket.on("end-call", ({ to, from, callSessionId }) => {
    
    // First, try to remove the entire call session
    if (callSessionId) {
      const removedCount = removeCallSession(callSessionId);
    }
    
    // Also try to remove individual users as a fallback
    if (from) {
      removeActiveCall(from);
      
    }
    if (to) {
      removeActiveCall(to);
      
    }
    
    // Notify the other user if they're online
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-ended", { from, callSessionId });
    }
    
    // Also notify the sender that the call has ended successfully
    io.to(socket.id).emit("call-ended-confirmation", { callSessionId });
  });

  // Handle Call Rejected
  socket.on("call-rejected", ({ to, from, reason, callSessionId }) => {
   
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {

      io.to(receiverSocketId).emit("call-rejected", { from, reason, callSessionId });
    }
  });

  // Handle Check User Call Status
  socket.on("check-user-call-status", ({ userId }, callback) => {
    
    // Check if the user is in a call using our active calls management
    const isInCall = isUserInCall(userId);
    
    // Send the response back to the caller
    if (typeof callback === 'function') {
      callback({ isInCall });
    }
  });

  // Handle User Disconnect
  socket.on("disconnect", () => {

    // Remove user from userSocketMap if present
    if (userId && userSocketMap[userId] === socket.id) {
      // Also remove from active calls if in a call
      if (isUserInCall(userId)) {
        removeActiveCall(userId);
      }
      
      delete userSocketMap[userId];
      io.emit("online-users", Object.keys(userSocketMap));
    }
  });
});

// Export io, app, and server
export { io, app, server };
