import { db } from "../plugins/firebase.js";

const WITHDRAWL_COLLECTION = "withdrawl";

/**
 * Calculates the total amount of withdrawals, optionally filtered by status.
 * @param {string} [statusFilter] - Optional status to filter by (e.g., 'approved', 'pending', 'declined').
 * @returns {Promise<number>} A promise that resolves to the total withdrawal amount.
 */
export const getTotalWithdrawals = async (statusFilter) => {
    let query = db.collection(WITHDRAWL_COLLECTION);

    if (statusFilter) {
        query = query.where("status", "==", statusFilter);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
        return 0;
    }

    const totalAmount = snapshot.docs.reduce((acc, doc) => {
        return acc + (Number(doc.data().amount) || 0);
    }, 0);

    return totalAmount;
};

/**
 * Gets all withdrawal requests for a specific user, ordered by most recent.
 * @param {object} params - The parameters for the function.
 * @param {string} params.uuid - The user's UID to fetch withdrawal requests for.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of withdrawal request objects.
 */
export const getWithdrawlRequestsForUser = async ({ uuid }) => {
    if (!uuid) {
        throw new Error("getWithdrawlRequestsForUser(): uuid is required");
    }

    const q = db.collection(WITHDRAWL_COLLECTION)
        .where("uid", "==", uuid)
        .orderBy("createdAt", "desc"); // Use createdAt for consistent ordering

    const snapshot = await q.get();
    if (snapshot.empty) {
        return [];
    }

    const withdrawls = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: data.withdrawalId || doc.id,
            uid: data.uid,
            amount: data.amount ?? 0,
            status: data.status ?? 'pending',
            paymentMethod: data.paymentMethod || 'UPI',
            declinedAt: data.declinedAt?.toDate?.().toISOString() || null,
            approvedAt: data.approvedAt?.toDate?.().toISOString() || null,
            upiApp: data.upiDetails?.upiApp || 'N/A',
            upiNumber: data.upiDetails?.upiNumber || 'N/A',
            createdAt: data.createdAt?.toDate?.().toISOString() || null,
            updatedAt: data.updatedAt?.toDate?.().toISOString() || null
        };
    });

    return withdrawls;
};