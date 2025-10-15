import { db, admin } from "../plugins/firebase.js";

const DEPOSITS_COLLECTION = "deposits";

/**
 * Helper to batch an array into smaller chunks.
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
 */
const _fetchUserInfoByUids = async (uids) => {
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
 * Fetches all withdrawal requests and enriches them with user information.
 */
export const getAllWithdrawals = async () => {
    const withdrawlSnapshot = await db.collection("withdrawl").orderBy("createdAt", "desc").get();
    if (withdrawlSnapshot.empty) {
        return { fund_withdrawl: [] };
    }

    const withdrawDocs = withdrawlSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const uids = [...new Set(withdrawDocs.map(doc => doc.uid).filter(Boolean))];
    const userInfoMap = await _fetchUserInfoByUids(uids);

    const fundWithdrawals = withdrawDocs.map(data => {
        const info = userInfoMap.get(data.uid) || { username: "User", mobile: "N/A" };
        const createdDate = data.createdAt?.toDate?.().toISOString().slice(0, 10) || null;

        return {
            id: data.id,
            username: info.username,
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
        uid: data.uid,
        balance: data.balance || 0,
        createdAt: data.createdAt?.toDate?.() || null,
        updatedAt: data.updatedAt?.toDate?.() || null,
    };
};

/**
 * Fetches and aggregates all fund requests (deposits) and withdrawals.
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
            id: d.id,
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
            id: d.id,
            index: i + 1,
            uid: d.uid,
            username: info.username,
            mobile: info.mobile,
            amount: d.amount || 0,
            requestNo: d.withdrawalId || d.id,
            upiApp: d.upiDetails.upiApp,
            upiNumber: d.upiDetails.upiNumber,
            date,
            status: d.status || "pending",
        };
    });

    const totalFundRequestAmount = fundRequests.reduce((sum, r) => sum + r.amount, 0);
    const totalFundWithdrawalAmount = fundWithdrawals.reduce((sum, r) => sum + r.amount, 0);

    return {
        fund_requests: { total_amount: totalFundRequestAmount, list: fundRequests },
        fund_withdrawals: { total_amount: totalFundWithdrawalAmount, list: fundWithdrawals },
    };
};

/**
 * Gets all fund transactions (credit/debit) for a specific user UID.
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
 * Updates the status of a fund request (deposit).
 */
export const updateFundRequestStatus = async ({ requestId, newStatus }) => {
    if (!requestId) throw new Error("updateFundRequestStatus(): requestId is required.");
    if (!['approved', 'rejected', 'declined'].includes(newStatus)) {
        throw new Error("Invalid status. Must be 'approved', 'rejected', or 'declined'.");
    }

    const depositRef = db.collection(DEPOSITS_COLLECTION).doc(requestId);

    if (newStatus === 'rejected' || newStatus === 'declined') {
        await depositRef.update({
            status: newStatus,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, message: `Request ${newStatus} successfully.` };
    }

    try {
        await db.runTransaction(async (t) => {
            const depositDoc = await t.get(depositRef);
            if (!depositDoc.exists) throw new Error("Deposit request document not found.");

            const depositData = depositDoc.data();
            if (depositData.status !== 'pending') throw new Error(`Request has already been processed with status: ${depositData.status}.`);

            const { uid, amount } = depositData;
            if (!uid || typeof amount !== 'number' || amount <= 0) {
                throw new Error("Request is missing 'uid' or has an invalid 'amount'.");
            }
            const fundsQuery = db.collection('funds').where('uid', '==', uid).limit(1);
            const fundsSnapshot = await t.get(fundsQuery);
            let fundsDocRef;
            let balanceBefore = 0;
            if (fundsSnapshot.empty) {
                fundsDocRef = db.collection('funds').doc();
            } else {
                fundsDocRef = fundsSnapshot.docs[0].ref;
                balanceBefore = fundsSnapshot.docs[0].data().balance || 0;
            }
            const balanceAfter = balanceBefore + amount;
            const logRef = db.collection('funds_transactions').doc();
            t.set(logRef, {
                uid, amount, balanceBefore, balanceAfter, type: 'credit',
                reason: `Deposit Approved - Ref: ${requestId}`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            if (fundsSnapshot.empty) {
                t.set(fundsDocRef, {
                    uid, balance: balanceAfter,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                t.update(fundsDocRef, {
                    balance: admin.firestore.FieldValue.increment(amount),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
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
 */
export const updateWithdrawalRequestStatus = async ({ requestId, newStatus }) => {
    if (!requestId) throw new Error("updateWithdrawalRequestStatus(): requestId is required.");
    if (newStatus !== 'approved' && newStatus !== 'rejected' && newStatus !== 'declined') throw new Error("Invalid status. Must be 'approved', 'rejected', or 'declined'.");

    const withdrawlRef = db.collection('withdrawl').doc(requestId);

    try {
        const withdrawlDoc = await withdrawlRef.get();
        if (!withdrawlDoc.exists) throw new Error("Withdrawal request document not found.");

        const withdrawlData = withdrawlDoc.data();
        if (withdrawlData.status !== 'pending') {
            throw new Error(`Request has already been processed with status: ${withdrawlData.status}.`);
        }

        if (newStatus === 'approved') {
            await withdrawlRef.update({
                status: 'approved',
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, message: 'Withdrawal request approved successfully.' };
        }

        if (newStatus === 'rejected' || newStatus === 'declined') {
            const { uid, amount } = withdrawlData;
            if (!uid || typeof amount !== 'number' || amount <= 0) {
                throw new Error("Request is missing 'uid' or has an invalid 'amount'.");
            }

            await db.runTransaction(async (t) => {
                const fundsQuery = db.collection('funds').where('uid', '==', uid).limit(1);
                const fundsSnapshot = await t.get(fundsQuery);

                if (fundsSnapshot.empty) {
                    throw new Error(`Cannot return funds: Funds document for user ${uid} not found.`);
                }
                
                const fundsDocRef = fundsSnapshot.docs[0].ref;
                const balanceBefore = fundsSnapshot.docs[0].data().balance || 0;
                const balanceAfter = balanceBefore + amount;

                const logRef = db.collection('funds_transactions').doc();
                t.set(logRef, {
                    uid, amount, balanceBefore, balanceAfter, type: 'credit',
                    reason: `Withdrawal Rejected - Funds Returned (Ref: ${requestId})`,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });

                t.update(fundsDocRef, {
                    balance: admin.firestore.FieldValue.increment(amount),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                t.update(withdrawlRef, {
                    status: newStatus,
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            return { success: true, message: `Request ${newStatus} and funds returned to user successfully.` };
        }
    } catch (error) {
        console.error("Withdrawal status update failed: ", error);
        throw new Error(`Failed to update withdrawal request: ${error.message}`);
    }
};

/**
 * Atomically updates a user's balance and creates a transaction log.
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
            let balanceBefore = 0;

            if (fundsSnapshot.empty) {
                if (amount < 0) {
                    throw new Error("Cannot create a new funds account with a negative balance.");
                }
                fundsDocRef = db.collection('funds').doc();
            } else {
                fundsDocRef = fundsSnapshot.docs[0].ref;
                balanceBefore = fundsSnapshot.docs[0].data().balance || 0;
            }

            const balanceAfter = balanceBefore + amount;
            if (balanceAfter < 0) {
                throw new Error(`Insufficient funds. Current balance is ${balanceBefore}, tried to process ${amount}.`);
            }

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

            if (fundsSnapshot.empty) {
                t.set(fundsDocRef, {
                    uid,
                    balance: balanceAfter,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                t.update(fundsDocRef, {
                    balance: admin.firestore.FieldValue.increment(amount),
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
 * Gets all deposit requests for a specific user.
 */
export const getDepositRequestsForUser = async ({ uuid }) => {
    if (!uuid) {
        throw new Error("getDepositRequestsForUser(): uuid is required");
    }

    const q = db.collection(DEPOSITS_COLLECTION)
        .where("uid", "==", uuid)
        .orderBy("createdAt", "desc");

    const snapshot = await q.get();
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};