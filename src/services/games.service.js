import { db, admin } from "../plugins/firebase.js";

const GAMES_COLLECTION = "games";

/**
 * Fetches all active game documents from Firestore, ordered by name.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of game objects.
 */
export const getAllGames = async () => {
    const snapshot = await db.collection(GAMES_COLLECTION).orderBy("name").get();
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
* Adds a new game to the collection from a predefined master list.
* @param {object} params - The parameters for the function.
* @param {string} params.id - The unique ID of the game (e.g., 'kalyan-morning-panel-chart').
* @param {string} params.name - The original name of the game (e.g., 'KALYAN MORNING').
* @param {string} [params.openTime] - The opening time for the game (e.g., "11:00"). Can be empty.
* @param {string} [params.closeTime] - The closing time for the game (e.g., "12:00"). Can be empty.
* @returns {Promise<object>} The newly created game document.
*/
export const addGame = async ({ id, name, openTime, closeTime }) => {
    // FIX: Only require the essential ID and name.
    if (!id || !name) {
        throw new Error("Game ID and name are required.");
    }

    const docRef = db.collection(GAMES_COLLECTION).doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
        throw new Error("This game already exists in the database.");
    }

    const newGameData = {
        id,
        name,
        altName: null,
        openTime: openTime || '',
        closeTime: closeTime || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.set(newGameData);
    return newGameData;
};

/**
 * Updates a game's details, such as its alternative name or disabled status.
 * @param {object} params - The parameters for the function.
 * @param {string} params.id - The ID of the game document to update.
 * @param {object} params.data - An object with the fields to update (e.g., { altName, isDisabled }).
 * @returns {Promise<{success: boolean}>}
 */
export const updateGame = async ({ id, data }) => {
    if (!id) throw new Error("Game ID is required for an update.");
    if (!data || Object.keys(data).length === 0) throw new Error("Data to update is required.");

    const docRef = db.collection(GAMES_COLLECTION).doc(id);
    await docRef.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    return { success: true };
};

/**
 * Deletes a game from the Firestore collection.
 * @param {object} params - The parameters for the function.
 * @param {string} params.id - The ID of the game document to delete.
 * @returns {Promise<{success: boolean}>}
 */
export const deleteGame = async ({ id }) => {
    if (!id) throw new Error("Game ID is required for deletion.");
    const docRef = db.collection(GAMES_COLLECTION).doc(id);
    await docRef.delete();
    return { success: true };
};