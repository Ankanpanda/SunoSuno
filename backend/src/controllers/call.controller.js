import CallLog from "../models/call.model.js";

// Start a Call
export const startCall = async (req, res) => {
  try {
    const { receiverId, callSessionId } = req.body;
    const callerId = req.user._id;

    // Validate required fields
    if (!receiverId || !callSessionId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newCallLog = new CallLog({
      callerId,
      receiverId,
      sessionId: callSessionId,
      startTime: new Date(),
    });

    await newCallLog.save();
    
    res.status(201).json({ 
      message: "Call started", 
      callLog: newCallLog,
      sessionId: callSessionId
    });
  } catch (error) {
    console.error("Error in startCall:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// End a Call
export const endCall = async (req, res) => {
  try {
    const { callSessionId } = req.body;

    const callLog = await CallLog.findOne({ sessionId: callSessionId });

    if (!callLog) {
      return res.status(404).json({ error: "Call log not found" });
    }

    const endTime = new Date();
    const duration = Math.floor((endTime - callLog.startTime) / 1000);

    callLog.endTime = endTime;
    callLog.duration = duration;
    await callLog.save();

    res.status(200).json({ message: "Call ended", callLog });
  } catch (error) {
    console.error("Error in endCall:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get Call Logs for a User
export const getCallLogs = async (req, res) => {
  try {
    const userId = req.user._id;

    const callLogs = await CallLog.find({
      $or: [{ callerId: userId }, { receiverId: userId }],
    }).populate("callerId receiverId", "name email");

    res.status(200).json(callLogs);
  } catch (error) {
    console.error("Error in getCallLogs:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
