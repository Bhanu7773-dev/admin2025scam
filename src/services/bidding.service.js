import { db, admin } from "../plugins/firebase.js";

const GAME_SUBMISSIONS_COLLECTION = "game_submissions";
const FUNDS_COLLECTION = "funds";
const FUNDS_TRANSACTIONS_COLLECTION = "funds_transactions";

/**
 * Helper to batch an array into smaller chunks for Firestore 'in' queries.
 * @param {Array<any>} arr The array to chunk.
 * @param {number} size The size of each chunk.
 * @returns {Array<Array<any>>} An array of chunked arrays.
 */
const _chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

/**
 * A private helper to fetch Firebase Auth records for a given list of UIDs.
 * This is optimized to handle large lists by batching requests.
 * @param {string[]} uids - An array of user UIDs.
 * @returns {Promise<Map<string, object>>} A Map where keys are UIDs and values are user auth data.
 */
const _fetchAuthInfoByUids = async (uids) => {
    const userInfoMap = new Map();
    if (!uids || uids.length === 0) {
        return userInfoMap;
    }

    const firestoreChunks = _chunkArray(uids, 30);
    for (const chunk of firestoreChunks) {
        try {
            const usersSnapshot = await db.collection("users").where("uid", "in", chunk).get();
            for (const doc of usersSnapshot.docs) {
                const data = doc.data();
                const uid = data.uid;
                if (!uid) continue;

                userInfoMap.set(uid, {
                    username: data.username || "User",
                    mobile: data.phone || "N/A",
                });
            }
        } catch (error) {
            console.error("Error fetching a batch of user firestore records:", error);
        }
    }
    return userInfoMap;
};

