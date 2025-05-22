// Active calls management
// This file provides functions to track and manage active calls in the application

// Store active calls in memory
// Format: { userId: { callSessionId, partnerId, startTime } }
const activeCalls = {};

// Cleanup interval to remove stale calls (5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_CALL_DURATION = 60 * 60 * 1000; // 1 hour max call duration

// Start cleanup interval
setInterval(() => {
  const now = new Date();
  let cleaned = 0;
  
  // Check each active call
  Object.keys(activeCalls).forEach(userId => {
    const call = activeCalls[userId];
    const callDuration = now - new Date(call.startTime);
    
    // Remove calls that are too old
    if (callDuration > MAX_CALL_DURATION) {
      delete activeCalls[userId];
      cleaned++;
    }
  });
  
  if (cleaned > 0) {

  }
}, CLEANUP_INTERVAL);

/**
 * Add a user to active calls
 * @param {string} userId - The user ID
 * @param {string} callSessionId - The call session ID
 * @param {string} partnerId - The partner's user ID
 * @returns {boolean} - Whether the operation was successful
 */
export const addActiveCall = (userId, callSessionId, partnerId) => {
  try {
    activeCalls[userId] = {
      callSessionId,
      partnerId,
      startTime: new Date()
    };
    return true;
  } catch (error) {
    console.error("Error adding active call:", error);
    return false;
  }
};

/**
 * Remove a user from active calls
 * @param {string} userId - The user ID
 * @returns {boolean} - Whether the operation was successful
 */
export const removeActiveCall = (userId) => {
  try {
    if (activeCalls[userId]) {
      delete activeCalls[userId];

      return true;
    }
    return false;
  } catch (error) {
    console.error("Error removing active call:", error);
    return false;
  }
};

/**
 * Check if a user is in an active call
 * @param {string} userId - The user ID
 * @returns {boolean} - Whether the user is in an active call
 */
export const isUserInCall = (userId) => {
  // Double-check that the call is still valid
  if (activeCalls[userId]) {
    const call = activeCalls[userId];
    const now = new Date();
    const callDuration = now - new Date(call.startTime);
    
    // If the call is too old, remove it and return false
    if (callDuration > MAX_CALL_DURATION) {

      delete activeCalls[userId];
      return false;
    }
    
    return true;
  }
  return false;
};

/**
 * Get active call details for a user
 * @param {string} userId - The user ID
 * @returns {Object|null} - The active call details or null if not in a call
 */
export const getActiveCallDetails = (userId) => {
  return activeCalls[userId] || null;
};

/**
 * Get all active calls
 * @returns {Object} - All active calls
 */
export const getAllActiveCalls = () => {
  return { ...activeCalls };
};

/**
 * Force remove all calls for a specific call session
 * @param {string} callSessionId - The call session ID
 * @returns {number} - Number of users removed
 */
export const removeCallSession = (callSessionId) => {
  let removed = 0;
  
  Object.keys(activeCalls).forEach(userId => {
    if (activeCalls[userId].callSessionId === callSessionId) {
      delete activeCalls[userId];
      removed++;
    }
  });
  
  if (removed > 0) {

  }
  
  return removed;
};

export default {
  addActiveCall,
  removeActiveCall,
  isUserInCall,
  getActiveCallDetails,
  getAllActiveCalls,
  removeCallSession
}; 