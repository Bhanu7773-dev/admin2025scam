import { db, admin } from "../plugins/firebase.js";

const GAME_SETTINGS_COLLECTION = "starline_game_settings"
/**
 * Fetches all game rate documents and combines them into a single flat object for a form.
 * @returns {Promise<object>} A promise that resolves to a single object containing all game rates.
 */
export const getStarlineGameRates = async () => {
    const ratesSnapshot = await db.collection(GAME_SETTINGS_COLLECTION).get();
    if (ratesSnapshot.empty) {
        console.warn("No documents found in the starline_game_settings collection.");
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
export const updateStarlineGameRates = async (newRates) => {
    console.log("Received rates object from client:", newRates);
    if (!newRates || typeof newRates !== 'object') {
        throw new Error("updateStarlineGameRates(): newRates object is required.");
    }

    const batch = db.batch();
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    // Map the flat form keys to their corresponding Firestore documents and fields
    const rateMappings = [
        { docId: 'single-digit', label: 'Single Digit', minKey: 'single_digit_1', maxKey: 'single_digit_2' },
        { docId: 'single-pana', label: 'Single Pana', minKey: 'single_pana_1', maxKey: 'single_pana_2' },
        { docId: 'double-pana', label: 'Double Pana', minKey: 'double_pana_1', maxKey: 'double_pana_2' },
        { docId: 'triple-pana', label: 'Triple Pana', minKey: 'triple_pana_1', maxKey: 'triple_pana_2' },
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
        return { success: true, message: "Starline Game rates updated successfully." };
    } catch (error) {
        console.error("Error committing starline game rates batch:", error);
        throw new Error("Failed to update starline game rates.");
    }
};
