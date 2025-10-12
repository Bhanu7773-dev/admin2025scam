import { db, admin } from "../plugins/firebase.js";

const GAME_SUBMISSIONS_COLLECTION = "game_submissions";
const FUNDS_COLLECTION = "funds";
const FUNDS_TRANSACTIONS_COLLECTION = "funds_transactions";

/**
 * Retrieves all bidding history for a specific user, ordered by most recent.
 * @param {object} params - The parameters for the function.
 * @param {string} params.uuid - The user's UID to fetch the bidding history for.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of bidding objects.
 */
export const getBiddingOfUser = async ({ uuid }) => {
    if (!uuid) {
        throw new Error("getBiddingOfUser(): uuid is required");
    }

    const q = db.collection(GAME_SUBMISSIONS_COLLECTION)
        .where("uid", "==", uuid)
        .orderBy("createdAt", "desc");
    
    const snapshot = await q.get();

    if (snapshot.empty) {
        return [];
    }

    const biddingHistory = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            uid: data.uid,
            answer: data.answer || "",
            bidAmount: data.bidAmount ?? 0,
            closeTime: data.closeTime || null,
            digit: data.digit || "",
            digits: data.digits || null,
            gameId: data.gameId || "",
            gameType: data.gameType || "",
            openTime: data.openTime || null,
            selectedGameType: data.selectedGameType || "",
            status: data.status || "pending",
            title: data.title || "",
            createdAt: data.createdAt?.toDate?.().toISOString() || null,
            updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
        };
    });

    return biddingHistory;
};

/**
 * Reverts all bids for a specific date, refunding the bid amounts to the respective users.
 * This operation is performed atomically using a batch write.
 * @param {object} params - The parameters for the function.
 * @param {string} params.date - The date for which to revert bids, in 'YYYY-MM-DD' format.
 * @returns {Promise<{success: boolean, message: string}>} A promise that resolves with the result of the operation.
 */
export const revertBids = async ({ date }) => {
    if (!date) {
        throw new Error("revertBids(): date is required in YYYY-MM-DD format.");
    }

    // 1. Define the date range for the query (the entire day)
    const startDate = new Date(`${date}T00:00:00.000Z`);
    const endDate = new Date(`${date}T23:59:59.999Z`);

    // 2. Fetch all bids within the specified date range that have not already been reverted
    const bidsQuery = db.collection(GAME_SUBMISSIONS_COLLECTION)
        .where("createdAt", ">=", startDate)
        .where("createdAt", "<=", endDate);
        
    const snapshot = await bidsQuery.get();

    if (snapshot.empty) {
        return { success: true, message: "No bids found for the specified date to revert." };
    }
    
    // 3. Group bids by user and calculate the total revert amount for each
    const userRevertMap = new Map();
    snapshot.docs.forEach(doc => {
        const bid = { id: doc.id, ...doc.data() };
        // Only process bids that haven't been reverted yet
        if (bid.status !== 'reverted' && bid.uid && bid.bidAmount > 0) {
            const userData = userRevertMap.get(bid.uid) || { totalRevertAmount: 0, bidIds: [] };
            userData.totalRevertAmount += bid.bidAmount;
            userData.bidIds.push(bid.id);
            userRevertMap.set(bid.uid, userData);
        }
    });

    if (userRevertMap.size === 0) {
        return { success: true, message: "All bids for the date were already reverted or had no amount." };
    }
    
    // 4. Fetch all necessary user funds documents at once
    const uids = Array.from(userRevertMap.keys());
    const fundsQuery = db.collection(FUNDS_COLLECTION).where('uid', 'in', uids);
    const fundsSnapshot = await fundsQuery.get();
    const userFundsMap = new Map(fundsSnapshot.docs.map(doc => [doc.data().uid, { ref: doc.ref, data: doc.data() }]));

    // 5. Prepare a single atomic batch write for all updates
    const batch = db.batch();
    let bidsRevertedCount = 0;

    for (const [uid, revertData] of userRevertMap.entries()) {
        const fundDoc = userFundsMap.get(uid);
        if (!fundDoc) {
            console.warn(`Could not find funds document for user ${uid}. Skipping revert for this user.`);
            continue;
        }

        const balanceBefore = fundDoc.data.balance || 0;
        const balanceAfter = balanceBefore + revertData.totalRevertAmount;

        // A. Update the user's balance
        batch.update(fundDoc.ref, { balance: balanceAfter });

        // B. Create a transaction log for the refund
        const logRef = db.collection(FUNDS_TRANSACTIONS_COLLECTION).doc();
        batch.set(logRef, {
            uid,
            amount: revertData.totalRevertAmount,
            balanceBefore,
            balanceAfter,
            reason: `Bid Revert for date: ${date}`,
            type: "credit",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        // C. Update the status of each reverted bid
        revertData.bidIds.forEach(bidId => {
            const bidRef = db.collection(GAME_SUBMISSIONS_COLLECTION).doc(bidId);
            batch.update(bidRef, { status: "reverted" });
            bidsRevertedCount++;
        });
    }

    // 6. Commit the atomic batch write
    try {
        await batch.commit();
        return { success: true, message: `Successfully reverted ${bidsRevertedCount} bids for ${userRevertMap.size} users.` };
    } catch (error) {
        console.error("Error committing bid revert batch:", error);
        throw new Error("Failed to revert bids due to a database error.");
    }
};