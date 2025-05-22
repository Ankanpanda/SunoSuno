import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import { io } from "../lib/socket.js";
import cloudinary from "../lib/cloudinary.js";
import CryptoJS from "crypto-js";

// Secret key for message encryption (Use process.env in production)
const SECRET_KEY = "test123";

// Encrypt Function
const encrypt = (text) => CryptoJS.AES.encrypt(text, SECRET_KEY).toString();

// Decrypt Function
const decrypt = (cipherText) => {
  const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Create a new group
export const createGroup = async (req, res) => {
  try {
    const { name, description, members } = req.body;
    const admin = req.user._id;

    // Create group with admin as first member
    const group = new Group({
      name,
      description,
      admin,
      members: [admin, ...members],
    });

    await group.save();

    // Populate group with member details
    const populatedGroup = await group.populate("members", "-password");

    // Notify all group members and admin
    const allMembers = [admin, ...members];
    allMembers.forEach((memberId) => {
      io.to(`user_${memberId}`).emit("groupCreated", populatedGroup);
    });

    res.status(201).json(populatedGroup);
  } catch (error) {
    console.error("Error in createGroup:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get user's groups
export const getUserGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({ members: userId })
      .populate("members", "-password")
      .populate("admin", "-password");

    res.status(200).json(groups);
  } catch (error) {
    console.error("Error in getUserGroups:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Send message to group
export const sendGroupMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { groupId } = req.params;
    const senderId = req.user._id;

    // Check if user is group member
    const group = await Group.findById(groupId);
    if (!group.members.includes(senderId)) {
      return res.status(403).json({ error: "Not a group member" });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new GroupMessage({
      groupId,
      senderId,
      text: text ? encrypt(text) : "",
      image: imageUrl,
      readBy: [senderId],
    });

    await newMessage.save();

    // Populate sender details
    const populatedMessage = await GroupMessage.findById(newMessage._id)
      .populate("senderId", "-password");

    // Emit to all group members including sender
    const messageToSend = {
      ...populatedMessage.toObject(),
      text: text ? decrypt(populatedMessage.text) : "",
    };

    group.members.forEach((memberId) => {
      io.to(`user_${memberId}`).emit("newGroupMessage", messageToSend);
    });

    res.status(201).json(messageToSend);
  } catch (error) {
    console.error("Error in sendGroupMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get group messages
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Check if user is group member
    const group = await Group.findById(groupId);
    if (!group.members.includes(userId)) {
      return res.status(403).json({ error: "Not a group member" });
    }

    const messages = await GroupMessage.find({ groupId })
      .populate("senderId", "-password")
      .sort({ createdAt: 1 });

    // Decrypt messages
    const decryptedMessages = messages.map((message) => ({
      ...message.toObject(),
      text: message.text ? decrypt(message.text) : "",
    }));

    res.status(200).json(decryptedMessages);
  } catch (error) {
    console.error("Error in getGroupMessages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Leave group
export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is in group
    if (!group.members.includes(userId)) {
      return res.status(400).json({ error: "User not in group" });
    }

    // Remove user from members array
    group.members = group.members.filter(member => member.toString() !== userId.toString());
    
    // If admin leaves, assign new admin (first member)
    if (group.admin.toString() === userId.toString() && group.members.length > 0) {
      group.admin = group.members[0];
    }

    await group.save();

    // Notify remaining members
    group.members.forEach(memberId => {
      io.to(`user_${memberId}`).emit("groupUpdated", group);
    });

    res.status(200).json({ message: "Successfully left group" });
  } catch (error) {
    console.error("Error in leaveGroup:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};