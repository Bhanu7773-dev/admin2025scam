import { db, admin as firebase } from "../plugins/firebase.js";

const STARLINE_GAMES = db.collection("starline_games");

/**
 * Adds a new game document to the 'starline_games' collection.
 * @param {object} gameData - The game data to add.
 * @param {string} gameData.gameName - The name of the game.
 * @param {string} gameData.gameNameHindi - The Hindi name of the game.
 * @param {string} gameData.openTime - The opening time (e.g., "10:00").
 * @param {'0' | '1'} gameData.status - The active status of the game ('0' for inactive, '1' for active).
 * @returns {Promise<string>} The ID of the newly created document.
 */
export const addGame = async ({ gameName, gameNameHindi, openTime, status }) => {
    try {
        const docRef = await STARLINE_GAMES.add({
            games_name: gameName,
            games_name_hindi: gameNameHindi,
            closeTime: openTime,
            game_status: status,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
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
        const snapshot = await STARLINE_GAMES.orderBy("closeTime", "asc").get();
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
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
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