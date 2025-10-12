import { admin } from "../plugins/firebase.js";

/**
 * Sends a single push notification to a specific device.
 * @param {object} params - The parameters for the notification.
 * @param {string} params.token - The FCM registration token of the target device.
 * @param {string} params.title - The title of the notification.
 * @param {string} params.body - The main content (body) of the notification.
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>} An object indicating the result.
 */
export const sendNotification = async ({ token, title, body }) => {
    if (!token || !title || !body) {
        console.error("sendNotification(): Missing required parameters: token, title, or body.");
        return { success: false, error: "Missing required parameters." };
    }

    const message = {
        notification: {
            title,
            body,
        },
        token: token,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
        return { success: true, messageId: response };
    } catch (error) {
        console.error('Error sending notification:', error.message);
        // Common errors include 'messaging/registration-token-not-registered'
        // which means the token is no longer valid.
        return { success: false, error: error.code };
    }
};

/**
 * Sends a push notification to multiple devices at once.
 * This is more efficient than sending one by one.
 * @param {object} params - The parameters for the multicast notification.
 * @param {string[]} params.tokens - An array of FCM registration tokens for the target devices.
 * @param {string} params.title - The title of the notification.
 * @param {string} params.body - The main content (body) of the notification.
 * @returns {Promise<{successCount: number, failureCount: number, errors: any[]}>} A summary of the send operation.
 */
export const sendMulticastNotification = async ({ tokens, title, body }) => {
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        console.error("sendMulticastNotification(): A non-empty array of tokens is required.");
        return { successCount: 0, failureCount: 0, errors: [] };
    }

    const message = {
        notification: {
            title,
            body,
        },
        tokens: tokens, // Use the 'tokens' key for multicast
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Notifications sent: ${response.successCount} successful, ${response.failureCount} failed.`);

        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push({
                        token: tokens[idx],
                        error: resp.error.code,
                    });
                }
            });
            console.warn('Failed tokens:', failedTokens);
        }
        
        return {
            successCount: response.successCount,
            failureCount: response.failureCount,
            errors: response.responses.filter(r => !r.success).map(r => r.error)
        };
    } catch (error) {
        console.error('Error sending multicast notification:', error);
        throw new Error("Failed to send multicast notification.");
    }
};