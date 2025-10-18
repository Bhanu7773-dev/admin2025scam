import { db, admin } from "../plugins/firebase.js";
import { getJackpotGameRates } from "./jackpot.settings.service.js";

const JACKPOT_GAMES = db.collection("jackpot_games");
const JACKPOT_RESULTS_COLLECTION = "jackpot-results";
const GAME_SUBMISSIONS_COLLECTION = "game_submissions";
const FUNDS_COLLECTION = "funds";
const FUNDS_TRANSACTIONS_COLLECTION = "funds_transactions";

/**
 * Calculates the single-digits "Ank" from a 2-digit "Jodi" string.
 */
const _sumDigits = (jodiStr) => {
    if (!jodiStr || jodiStr.length !== 2) return '';
    const sum = String(jodiStr).split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0);
    return String(sum % 10);
};

/**
 * Declares a Jackpot game result, processes all pending bids, and updates user balances for winners.
 */
export const declareJackpotResult = async ({ gameId, gameTitle, jodi, declarationDate }) => {
    if (!gameId || !gameTitle || !jodi || !declarationDate) {
        throw new Error("Missing required fields: gameId, gameTitle, jodi, and declarationDate.");
    }
    if (!/^\d{2}$/.test(jodi)) {
        throw new Error("Invalid format for jodi. It must be a 3-digit string.");
    }

    const docId = `${declarationDate}_${gameId}`;
    const resultDocRef = db.collection(JACKPOT_RESULTS_COLLECTION).doc(docId);
    await resultDocRef.set({ gameId, gameTitle, jodi, declarationDate, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    const startDate = new Date(declarationDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(declarationDate);
    endDate.setHours(23, 59, 59, 999);

    const [rates, bidsSnapshot] = await Promise.all([
        getJackpotGameRates(),
        db.collection(GAME_SUBMISSIONS_COLLECTION)
            .where("isJackpot", "==", true)
            .where("status", "==", "pending")
            .where("title", "==", gameTitle)
            .where("createdAt", ">=", startDate)
            .where("createdAt", "<=", endDate)
            .get()
    ]);

    if (bidsSnapshot.empty) {
        return { success: true, message: `Result declared for ${gameTitle}. No pending bids found to process.` };
    }

    const batch = db.batch();
    const winningsByUser = new Map();

    bidsSnapshot.docs.forEach(doc => {
        const bid = { id: doc.id, ...doc.data() };
        console.log(bid)
        let isWinner = false;

        switch (bid.gameType) {
            case "Jodi":
                const answer = String(bid.answer).trim();
                isWinner = jodi.includes(answer);
                break;
            default:
                isWinner = false;
        }

        if (isWinner) {
            const baseKey = bid.gameType.toLowerCase().replace(/\s+/g, '_');

            const minRate = rates[`${baseKey}_1`];
            const maxRate = rates[`${baseKey}_2`];

            let winningAmount = 0;

            if (minRate && maxRate) {
                winningAmount = (bid.bidAmount / minRate) * maxRate;
            }


            batch.update(doc.ref, { status: 'won', winAmount: winningAmount });

            const currentUserWinnings = winningsByUser.get(bid.uid) || 0;
            winningsByUser.set(bid.uid, currentUserWinnings + winningAmount);

            const logRef = db.collection(FUNDS_TRANSACTIONS_COLLECTION).doc();
            batch.set(logRef, {
                uid: bid.uid,
                amount: winningAmount,
                type: 'credit',
                reason: `Jackpot Win: ${bid.gameType} on ${gameTitle}`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            batch.update(doc.ref, { status: 'lost' });
        }
    });

    if (winningsByUser.size > 0) {
        for (const [uid, totalWinnings] of winningsByUser.entries()) {
            const fundDocRef = db.collection(FUNDS_COLLECTION).doc(uid);
            batch.update(fundDocRef, {
                balance: admin.firestore.FieldValue.increment(totalWinnings),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }

    try {
        await batch.commit();
        return {
            success: true,
            message: `Result declared for ${gameTitle}. Processed ${bidsSnapshot.size} bids. Credited ${winningsByUser.size} winners.`
        };
    } catch (error) {
        console.error("Error committing Jackpot result batch:", error);
        throw new Error("Failed to process bids and update balances.");
    }
};

/**
 * Fetches Jackpot game results based on optional filters.
 */
export const getJackpotResults = async ({ date, gameId } = {}) => {
    try {
        let query = db.collection(JACKPOT_RESULTS_COLLECTION).orderBy("lastUpdated", "desc");
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
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching Jackpot results:", error);
        throw new Error("Failed to fetch results from the database.");
    }
};

/**
 * Adds a new game document to the 'jackpot_games' collection.
 */
export const addGame = async ({ game_name, game_name_hindi, close_time, game_status }) => {
    try {
        const docRef = await JACKPOT_GAMES.add({
            game_name: game_name,
            game_name_hindi: game_name_hindi,
            close_time: close_time,
            game_status: game_status,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding game: ", error);
        throw new Error("Failed to add game.");
    }
};

/**
 * Retrieves all games from the 'jackpot_games' collection.
 */
export const getGames = async () => {
    try {
        const snapshot = await JACKPOT_GAMES.orderBy("close_time", "asc").get();
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting games: ", error);
        throw new Error("Failed to fetch games.");
    }
};

/**
 * Updates an existing game document in the 'jackpot_games' collection.
 */
export const updateGame = async (gameId, updatedData) => {
    if (!gameId) {
        throw new Error("Game ID is required for updates.");
    }
    try {
        const gameRef = JACKPOT_GAMES.doc(gameId);
        await gameRef.update({
            ...updatedData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Error updating game: ", error);
        throw new Error("Failed to update game.");
    }
};

/**
 * Deletes a game document from the 'jackpot_games' collection.
 */
export const deleteGame = async (gameId) => {
    if (!gameId) {
        throw new Error("Game ID is required for deletion.");
    }
    try {
        await JACKPOT_GAMES.doc(gameId).delete();
    } catch (error) {
        console.error("Error deleting game: ", error);
        throw new Error("Failed to delete game.");
    }
};

/**
 * Predicts the winners for a jackpot game result without saving anything to the database.
 */
export const predictJackpotWinners = async ({ gameTitle, jodi, declarationDate }) => {
    if (!gameTitle || !jodi || !declarationDate) {
        throw new Error("Missing required fields: gameTitle, jodi, and declarationDate are required.");
    }
    if (!/^\d{2}$/.test(jodi)) {
        throw new Error("Invalid format for jodi. It must be a 2-digit string.");
    }

    const startDate = new Date(declarationDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(declarationDate);
    endDate.setHours(23, 59, 59, 999);

    const bidsQuery = db.collection(GAME_SUBMISSIONS_COLLECTION)
        .where("isJackpot", "==", true)
        .where("status", "==", "pending")
        .where("title", "==", gameTitle)
        .where("createdAt", ">=", startDate)
        .where("createdAt", "<=", endDate)

    const snapshot = await bidsQuery.get();
    if (snapshot.empty) {
        return [];
    }

    const winners = [];

    snapshot.docs.forEach(doc => {
        const bid = doc.data();

        let isWinner = false;
        switch (bid.gameType) {
            case "Jodi":
                const answer = String(bid.answer).trim();
                isWinner = jodi.includes(answer);
                break;
            default:
                isWinner = false;
        }


        if (isWinner) {
            winners.push({
                username: bid.username || "N/A",
                bidAmount: bid.bidAmount || 0,
                gameType: bid.gameType,
                answer: bid.answer,
            });
        }
    });

    return winners;
};