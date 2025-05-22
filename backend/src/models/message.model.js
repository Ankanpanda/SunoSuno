import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    callSessionId: {
      type: String, // Unique WebRTC session ID
    },
    // callStatus: {
    //   type: String,
    //   enum: ["ongoing", "missed", "ended"],
    // },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
