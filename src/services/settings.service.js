import { db, admin } from "../plugins/firebase.js";

const SETTINGS_COLLECTION = "app_settings";
const GAME_SETTINGS_COLLECTION = "game_settings";

/**
 * Fetches all individual setting documents and combines them into a single object.
 * This provides a simple, flat structure for the client-side state.
 * @returns {Promise<object>} A promise that resolves to a single object containing all app settings.
 */
export const getSettings = async () => {
    // 1. Define the main setting documents
    const settingDocs = [
        'maintenance',
        'min_withdrawal',
        'support',
        'upi',
        'website',
        'market_time',
        'marquee'
    ];
    const mainDocRefs = settingDocs.map(docId => db.collection(SETTINGS_COLLECTION).doc(docId));

    // 2. Define the separate share link document reference
    const shareDocRef = db.collection("sharelink").doc("main");

    // 3. Fetch all documents in parallel using Promise.all
    const [mainDocSnaps, shareDocSnap] = await Promise.all([
        db.getAll(...mainDocRefs),
        shareDocRef.get()
    ]);

    // 4. Process the main settings
    const combinedSettings = {};
    mainDocSnaps.forEach(doc => {
        if (doc.exists) {
            Object.assign(combinedSettings, doc.data());
        } else {
            console.warn(`Settings document "${doc.id}" was not found.`);
        }
    });

    // 5. Process and add the share link setting
    if (shareDocSnap.exists) {
        // Map the 'url' field from Firestore to the 'shareLink' key for the client
        combinedSettings.shareLink = shareDocSnap.data().url;
    } else {
        console.warn(`Share link document "main" was not found.`);
    }

    return combinedSettings;
};


/**
 * Updates multiple setting documents in a single atomic transaction.
 * It dynamically builds the update payload, only including fields that are present in the request body.
 * @param {object} newSettings - A flat object containing the settings to be updated.
 * @returns {Promise<{success: boolean, message: string}>} A promise that resolves on completion.
 */
export const updateSettings = async (newSettings) => {
    if (!newSettings || typeof newSettings !== 'object') {
        throw new Error("updateSettings(): newSettings object is required.");
    }

    const batch = db.batch();
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    // Helper function to create an update object only with defined fields
    const createUpdateObject = (fields) => {
        const updateData = {};
        for (const key in fields) {
            if (fields[key] !== undefined) {
                updateData[key] = fields[key];
            }
        }
        return updateData;
    };

    // 1. Maintenance Settings
    const maintenanceData = createUpdateObject({
        isUnderMaintenance: newSettings.isUnderMaintenance,
        description: newSettings.description,
    });
    if (Object.keys(maintenanceData).length > 0) {
        maintenanceData.lastUpdated = serverTimestamp;
        batch.set(db.collection(SETTINGS_COLLECTION).doc('maintenance'), maintenanceData, { merge: true });
    }

    // 2. Minimum Withdrawal Setting
    if (newSettings.amount !== undefined) {
        const minWithdrawalData = {
            amount: Number(newSettings.amount) || 0,
            lastUpdated: serverTimestamp
        };
        batch.set(db.collection(SETTINGS_COLLECTION).doc('min_withdrawal'), minWithdrawalData, { merge: true });
    }

    // 3. Support Contact Settings
    const supportData = createUpdateObject({
        phone: newSettings.phone,
        display_phone1: newSettings.display_phone1,
        display_phone2: newSettings.display_phone2,
    });
    if (Object.keys(supportData).length > 0) {
        supportData.lastUpdated = serverTimestamp;
        batch.set(db.collection(SETTINGS_COLLECTION).doc('support'), supportData, { merge: true });
    }

    // 4. UPI QR Code Setting
    const upiData = createUpdateObject({
        qr_code_base64: newSettings.qr_code_base64,
        upi_id: newSettings.upi_id
    });
    if (Object.keys(upiData).length > 0) {
        upiData.lastUpdated = serverTimestamp;
        batch.set(db.collection(SETTINGS_COLLECTION).doc('upi'), upiData, { merge: true });
    }

    // 5. Website URL Setting
    if (newSettings.url !== undefined) {
        const websiteData = {
            url: newSettings.url,
            lastUpdated: serverTimestamp
        };
        batch.set(db.collection(SETTINGS_COLLECTION).doc('website'), websiteData, { merge: true });
    }

    // 6. Share Link Setting
    const shareData = createUpdateObject({
        url: newSettings.shareLink,
        content: newSettings.content
    });
    if (Object.keys(shareData).length > 0) {
        shareData.updatedAt = serverTimestamp;
        batch.set(db.collection("sharelink").doc("main"), shareData, { merge: true });
    }

    // 7. Market Time Setting
    if (newSettings.time !== undefined) {
        const marketTimeData = {
            time: newSettings.time,
            lastUpdated: serverTimestamp
        };
        batch.set(db.collection(SETTINGS_COLLECTION).doc("market_time"), marketTimeData, { merge: true });
    }
    
    // 8. Marquee Setting
    if (newSettings.marquee !== undefined) {
        const marqueeData = {
            text: newSettings.marquee,
            lastUpdated: serverTimestamp
        };
        batch.set(db.collection(SETTINGS_COLLECTION).doc("marquee"), marqueeData, { merge: true });
    }

    try {
        await batch.commit();
        return { success: true, message: "Settings updated successfully." };
    } catch (error) {
        console.error("Error committing settings batch:", error);
        throw new Error("Failed to update one or more settings.");
    }
};


