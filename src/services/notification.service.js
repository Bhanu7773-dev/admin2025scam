import { admin, db } from "../plugins/firebase.js";

/**
 * Sends a single push notification to a specific device.
 * @param {object} params - The parameters for the notification.
 * @param {string} params.token - The FCM registration token of the target device.
 * @param {string} params.title - The title of the notification.
 * @param {string} params.body - The body of the notification.
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendNotification = async ({ token, title, body }) => {
  if (!token || !title || !body) {
    console.error("sendNotification(): Missing required parameters.");
    return { success: false, error: "Missing required parameters." };
  }

  const message = {
    notification: { title, body },
    token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ Sent to single device:", response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("❌ Error sending notification:", error.message);
    return { success: false, error: error.code };
  }
};

/**
 * Sends a push notification to multiple devices at once.
 * Uses batching (max 500 tokens per call).
 * @param {object} params
 * @param {string[]} params.tokens
 * @param {string} params.title
 * @param {string} params.body
 * @returns {Promise<{successCount: number, failureCount: number, errors: any[]}>}
 */
export const sendMulticastNotification = async ({ tokens, title, body }) => {
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    console.error("sendMulticastNotification(): tokens array required.");
    return { successCount: 0, failureCount: 0, errors: [] };
  }

  // Remove duplicate tokens
  const uniqueTokens = [...new Set(tokens)];

  // FCM allows max 500 per request
  const BATCH_SIZE = 500;
  let successCount = 0;
  let failureCount = 0;
  let allErrors = [];

  for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
    const batchTokens = uniqueTokens.slice(i, i + BATCH_SIZE);
    const message = {
      notification: { title, body },
      tokens: batchTokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      successCount += response.successCount;
      failureCount += response.failureCount;

      if (response.failureCount > 0) {
        const failed = response.responses
          .map((r, idx) =>
            !r.success
              ? { token: batchTokens[idx], error: r.error.code }
              : null
          )
          .filter(Boolean);
        console.warn("⚠️ Failed tokens in batch:", failed);
        allErrors.push(...failed);
      }
    } catch (error) {
      console.error("❌ Batch send error:", error);
      allErrors.push(error.message);
    }
  }

  console.log(
    `📨 Multicast summary: ${successCount} successful, ${failureCount} failed.`
  );

  return { successCount, failureCount, errors: allErrors };
};

/**
 * Sends a push notification to all users in Firestore.
 * Expects each user doc to have `fcmToken` (string or array).
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.body
 * @returns {Promise<{successCount: number, failureCount: number, errors: any[]}>}
 */
export const sendNotificationToAll = async ({ title, body }) => {
  try {
    const snapshot = await db.collection("users").get();

    // Collect tokens and flatten arrays if any
    const tokens = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data?.fcmToken) {
        if (Array.isArray(data.fcmToken)) tokens.push(...data.fcmToken);
        else tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) {
      console.warn("No FCM tokens found in users collection.");
      return { successCount: 0, failureCount: 0, errors: [] };
    }

    console.log(`🔔 Sending notification to ${tokens.length} users...`);

    return await sendMulticastNotification({ tokens, title, body });
  } catch (error) {
    console.error("❌ Error sending to all users:", error);
    return { successCount: 0, failureCount: 0, errors: [error.message] };
  }
};
