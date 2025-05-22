import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import CryptoJS from "crypto-js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// ✅ Secure Secret Key (Use process.env in production)
const SECRET_KEY = "test123";

// ✅ Encrypt Function
const encrypt = (text) => CryptoJS.AES.encrypt(text, SECRET_KEY).toString();

// ✅ Decrypt Function
const decrypt = (cipherText) => {
  const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// ✅ Get Users for Sidebar
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ Get Messages between Two Users
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    // ✅ Decrypt messages before sending
    const decryptedMessages = messages.map((message) => {
      try {
        const decryptedText = message.text ? decrypt(message.text) : "";
        return {
          ...message.toObject(),
          text: decryptedText,
        };
      } catch (error) {
        console.error("Error decrypting message:", error.message);
        return {
          ...message.toObject(),
          text: "[Error: Could not decrypt message]",
        };
      }
    });

    res.status(200).json(decryptedMessages);
  } catch (error) {
    console.error("Error in getMessages controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ Send Message with Optional Call Session ID
export const sendMessage = async (req, res) => {
  try {
    const { text, image, callSessionId } = req.body; // ✅ Added callSessionId
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text: text ? encrypt(text) : "", // ✅ Encrypt text
      image: imageUrl,
      callSessionId, // ✅ Store session ID
    });

    await newMessage.save();

    // ✅ Emit to Receiver if Online
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {

    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ Get Latest Call Session ID
export const getLatestCallSession = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const latestCall = await Message.findOne({
      $or: [
        {
          senderId: myId,
          receiverId: userToChatId,
          callSessionId: { $exists: true },
        },
        {
          senderId: userToChatId,
          receiverId: myId,
          callSessionId: { $exists: true },
        },
      ],
    })
      .sort({ createdAt: -1 })
      .select("callSessionId");

    res.status(200).json(latestCall);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
