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
    const authMap = new Map();
    if (!uids || uids.length === 0) {
        return authMap;
    }
    const uidChunks = _chunkArray(uids, 100); // Firebase Auth `getUsers` limit is 100
    for (const chunk of uidChunks) {
        try {
            const userRecords = await admin.auth().getUsers(chunk.map(uid => ({ uid })));
            for (const userRecord of userRecords.users) {
                const email = userRecord.email || "";
                const phone = email.includes("@") ? email.split("@")[0] : (userRecord.phoneNumber || "N/A");
                authMap.set(userRecord.uid, {
                    username: userRecord.displayName || "User",
                    mobile: phone,
                });
            }
        } catch (error) {
            console.error("Error fetching a batch of user auth records:", error);
        }
    }
    return authMap;
};

/**
 * Retrieves a paginated list of all game submissions (biddings), enriched with username and mobile.
 * @param {object} [options={}] - Options for fetching data.
 * @param {number} [options.limit=20] - The number of documents to fetch per page.
 * @param {string} [options.startAfterId] - The document ID to start pagination after.
 * @returns {Promise<{biddings: Array<object>, nextCursor: string|null}>}
 */
export const getAllBiddings = async ({ limit = 20, startAfterId } = {}) => {
    let query = db.collection(GAME_SUBMISSIONS_COLLECTION).orderBy("createdAt", "desc").limit(limit);

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