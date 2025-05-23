import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createGroup,
  getUserGroups,
  sendGroupMessage,
  getGroupMessages,
  leaveGroup,
  updateGroupProfile,
} from "../controllers/group.controller.js";

const router = express.Router();

router.post("/create", protectRoute, createGroup);
router.get("/user-groups", protectRoute, getUserGroups);
router.post("/messages/:groupId", protectRoute, sendGroupMessage);
router.get("/messages/:groupId", protectRoute, getGroupMessages);
router.delete("/leave/:groupId", protectRoute, leaveGroup);
router.put("/:groupId/update-profile", protectRoute, updateGroupProfile);

export default router;