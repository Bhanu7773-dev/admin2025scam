import { db, admin } from "../plugins/firebase.js";

const USERS_COLLECTION = "users";
const FUNDS_COLLECTION = "funds";
const GAME_SUBMISSIONS_COLLECTION = "game_submissions";
const WITHDRAWL_COLLECTION = "withdrawl";

/**
 * Helper to batch an array into smaller chunks.
 * @param {Array<any>} arr The array to chunk.
 * @param {number} size The size of each chunk.
 * @returns {Array<Array<any>>}
 */
const _chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
};

/**
 * Private helper to fetch Firebase Auth records for a list of UIDs.
 * @param {string[]} uids An array of user UIDs.
 * @returns {Promise<Map<string, object>>}
 */
const _fetchAuthInfoByUids = async (uids) => {
    const authMap = new Map();
    if (!uids?.length) return authMap;

    for (const chunk of _chunkArray(uids, 100)) {
        try {
            const userRecords = await admin.auth().getUsers(chunk.map(uid => ({ uid })));
            for (const userRecord of userRecords.users) {
                const email = userRecord.email || "";
                const phone = email.includes("@") ? email.split("@")[0] : (userRecord.phoneNumber || "N/A");
                authMap.set(userRecord.uid, {
                    username: userRecord.displayName || "User",
                    email,
                    mobile: phone,
                    status: userRecord.disabled ? 'inactive' : 'active',
                });
            }
        } catch (error) {
            console.error("Error fetching a batch of user auth records:", error);
        }
    }
    return authMap;
};

/**
 * Creates a new user with full administrator privileges.
 * @param {object} adminData - The data for the new admin.
 * @param {string} adminData.name - The admin's full name.
 * @param {string} adminData.phone - The admin's phone number.
 * @param {string} adminData.password - The admin's password.
 * @param {string} adminData.username - The admin's display/user name.
 * @returns {Promise<object>} The newly created admin user document.
 */