// ===================================================================
// == NEW FUNCTIONS FOR GAME RATES ==
// ===================================================================

/**
 * Fetches all game rate documents and combines them into a single flat object for a form.
 * @returns {Promise<object>} A promise that resolves to a single object containing all game rates.
 */
export const getGameRates = async () => {
    const ratesSnapshot = await db.collection(GAME_SETTINGS_COLLECTION).get();
    if (ratesSnapshot.empty) {
        console.warn("No documents found in the game_settings collection.");
        return {};
    }

    const combinedRates = {};
    ratesSnapshot.forEach(doc => {
        const data = doc.data();
        // Create flat keys like 'single_digit_1' and 'single_digit_2' for the form
        const keyPrefix = doc.id.replace(/-/g, '_');
        combinedRates[`${keyPrefix}_1`] = data.min_value;
        combinedRates[`${keyPrefix}_2`] = data.max_value;
    });

    return combinedRates;
};

/**
 * Updates or creates all game rate documents in a single atomic transaction.
 * @param {object} newRates - A flat object with keys like 'single_digit_1', 'single_digit_2', etc.
 * @returns {Promise<{success: boolean, message: string}>} A promise that resolves on completion.
 */
export const updateGameRates = async (newRates) => {
    if (!newRates || typeof newRates !== 'object') {
        throw new Error("updateGameRates(): newRates object is required.");
    }

    const batch = db.batch();
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    // Map the flat form keys to their corresponding Firestore documents and fields
    const rateMappings = [
        { docId: 'single-digits', label: 'Single Digits', minKey: 'single_digits_1', maxKey: 'single_digits_2' },
        { docId: 'jodi-digit', label: 'Jodi Digit', minKey: 'jodi_digit_1', maxKey: 'jodi_digit_2' },
        { docId: 'single-pana', label: 'Single Pana', minKey: 'single_pana_1', maxKey: 'single_pana_2' },
        { docId: 'double-pana', label: 'Double Pana', minKey: 'double_pana_1', maxKey: 'double_pana_2' },
        { docId: 'triple-pana', label: 'Triple Pana', minKey: 'triple_pana_1', maxKey: 'triple_pana_2' },
        { docId: 'half-sangam', label: 'Half Sangam', minKey: 'half_sangam_1', maxKey: 'half_sangam_2' },
        { docId: 'full-sangam', label: 'Full Sangam', minKey: 'full_sangam_1', maxKey: 'full_sangam_2' },
    ];

    rateMappings.forEach(mapping => {
        // Check if the keys exist in the input object to avoid errors
        if (mapping.minKey in newRates && mapping.maxKey in newRates) {
            const docRef = db.collection(GAME_SETTINGS_COLLECTION).doc(mapping.docId);
            const rateData = {
                type: mapping.label,
                min_value: Number(newRates[mapping.minKey]) || 0,
                max_value: Number(newRates[mapping.maxKey]) || 0,
                lastUpdated: serverTimestamp
            };
            // Use set() which will create the document if it doesn't exist, or overwrite it if it does.
            batch.set(docRef, rateData);
        }
    });

    try {
        await batch.commit();
        return { success: true, message: "Game rates updated successfully." };
    } catch (error) {
        console.error("Error committing game rates batch:", error);
        throw new Error("Failed to update game rates.");
    }
};