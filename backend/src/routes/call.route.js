import express from "express";
import {
  startCall,
  endCall,
  getCallLogs,
} from "../controllers/call.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Apply authentication middleware to all call routes
router.use(protectRoute);

router.post("/call", startCall); // Call Create API
router.post("/end", endCall); // End Call API
router.get("/logs", getCallLogs); // Get Call Logs API

export default router;
