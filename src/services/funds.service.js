import { db, admin } from "../plugins/firebase.js";

const DEPOSITS_COLLECTION = "deposits"

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
 * A private helper to fetch user info directly from the 'users' Firestore collection.
 * This is optimized to handle large lists by batching requests.
 * @param {string[]} uids - An array of user UIDs.
 * @returns {Promise<Map<string, object>>} A Map where keys are UIDs and values are { username, mobile }.
 */
const _fetchUserInfoByUids = async (uids) => {
    const userInfoMap = new Map();
    if (!uids || uids.length === 0) {
        return userInfoMap;
    }

    // Firestore 'in' query limit is 30, so we batch the UIDs.
    const firestoreChunks = _chunkArray(uids, 30);
    for (const chunk of firestoreChunks) {
        try {
            // Query the 'users' collection where the 'uid' field is in our list of UIDs.
            const usersSnapshot = await db.collection("users").where("uid", "in", chunk).get();
            for (const doc of usersSnapshot.docs) {
                const data = doc.data();
                const uid = data.uid;
                if (!uid) continue; // Skip if a document somehow doesn't have a UID.

                // Create the map entry directly from Firestore data.
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
 * Fetches all withdrawal requests and enriches them with user information.
 * @returns {Promise<{fund_withdrawl: Array<object>}>} A promise that resolves to an object containing the list of withdrawals.
 */
export const getAllWithdrawals = async () => {
    const withdrawlSnapshot = await db.collection("withdrawl").orderBy("createdAt", "desc").get();
    if (withdrawlSnapshot.empty) {
        return { fund_withdrawl: [] };
    }

    const withdrawDocs = withdrawlSnapshot.docs.map(doc => doc.data());
    const uids = [...new Set(withdrawDocs.map(doc => doc.uid).filter(Boolean))];
    const userInfoMap = await _fetchAuthInfoByUids(uids);

    const fundWithdrawals = withdrawDocs.map(data => {
        const info = userInfoMap.get(data.uid) || { username: "User", mobile: "N/A", email: "" };
        const createdDate = data.createdAt?.toDate?.().toISOString().slice(0, 10) || null;

        return {
            username: info.username,
            no: info.email, // 'no' maps to email in your original code
            mobile: info.mobile,
            amount: data.amount || 0,
            createdAt: createdDate,
            status: data.status || "pending"
        };
    });

    return { fund_withdrawl: fundWithdrawals };
};

/**
 * Fetches the fund details for a single user by their UID.
 * @param {object} params - The parameters for the function.
 * @param {string} params.uuid - The user's UID.
 * @returns {Promise<object>} A promise that resolves to the user's fund information.
 */
export const getFundsOfUser = async ({ uuid }) => {
    if (!uuid) throw new Error("getFundsOfUser(): uuid is required");

    const snapshot = await db.collection("funds").where("uid", "==", uuid).limit(1).get();
    if (snapshot.empty) {
        return { balance: 0, uid: uuid };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
        uuid: doc.id,
        balance: data.balance || 0,
        createdAt: data.createdAt?.toDate?.() || null,
        updatedAt: data.updatedAt?.toDate?.() || null,
        lastSyncAt: data.lastSyncAt?.toDate?.() || null,
        lastUpdateReason: data.lastUpdateReason || null
    };
};

/**
 * Fetches and aggregates all fund requests (deposits) and withdrawals.
 * @returns {Promise<object>} An object containing lists and total amounts for requests and withdrawals.
 */
export const getAllFunds = async () => {
    const [depositsSnap, withdrawSnap] = await Promise.all([
        db.collection("deposits").orderBy("createdAt", "desc").get(),
        db.collection("withdrawl").orderBy("createdAt", "desc").get()
    ]);

    const depositDocs = depositsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const withdrawDocs = withdrawSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const allUids = [...new Set([...depositDocs.map(d => d.uid), ...withdrawDocs.map(d => d.uid)].filter(Boolean))];

    const userInfoMap = await _fetchUserInfoByUids(allUids);

    const fundRequests = depositDocs.map((d, i) => {
        const info = userInfoMap.get(d.uid) || { username: "User", mobile: "" };
        const date = d.createdAt?.toDate?.().toISOString().slice(0, 10) || null;
        return {
            index: i + 1,
            uid: d.uid,
            username: info.username,
            mobile: info.mobile,
            amount: d.amount || 0,
            requestNo: d.requestNo || d.id,
            date,
            status: d.status || "pending",
        };
    });

    const fundWithdrawals = withdrawDocs.map((d, i) => {
        const info = userInfoMap.get(d.uid) || { username: "User", mobile: "" };
        const date = d.createdAt?.toDate?.().toISOString().slice(0, 10) || null;
        return {
            index: i + 1,
            uid: d.uid,
            username: info.username, // This will now be the correct name
            mobile: info.mobile,     // This will now be the correct mobile number
            amount: d.amount || 0,
            requestNo: d.withdrawalId || d.id,
            date,
            status: d.status || "pending",
        };
    });

    const totalFundRequestAmount = fundRequests.reduce((sum, r) => sum + r.amount, 0);
    const totalFundWithdrawalAmount = fundWithdrawals.reduce((sum, r) => sum + r.amount, 0);

    return {
        test: userInfoMap,
        fund_requests: { total_amount: totalFundRequestAmount, list: fundRequests },
        fund_withdrawals: { total_amount: totalFundWithdrawalAmount, list: fundWithdrawals },
    };
};

/**
 * Gets all fund transactions (credit/debit) for a specific user UID.
 * @param {object} params - The parameters for the function.
 * @param {string} params.uuid - The user's UID to fetch transactions for.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of transaction objects.
 */
export const getFundTransactionsForUser = async ({ uuid }) => {
    if (!uuid) {
        throw new Error("getFundTransactionsForUser(): uuid is required");
    }
    const q = db.collection("funds_transactions").where("uid", "==", uuid).orderBy("timestamp", "desc");
    const snapshot = await q.get();
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate?.().toISOString() || null,
        };
    });
};

/**
 * Updates the status of a fund request (deposit) to 'approved' or 'rejected'.
 * Uses a transaction to ensure balance and logs are updated atomically on approval.
 * @param {object} params - The parameters for the function.
 * @param {string} params.requestId - The ID of the deposit document to update.
 * @param {'approved' | 'rejected'} params.newStatus - The new status to set.
 * @returns {Promise<{success: boolean, message: string}>} A promise that resolves on completion.
 */
export const updateFundRequestStatus = async ({ requestId, newStatus }) => {
    if (!requestId) throw new Error("updateFundRequestStatus(): requestId is required.");
    if (newStatus !== 'approved' && newStatus !== 'rejected') throw new Error("Invalid status. Must be 'approved' or 'rejected'.");

    const depositRef = db.collection('deposits').doc(requestId);

    // Rejection logic is simple and doesn't need a transaction.
    if (newStatus === 'rejected') {
        await depositRef.update({
            status: 'rejected',
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, message: 'Request rejected successfully.' };
    }

    // Approval logic requires a transaction.
    try {
        await db.runTransaction(async (t) => {
            const depositDoc = await t.get(depositRef);
            if (!depositDoc.exists) throw new Error("Deposit request document not found.");

            const depositData = depositDoc.data();
            // This check is crucial to prevent processing a request twice.
            if (depositData.status !== 'pending') throw new Error(`Request has already been processed with status: ${depositData.status}.`);

            const { uid, amount } = depositData;
            if (!uid || typeof amount !== 'number' || amount <= 0) {
                throw new Error("Request is missing 'uid' or has an invalid 'amount'.");
            }

            // Find the user's funds document.
            const fundsQuery = db.collection('funds').where('uid', '==', uid).limit(1);
            const fundsSnapshot = await t.get(fundsQuery);

            let fundsDocRef;
            let balanceBefore = 0;

            // ✨ IMPROVEMENT: Handle new users correctly.
            if (fundsSnapshot.empty) {
                // If the user has no funds doc, create a reference for a new one.
                fundsDocRef = db.collection('funds').doc();
            } else {
                // If it exists, get the reference and current balance.
                fundsDocRef = fundsSnapshot.docs[0].ref;
                balanceBefore = fundsSnapshot.docs[0].data().balance || 0;
            }

            const balanceAfter = balanceBefore + amount;

            // Create the transaction log.
            const logRef = db.collection('funds_transactions').doc();
            t.set(logRef, {
                uid,
                amount,
                balanceBefore,
                balanceAfter,
                type: 'credit',
                reason: `Deposit Approved - Ref: ${requestId}`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            // ✨ IMPROVEMENT: Create or update the funds document.
            if (fundsSnapshot.empty) {
                // If creating a new funds doc, use t.set().
                t.set(fundsDocRef, {
                    uid,
                    balance: balanceAfter,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                // ✅ FIX: Use the safer atomic increment operator for existing docs.
                t.update(fundsDocRef, {
                    balance: admin.firestore.FieldValue.increment(amount),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            // Finally, update the original deposit request's status.
            t.update(depositRef, {
                status: 'approved',
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        return { success: true, message: 'Request approved and funds added successfully.' };
    } catch (error) {
        console.error("Fund request approval transaction failed: ", error);
        throw new Error(`Failed to approve request: ${error.message}`);
    }
};

/**
 * Updates the status of a withdrawal request.
 * - If approved, only the status is changed.
 * - If rejected, the status is changed AND the funds are atomically returned to the user's balance.
 * - The function will not run if the request is already processed.
 * @param {object} params - The parameters for the function.
 * @param {string} params.requestId - The ID of the 'withdrawl' document to update.
 * @param {'approved' | 'rejected'} params.newStatus - The new status to set.
 * @returns {Promise<{success: boolean, message: string}>} A promise that resolves on completion.
 */
export const updateWithdrawalRequestStatus = async ({ requestId, newStatus }) => {
    if (!requestId) throw new Error("updateWithdrawalRequestStatus(): requestId is required.");
    if (newStatus !== 'approved' && newStatus !== 'rejected' && newStatus !== 'declined') throw new Error("Invalid status. Must be 'approved' or 'rejected'.");

    const withdrawlRef = db.collection('withdrawl').doc(requestId);

    try {
        // STEP 1: Read the document first to ensure it's in a 'pending' state.
        // This makes the entire operation idempotent.
        const withdrawlDoc = await withdrawlRef.get();
        if (!withdrawlDoc.exists) throw new Error("Withdrawal request document not found.");

        const withdrawlData = withdrawlDoc.data();
        if (withdrawlData.status !== 'pending') {
            throw new Error(`Request has already been processed with status: ${withdrawlData.status}.`);
        }

        // STEP 2: Handle the 'approved' case.
        if (newStatus === 'approved') {
            // On approval, we only update the status. No fund modification.
            await withdrawlRef.update({
                status: 'approved',
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, message: 'Withdrawal request approved successfully.' };
        }

        // STEP 3: Handle the 'rejected' case, which requires a transaction to return funds.
        if (newStatus === 'rejected' || newStatus === 'declined') {
            const { uid, amount } = withdrawlData;
            if (!uid || typeof amount !== 'number' || amount <= 0) {
                throw new Error("Request is missing 'uid' or has an invalid 'amount'.");
            }

            // This is a critical operation, so we use a transaction.
            await db.runTransaction(async (t) => {
                const fundsQuery = db.collection('funds').where('uid', '==', uid).limit(1);
                const fundsSnapshot = await t.get(fundsQuery);

                if (fundsSnapshot.empty) {
                    // This case is unlikely for a withdrawal but included for safety.
                    throw new Error(`Cannot return funds: Funds document for user ${uid} not found.`);
                }

                const fundsDocRef = fundsSnapshot.docs[0].ref;
                const balanceBefore = fundsSnapshot.docs[0].data().balance || 0;
                const balanceAfter = balanceBefore + amount;

                // Create a transaction log for the credit reversal.
                const logRef = db.collection('funds_transactions').doc();
                t.set(logRef, {
                    uid,
                    amount,
                    balanceBefore,
                    balanceAfter,
                    type: 'credit',
                    reason: `Withdrawal Rejected - Funds Returned (Ref: ${requestId})`,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });

                // Atomically add the funds back to the user's account.
                t.update(fundsDocRef, {
                    balance: admin.firestore.FieldValue.increment(amount),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                // Update the original withdrawal request's status.
                t.update(withdrawlRef, {
                    status: 'rejected',
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            return { success: true, message: 'Request rejected and funds returned to user successfully.' };
        }

    } catch (error) {
        console.error("Withdrawal status update failed: ", error);
        throw new Error(`Failed to update withdrawal request: ${error.message}`);
    }
};

/**
 * Atomically updates a user's balance and creates a transaction log using FieldValue.increment().
 * This is the recommended and safer way to handle atomic counter updates.
 */
export const updateUserBalance = async ({ uid, amount, reason }) => {
    if (!uid) throw new Error("updateUserBalance(): uid is required.");
    if (typeof amount !== 'number' || amount === 0) throw new Error("Amount must be a non-zero number.");
    if (!reason) throw new Error("A reason for the transaction is required.");

    const fundsQuery = db.collection('funds').where('uid', '==', uid).limit(1);

    try {
        await db.runTransaction(async (t) => {
            const fundsSnapshot = await t.get(fundsQuery);

            let fundsDocRef;
            let balanceBefore = 0; // Default to 0 for a new document

            if (fundsSnapshot.empty) {
                // If the user's fund document doesn't exist, we'll create it.
                if (amount < 0) {
                    throw new Error("Cannot create a new funds account with a negative balance.");
                }
                fundsDocRef = db.collection('funds').doc(); // Ref for the new doc
            } else {
                // If the document exists, get its reference and current balance.
                fundsDocRef = fundsSnapshot.docs[0].ref;
                balanceBefore = fundsSnapshot.docs[0].data().balance || 0;
            }

            const balanceAfter = balanceBefore + amount;

            // Still perform the check for insufficient funds before committing.
            if (balanceAfter < 0) {
                throw new Error(`Insufficient funds. Current balance is ${balanceBefore}, tried to debit ${Math.abs(amount)}.`);
            }

            // Create the transaction log (this logic remains the same)
            const logRef = db.collection('funds_transactions').doc();
            t.set(logRef, {
                uid,
                amount: Math.abs(amount),
                balanceBefore,
                balanceAfter,
                type: amount > 0 ? 'credit' : 'debit',
                reason,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Atomically create or update the funds document.
            if (fundsSnapshot.empty) {
                // If creating, set the initial document structure.
                t.set(fundsDocRef, {
                    uid,
                    balance: balanceAfter, // Set the initial balance directly
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                // If updating, use the atomic increment operator.
                t.update(fundsDocRef, {
                    balance: admin.firestore.FieldValue.increment(amount), // ✅ THE FIX
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        });

        return { success: true, message: `Balance updated successfully.` };
    } catch (error) {
        console.error("Update balance transaction failed:", error);
        throw new Error(`Failed to update balance: ${error.message}`);
    }
};

/**
 * Gets all withdrawal requests for a specific user, ordered by most recent.
 * @param {object} params - The parameters for the function.
 * @param {string} params.uuid - The user's UID to fetch withdrawal requests for.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of withdrawal request objects.
 */
export const getDepositRequestsForUser = async ({ uuid }) => {
    if (!uuid) {
        throw new Error("getDepositRequestsForUser(): uuid is required");
    }

    const q = db.collection(DEPOSITS_COLLECTION)
        .where("uid", "==", uuid)
        .orderBy("createdAt", "desc"); // Use createdAt for consistent ordering

    const snapshot = await q.get();
    if (snapshot.empty) {
        return [];
    }

    const deposits = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data }
    });

    return deposits;
};