/**
* Retrieves a paginated list of all game submissions (biddings), enriched with username and mobile.
*
* @param {object} [options={}] - Options for fetching data.
* @param {number} [options.limit=20] - The number of documents to fetch per page.
* @param {string} [options.startAfterId] - The document ID to start pagination after.
* @param {'win'|'lost'|'pending'} [options.status] - Filter submissions by their status.
* @param {boolean} [options.starline] - Filter by starline games. `true` for starline only, `false` for non-starline.
* @param {boolean} [options.jackpot] - Filter by jackpot games. `true` for jackpot only, `false` for non-jackpot.
* @returns {Promise<{biddings: Array<object>, nextCursor: string|null}>}
*/
export const getAllBiddings = async ({ limit = 20, startAfterId, status, starline, jackpot } = {}) => {
    // Base query
    let query = db.collection(GAME_SUBMISSIONS_COLLECTION);

    // Conditionally apply filters independently
    if (status) {
        query = query.where("status", "==", status);
    }

    // Check for boolean true/false, but not for null/undefined
    if (starline !== undefined && starline !== null) {
        query = query.where("isStarline", "==", starline);
    }

    if (jackpot !== undefined && jackpot !== null) {
        query = query.where("isJackpot", "==", jackpot);
    }

    // Apply ordering and limit
    query = query.orderBy("createdAt", "desc").limit(limit);

    // Handle pagination
    if (startAfterId) {
        const lastDoc = await db.collection(GAME_SUBMISSIONS_COLLECTION).doc(startAfterId).get();
        if (lastDoc.exists) {
            query = query.startAfter(lastDoc);
        }
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
        return { biddings: [], nextCursor: null };
    }

    const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // The rest of the logic for enriching data remains the same
    const uids = [...new Set(submissions.map(sub => sub.uid).filter(Boolean))];
    const userInfoMap = await _fetchAuthInfoByUids(uids);

    const enrichedBiddings = submissions.map(sub => {
        const userInfo = userInfoMap.get(sub.uid) || { username: "N/A", mobile: "N/A" };
        return {
            ...sub,
            username: userInfo.username,
            mobile: userInfo.mobile,
            createdAt: sub.createdAt?.toDate?.().toISOString() || null,
        };
    });

    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = lastVisible ? lastVisible.id : null;

    return { biddings: enrichedBiddings, nextCursor };
};

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

    return snapshot.docs.map(doc => {
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
};

/**
 * Updates the details of a specific bidding document.
 * @param {object} params - The parameters for the function.
 * @param {string} params.bidId - The document ID of the game submission to update.
 * @param {object} params.data - An object with the fields to update (e.g., { bidAmount, answer }).
 * @returns {Promise<{success: boolean, message: string}>} A promise resolving on completion.
 */
export const updateBidding = async ({ bidId, data }) => {
    if (!bidId) throw new Error("updateBidding(): bidId is required.");
    if (!data || Object.keys(data).length === 0) throw new Error("updateBidding(): data object with fields to update is required.");

    const bidRef = db.collection(GAME_SUBMISSIONS_COLLECTION).doc(bidId);

    delete data.uid;
    delete data.createdAt;

    data.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await bidRef.update(data);

    return { success: true, message: `Bid ${bidId} updated successfully.` };
};

/**
 * Updates the status of a single bid. If the new status is 'win', it credits the user's wallet.
 * @param {object} params - The parameters for the function.
 * @param {string} params.bidId - The document ID of the game submission.
 * @param {'win' | 'lost' | 'pending'} params.newStatus - The new status to set.
 * @param {number} [params.winMultiplier=9.5] - The multiplier to calculate winnings.
 * @returns {Promise<{success: boolean, message: string}>} A promise resolving on completion.
 */
export const updateBiddingStatus = async ({ bidId, newStatus, winMultiplier = 9.5 }) => {
    if (!bidId) throw new Error("updateBiddingStatus(): bidId is required.");
    if (!['win', 'lost', 'pending'].includes(newStatus)) throw new Error("Invalid status provided.");

    const bidRef = db.collection(GAME_SUBMISSIONS_COLLECTION).doc(bidId);

    if (newStatus === 'lost' || newStatus === 'pending') {
        await bidRef.update({ status: newStatus });
        return { success: true, message: `Bid status updated to ${newStatus}.` };
    }

    try {
        await db.runTransaction(async (t) => {
            const bidDoc = await t.get(bidRef);
            if (!bidDoc.exists) throw new Error("Bidding document not found.");

            const bidData = bidDoc.data();
            if (bidData.status !== 'pending') throw new Error(`Bid has already been processed with status: ${bidData.status}.`);

            const { uid, bidAmount } = bidData;
            if (!uid || typeof bidAmount !== 'number') throw new Error("Bid is missing 'uid' or a valid 'bidAmount'.");

            const fundsQuery = db.collection(FUNDS_COLLECTION).where('uid', '==', uid).limit(1);
            const fundsSnapshot = await t.get(fundsQuery);
            if (fundsSnapshot.empty) throw new Error(`Funds document for user ${uid} not found.`);

            const fundsDocRef = fundsSnapshot.docs[0].ref;
            const fundsData = fundsSnapshot.docs[0].data();
            const balanceBefore = fundsData.balance || 0;
            const winningAmount = bidAmount * winMultiplier;
            const balanceAfter = balanceBefore + winningAmount;

            const logRef = db.collection(FUNDS_TRANSACTIONS_COLLECTION).doc();
            t.set(logRef, {
                uid, amount: winningAmount, balanceBefore, balanceAfter, type: 'credit',
                reason: `Bid Won - Ref: ${bidId}`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            t.update(fundsDocRef, { balance: balanceAfter });
            t.update(bidRef, { status: 'win' });
        });
        return { success: true, message: 'Bid marked as "win" and user credited successfully.' };
    } catch (error) {
        console.error("Bid win transaction failed:", error);
        throw new Error(`Failed to mark bid as win: ${error.message}`);
    }
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
    const startDate = new Date(`${date}T00:00:00.000Z`);
    const endDate = new Date(`${date}T23:59:59.999Z`);
    const bidsQuery = db.collection(GAME_SUBMISSIONS_COLLECTION).where("createdAt", ">=", startDate).where("createdAt", "<=", endDate);
    const snapshot = await bidsQuery.get();

    if (snapshot.empty) return { success: true, message: "No bids found for the specified date to revert." };

    const userRevertMap = new Map();
    snapshot.docs.forEach(doc => {
        const bid = { id: doc.id, ...doc.data() };
        if (bid.status !== 'reverted' && bid.uid && bid.bidAmount > 0) {
            const userData = userRevertMap.get(bid.uid) || { totalRevertAmount: 0, bidIds: [] };
            userData.totalRevertAmount += bid.bidAmount;
            userData.bidIds.push(bid.id);
            userRevertMap.set(bid.uid, userData);
        }
    });

    if (userRevertMap.size === 0) return { success: true, message: "All bids for the date were already reverted or had no amount." };

    const uids = Array.from(userRevertMap.keys());
    const fundsQuery = db.collection(FUNDS_COLLECTION).where('uid', 'in', uids);
    const fundsSnapshot = await fundsQuery.get();
    const userFundsMap = new Map(fundsSnapshot.docs.map(doc => [doc.data().uid, { ref: doc.ref, data: doc.data() }]));

    const batch = db.batch();
    let bidsRevertedCount = 0;

    for (const [uid, revertData] of userRevertMap.entries()) {
        const fundDoc = userFundsMap.get(uid);
        if (!fundDoc) {
            console.warn(`Could not find funds document for user ${uid}. Skipping revert.`);
            continue;
        }

        const balanceBefore = fundDoc.data.balance || 0;
        const balanceAfter = balanceBefore + revertData.totalRevertAmount;

        batch.update(fundDoc.ref, { balance: balanceAfter });

        const logRef = db.collection(FUNDS_TRANSACTIONS_COLLECTION).doc();
        batch.set(logRef, {
            uid, amount: revertData.totalRevertAmount, balanceBefore, balanceAfter,
            reason: `Bid Revert for date: ${date}`,
            type: "credit",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        revertData.bidIds.forEach(bidId => {
            const bidRef = db.collection(GAME_SUBMISSIONS_COLLECTION).doc(bidId);
            batch.update(bidRef, { status: "reverted" });
            bidsRevertedCount++;
        });
    }

    try {
        await batch.commit();
        return { success: true, message: `Successfully reverted ${bidsRevertedCount} bids for ${userRevertMap.size} users.` };
    } catch (error) {
        console.error("Error committing bid revert batch:", error);
        throw new Error("Failed to revert bids due to a database error.");
    }
};

/**
 * Reverts bids based on dynamic criteria (date and/or gameId), refunding the bid amounts.
 * After reverting, it returns a detailed list of the bids that were processed.
 * @param {object} params - The criteria for reverting bids.
 * @param {string} [params.date] - The date to revert bids for, in 'YYYY-MM-DD' format.
 * @param {string} [params.gameId] - The specific gameId to revert bids for.
 * @returns {Promise<{success: boolean, message: string, revertedBids: Array<{username: string, bidAmount: number, gameType: string}>}>}
 */
export const revertBidsByCriteria = async ({ date, gameId }) => {
    if (!date && !gameId) {
        throw new Error("revertBidsByCriteria(): At least one criterion (date or gameId) is required.");
    }

    // Step 1: Build the query dynamically based on the provided criteria.
    let bidsQuery = db.collection(GAME_SUBMISSIONS_COLLECTION);

    if (date) {
        const startDate = new Date(`${date}T00:00:00.000Z`);
        const endDate = new Date(`${date}T23:59:59.999Z`);
        bidsQuery = bidsQuery.where("createdAt", ">=", startDate).where("createdAt", "<=", endDate);
    }
    if (gameId) {
        bidsQuery = bidsQuery.where("gameId", "==", gameId);
    }
    // NOTE: If using both 'date' and 'gameId', you may need to create a composite index in Firestore.

    const snapshot = await bidsQuery.get();
    if (snapshot.empty) {
        return { success: true, message: "No bids found for the specified criteria to revert.", revertedBids: [] };
    }

    // Step 2: Aggregate all bids that need to be reverted, grouped by user.
    const userRevertMap = new Map();
    snapshot.docs.forEach(doc => {
        const bid = { id: doc.id, ...doc.data() };
        // Only process bids that are not already reverted.
        if (bid.status !== 'reverted' && bid.uid && bid.bidAmount > 0) {
            const userData = userRevertMap.get(bid.uid) || { totalRevertAmount: 0, bidsToUpdate: [] };
            userData.totalRevertAmount += bid.bidAmount;
            // Store the info needed for the batch update and the final return list.
            userData.bidsToUpdate.push({
                bidId: bid.id,
                bidAmount: bid.bidAmount,
                gameType: bid.gameType,
            });
            userRevertMap.set(bid.uid, userData);
        }
    });

    if (userRevertMap.size === 0) {
        return { success: true, message: "All bids for the criteria were already reverted or had no amount.", revertedBids: [] };
    }

    // Step 3: Fetch user and funds information for all affected users.
    const uids = Array.from(userRevertMap.keys());
    const [userInfoMap, fundsSnapshot] = await Promise.all([
        _fetchAuthInfoByUids(uids),
        db.collection(FUNDS_COLLECTION).where('uid', 'in', uids).get()
    ]);
    const userFundsMap = new Map(fundsSnapshot.docs.map(doc => [doc.data().uid, { ref: doc.ref, data: doc.data() }]));

    const batch = db.batch();
    const revertedBidsList = [];
    let bidsRevertedCount = 0;

    // Step 4: Build the atomic batch write and the detailed return list.
    for (const [uid, revertData] of userRevertMap.entries()) {
        const fundDoc = userFundsMap.get(uid);
        const userInfo = userInfoMap.get(uid) || { username: "N/A" };

        if (fundDoc) {
            const balanceBefore = fundDoc.data.balance || 0;

            // Add the balance update to the batch using atomic increment.
            batch.update(fundDoc.ref, {
                balance: admin.firestore.FieldValue.increment(revertData.totalRevertAmount)
            });

            // Add the transaction log to the batch.
            const logRef = db.collection(FUNDS_TRANSACTIONS_COLLECTION).doc();
            batch.set(logRef, {
                uid,
                amount: revertData.totalRevertAmount,
                balanceBefore,
                balanceAfter: balanceBefore + revertData.totalRevertAmount,
                reason: `Bid Revert - Game: ${gameId || 'All'}, Date: ${date || 'All'}`,
                type: "credit",
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            console.warn(`Could not find funds document for user ${uid}. Skipping fund revert.`);
        }

        // Add each bid status update to the batch and build the return list.
        revertData.bidsToUpdate.forEach(bid => {
            const bidRef = db.collection(GAME_SUBMISSIONS_COLLECTION).doc(bid.bidId);
            batch.update(bidRef, { status: "reverted" });
            bidsRevertedCount++;

            revertedBidsList.push({
                username: userInfo.username,
                bidAmount: bid.bidAmount,
                gameType: bid.gameType,
            });
        });
    }

    // Step 5: Commit the batch and return the results.
    try {
        await batch.commit();
        return {
            success: true,
            message: `Successfully reverted ${bidsRevertedCount} bids for ${userRevertMap.size} users.`,
            revertedBids: revertedBidsList
        };
    } catch (error) {
        console.error("Error committing bid revert batch:", error);
        throw new Error("Failed to revert bids due to a database error.");
    }
};

/**
 * Clears (deletes) all bids that have already been marked as 'reverted'
 * based on dynamic criteria (date and/or gameId).
 * This function DOES NOT refund any money; it only cleans up old records.
 * @param {object} params - The criteria for clearing bids.
 * @param {string} [params.date] - The date for which to clear reverted bids, in 'YYYY-MM-DD' format.
 * @param {string} [params.gameId] - The specific gameId to clear reverted bids for.
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const clearRevertedBids = async ({ date, gameId }) => {
    if (!date && !gameId) {
        throw new Error("clearRevertedBids(): At least one criterion (date or gameId) is required.");
    }

    // Step 1: Build a query to find only bids with status 'reverted'.
    let query = db.collection(GAME_SUBMISSIONS_COLLECTION).where("status", "==", "reverted");

    if (date) {
        const startDate = new Date(`${date}T00:00:00.000Z`);
        const endDate = new Date(`${date}T23:59:59.999Z`);
        query = query.where("createdAt", ">=", startDate).where("createdAt", "<=", endDate);
    }
    if (gameId) {
        query = query.where("gameId", "==", gameId);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
        return { success: true, message: "No reverted bids found for the specified criteria to clear." };
    }

    // Step 2: Batch the delete operations to handle large numbers of documents safely.
    // Firestore batches are limited to 500 operations each.
    const docRefs = snapshot.docs.map(doc => doc.ref);
    const chunks = _chunkArray(docRefs, 500);
    const batchPromises = [];

    for (const chunk of chunks) {
        const batch = db.batch();
        for (const ref of chunk) {
            batch.delete(ref);
        }
        batchPromises.push(batch.commit());
    }

    // Step 3: Execute all batches and return the result.
    try {
        await Promise.all(batchPromises);
        return { success: true, message: `Successfully cleared ${snapshot.size} reverted bids.` };
    } catch (error) {
        console.error("Error committing bid clearing batch:", error);
        throw new Error("Failed to clear reverted bids due to a database error.");
    }
};