export const createAdmin = async (adminData) => {
    const { name, phone, password, username } = adminData;
    const email = `${phone}@sara777.com`;

    let userRecord;
    try {
        userRecord = await admin.auth().createUser({ email, password, displayName: username });
    } catch (error) {
        if (error.code === 'auth/email-already-exists') throw new Error("An admin with this phone number already exists.");
        throw new Error(`Failed to create admin in Firebase Auth: ${error.message}`);
    }

    const { uid } = userRecord;

    try {
        const userDocRef = db.collection(USERS_COLLECTION).doc(uid);
        const fundsDocRef = db.collection(FUNDS_COLLECTION).doc();

        const adminDataForFirestore = {
            uid, username, name,
            isAdmin: true,
            isSubAdmin: false,
            mpin: Math.floor(1000 + Math.random() * 9000).toString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const fundsDataForFirestore = {
            uid, balance: 0, createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const batch = db.batch();
        batch.set(userDocRef, adminDataForFirestore);
        batch.set(fundsDocRef, fundsDataForFirestore);
        await batch.commit();

        return adminDataForFirestore;
    } catch (error) {
        await admin.auth().deleteUser(uid);
        console.error("Firestore write failed for admin, rolling back Auth user.", error);
        throw new Error("Failed to save admin data to the database.");
    }
};

/**
 * Creates a new user in Firebase Auth and corresponding Firestore documents.
 * @param {object} userData The data for the new user.
 * @returns {Promise<object>} The newly created user document.
 */
export const createUser = async (userData) => {
    const { name, phone, password, username, isSubAdmin = false } = userData;
    const email = `${phone}@sara777.com`;

    let userRecord;
    try {
        userRecord = await admin.auth().createUser({ email, password, displayName: username });
    } catch (error) {
        if (error.code === 'auth/email-already-exists') throw new Error("A user with this phone number already exists.");
        throw new Error(`Failed to create user in Firebase Auth: ${error.message}`);
    }

    const { uid } = userRecord;

    try {
        const userDocRef = db.collection(USERS_COLLECTION).doc(uid);
        const fundsDocRef = db.collection(FUNDS_COLLECTION).doc();

        const userDataForFirestore = {
            uid, username, name, isSubAdmin,
            isAdmin: false,
            mpin: Math.floor(1000 + Math.random() * 9000).toString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const fundsDataForFirestore = {
            uid, balance: 0, createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const batch = db.batch();
        batch.set(userDocRef, userDataForFirestore);
        batch.set(fundsDocRef, fundsDataForFirestore);
        await batch.commit();

        return userDataForFirestore;
    } catch (error) {
        await admin.auth().deleteUser(uid);
        console.error("Firestore write failed, rolling back Auth user creation.", error);
        throw new Error("Failed to save user data to the database.");
    }
};

/**
 * Fetches a paginated list of users with their balance and status flags.
 * @param {object} [options={}] Options for fetching users.
 * @returns {Promise<{users: Array<object>, nextCursor: string|null}>}
 */
export const getAllUsers = async ({ includeSubAdmins = false, limit = 20, startAfterId } = {}) => {
    let query = db.collection(USERS_COLLECTION)
        .orderBy("createdAt", "desc")
        .limit(limit);

    // 🔹 Only apply filter when includeSubAdmins = true
    if (includeSubAdmins) {
        query = query.where("isSubAdmin", "==", true);
    }

    if (startAfterId) {
        const lastDoc = await db.collection(USERS_COLLECTION).doc(startAfterId).get();
        if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) return { users: [], nextCursor: null };

    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const uids = users.map(u => u.uid).filter(Boolean);
    if (!uids.length) return { users: [], nextCursor: null };

    const [authMap, fundsMap, bettingMap, transferMap] = await Promise.all([
        _fetchAuthInfoByUids(uids),
        db.collection(FUNDS_COLLECTION).where("uid", "in", uids).get(),
        db.collection(GAME_SUBMISSIONS_COLLECTION).where("uid", "in", uids).where("status", "==", "pending").get(),
        db.collection(WITHDRAWL_COLLECTION).where("uid", "in", uids).where("status", "==", "pending").get(),
    ]);

    const fundsData = new Map(fundsMap.docs.map(doc => [doc.data().uid, doc.data().balance || 0]));
    const bettingData = new Set(bettingMap.docs.map(doc => doc.data().uid));
    const transferData = new Set(transferMap.docs.map(doc => doc.data().uid));

    const results = users
        .filter(u => authMap.has(u.uid))
        .map(u => {
            const auth = authMap.get(u.uid);
            const createdAt = u.createdAt?._seconds
                ? new Date(u.createdAt._seconds * 1000).toISOString().split("T")[0]
                : null;

            return {
                id: u.id,
                uid: u.uid,
                username: auth.username || "User",
                name: u.name || auth.username || "User",
                mobile: auth.mobile || "N/A",
                email: auth.email || "",
                date: createdAt,
                balance: fundsData.get(u.uid) || 0,
                betting: bettingData.has(u.uid),
                transfer: transferData.has(u.uid),
                status: auth.status,
                isSubAdmin: u.isSubAdmin === true,
            };
        });

    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    return { users: results, nextCursor: lastVisible ? lastVisible.id : null };
};



/**
 * Fetches a single user's details from Firestore and their email from Firebase Auth.
 * @param {string} uid The user's Authentication UID.
 * @returns {Promise<object|null>} The combined user object with balance and email, or null if not found.
 */
export const getUser = async (uid) => {
    if (!uid) {
        throw new Error("getUser(): uid is required");
    }

    try {
        // Fetch Firestore user doc, funds doc, and Auth record in parallel for efficiency
        const [userDocSnap, fundsSnap, authRecord] = await Promise.all([
            db.collection(USERS_COLLECTION).doc(uid).get(),
            db.collection(FUNDS_COLLECTION).where("uid", "==", uid).limit(1).get(),
            admin.auth().getUser(uid)
        ]);

        // If the primary user document in Firestore doesn't exist, the user is considered not found.
        if (!userDocSnap.exists) {
            return null;
        }

        const userData = { id: userDocSnap.id, ...userDocSnap.data() };
        
        // Extract balance from the funds document
        const balance = fundsSnap.empty ? 0 : fundsSnap.docs[0].data().balance || 0;

        // Extract email and derive the mobile number from the Auth record
        const email = authRecord.email || "";
        const mobile = email.includes("@") ? email.split("@")[0] : (authRecord.phoneNumber || "N/A");

        // Combine all data into a single, comprehensive user object
        return {
            ...userData,
            balance,
            mobile
        };
    } catch (error) {
        console.error(`Error fetching user data for UID ${uid}:`, error);
        // If any of the fetches fail (e.g., user not in Auth), return null.
        return null;
    }
};

/**
 * Toggles a user's status (active/inactive) in Firebase Authentication.
 * @param {object} params The parameters for the function.
 * @param {string} params.uid The user's Authentication UID.
 * @returns {Promise<{success: boolean, newStatus: string}>} The result of the operation.
 */
export const updateUserStatus = async ({ uuid }) => {
    if (!uuid) throw new Error("updateUserStatus(): uuid is required.");

    const userRecord = await admin.auth().getUser(uuid);
    const newDisabledState = !userRecord.disabled;

    await admin.auth().updateUser(uuid, { disabled: newDisabledState });

    return { success: true, newStatus: newDisabledState ? 'inactive' : 'active' };
};

/**
 * Updates a user's details in both Firebase Auth (for display name) and Firestore.
 * This is a flexible function that accepts any fields present in the Firestore 'users' document.
 * @param {object} params - The parameters for the function.
 * @param {string} params.uid - The UID of the user to update.
 * @param {object} params.data - The data to update (e.g., { name, username, mpin, isSubAdmin }).
 * @returns {Promise<{success: boolean, updatedData: object}>} A promise resolving with the update status and data.
 */
export const updateUser = async ({ uid, data }) => {
    if (!uid) throw new Error("updateUser(): uid is required.");
    if (!data || Object.keys(data).length === 0) throw new Error("updateUser(): data object with fields to update is required.");

    const userDocRef = db.collection(USERS_COLLECTION).doc(uid);

    // Any field in the data object that is not 'username' will be treated as a Firestore field.
    const firestoreUpdates = { ...data };
    const authUpdates = {};

    // If 'username' is being updated, it maps to 'displayName' in Firebase Auth.
    if (data.username) {
        authUpdates.displayName = data.username;
    }

    // You can add other Auth-specific fields here if needed, e.g., 'email' or 'photoURL'.
    // delete firestoreUpdates.email; // Prevent trying to write 'email' to Firestore if it's an Auth-only field.

    await Promise.all([
        Object.keys(authUpdates).length > 0 ? admin.auth().updateUser(uid, authUpdates) : Promise.resolve(),
        Object.keys(firestoreUpdates).length > 0 ? userDocRef.update(firestoreUpdates) : Promise.resolve(),
    ]);

    return { success: true, updatedData: data };
};

/**
 * Updates a user's password in Firebase Authentication.
 * This is a separate function for security and clarity.
 * @param {object} params - The parameters for the function.
 * @param {string} params.uid - The UID of the user whose password will be changed.
 * @param {string} params.password - The new password (must be at least 6 characters).
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const updateUserPassword = async ({ uid, password }) => {
    if (!uid) throw new Error("updateUserPassword(): uid is required.");
    if (!password || password.length < 6) throw new Error("Password must be at least 6 characters long.");

    await admin.auth().updateUser(uid, { password });

    return { success: true, message: "User password updated successfully." };
};

/**
 * Deletes a user from Firebase Auth and all associated Firestore documents.
 * @param {object} params - The parameters for the function.
 * @param {string} params.uid - The UID of the user to delete.
 * @returns {Promise<{success: boolean, message: string}>} A promise resolving on completion.
 */
export const deleteUser = async ({ uid }) => {
    if (!uid) throw new Error("deleteUser(): uid is required.");

    await admin.auth().deleteUser(uid);

    const batch = db.batch();
    const userDocRef = db.collection(USERS_COLLECTION).doc(uid);
    batch.delete(userDocRef);

    const fundsQuery = db.collection(FUNDS_COLLECTION).where("uid", "==", uid).limit(1);
    const fundsSnapshot = await fundsQuery.get();
    if (!fundsSnapshot.empty) {
        batch.delete(fundsSnapshot.docs[0].ref);
    }

    await batch.commit();

    return { success: true, message: `User ${uid} deleted successfully.` };
};