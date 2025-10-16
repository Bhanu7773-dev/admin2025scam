import { db, admin } from "../plugins/firebase.js";

const STARLINE_GAMES = db.collection("starline_games");
const STARLINE_RESULTS_COLLECTION = "starline-results";

/**
 * Declares or updates a result for a Starline game on a specific date.
 * This function is idempotent: running it multiple times for the same game and date will only update the existing record.
 * @param {object} params - The parameters for the result declaration.
 * @param {string} params.gameId - The unique ID of the game (e.g., 'kalyan-morning-starline').
 * @param {string} params.gameTitle - The display name of the game (e.g., 'KALYAN MORNING').
 * @param {string} params.openingPanna - The 3-digit opening panna result (e.g., '142').
 * @param {string} params.declarationDate - The date of the result in 'YYYY-MM-DD' format.
 * @returns {Promise<{success: boolean, message: string, docId: string}>} A promise resolving with the operation result.
 */
export const declareStarlineResult = async ({ gameId, gameTitle, openingPanna, declarationDate }) => {
    // Validate the inputs
    if (!gameId || !gameTitle || !openingPanna || !declarationDate) {
        throw new Error("Missing required fields: gameId, gameTitle, openingPanna, and declarationDate are all required.");
    }
    if (!/^\d{3}$/.test(openingPanna)) {
        throw new Error("Invalid format for openingPanna. It must be a 3-digit string.");
    }

    // Create a predictable document ID to ensure idempotency (update if exists, create if not).
    const docId = `${declarationDate}_${gameId}`;
    const resultDocRef = db.collection(STARLINE_RESULTS_COLLECTION).doc(docId);

    const resultData = {
        gameId,
        gameTitle,
        openingPanna,
        declarationDate,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
        // Use set with { merge: true } to create or update the document.
        await resultDocRef.set(resultData, { merge: true });
        return {
            success: true,
            message: `Result for ${gameTitle} on ${declarationDate} has been successfully declared.`,
            docId: docId,
        };
    } catch (error) {
        console.error("Error declaring Starline result:", error);
        throw new Error("Failed to declare the result in the database.");
    }
};

/**
 * Fetches Starline game results based on optional filters.
 * @param {object} [filters={}] - Optional filters to apply.
 * @param {string} [filters.date] - The date to fetch results for, in 'YYYY-MM-DD' format.
 * @param {string} [filters.gameId] - The specific game ID to fetch the result for.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of result objects.
 */
export const getStarlineResults = async ({ date, gameId } = {}) => {
    try {
        let query = db.collection(STARLINE_RESULTS_COLLECTION).orderBy("lastUpdated", "desc");

        // Apply filters if they are provided
        if (date) {
            query = query.where("declarationDate", "==", date);
        }
        if (gameId) {
            query = query.where("gameId", "==", gameId);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            return [];
        }

        // Map the documents to a clean array of objects
        const results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return results;
    } catch (error) {
        console.error("Error fetching Starline results:", error);
        throw new Error("Failed to fetch results from the database.");
    }
};

/**
 * Adds a new game document to the 'starline_games' collection.
 * @param {object} gameData - The game data to add.
 * @param {string} gameData.game_name - The name of the game.
 * @param {string} gameData.game_name_hindi - The Hindi name of the game.
 * @param {string} gameData.close_time - The opening time (e.g., "10:00").
 * @param {'0' | '1'} gameData.game_status - The active status of the game ('0' for inactive, '1' for active).
 * @returns {Promise<string>} The ID of the newly created document.
 */
export const addGame = async ({ game_name, game_name_hindi, close_time, game_status }) => {
    try {
        const docRef = await STARLINE_GAMES.add({
            game_name: game_name,
            game_name_hindi: game_name_hindi,
            close_time: close_time,
            game_status: game_status,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log("Game added successfully with ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Error adding game: ", error);
        throw new Error("Failed to add game.");
    }
};

/**
 * Retrieves all games from the 'starline_games' collection, ordered by open time.
 * @returns {Promise<Array<object>>} An array of game objects, each including its document ID.
 */
export const getGames = async () => {
    try {
        const snapshot = await STARLINE_GAMES.orderBy("close_time", "asc").get();
        if (snapshot.empty) {
            console.log("No games found.");
            return [];
        }
        
        const games = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));
        
        return games;
    } catch (error) {
        console.error("Error getting games: ", error);
        throw new Error("Failed to fetch games.");
    }
};

/**
 * Updates an existing game document in the 'starline_games' collection.
 * @param {string} gameId - The ID of the game document to update.
 * @param {object} updatedData - An object containing the fields to update.
 * @returns {Promise<void>}
 */
export const updateGame = async (gameId, updatedData) => {
    if (!gameId) {
        throw new Error("Game ID is required for updates.");
    }
    try {
        const gameRef = STARLINE_GAMES.doc(gameId);
        await gameRef.update({
            ...updatedData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log("Game updated successfully:", gameId);
    } catch (error) {
        console.error("Error updating game: ", error);
        throw new Error("Failed to update game.");
    }
};

/**
 * Deletes a game document from the 'starline_games' collection.
 * @param {string} gameId - The ID of the game document to delete.
 * @returns {Promise<void>}
 */
export const deleteGame = async (gameId) => {
    if (!gameId) {
        throw new Error("Game ID is required for deletion.");
    }
    try {
        await STARLINE_GAMES.doc(gameId).delete();
        console.log("Game deleted successfully:", gameId);
    } catch (error) {
        console.error("Error deleting game: ", error);
        throw new Error("Failed to delete game.");
    }
};