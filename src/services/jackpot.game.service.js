import { db, admin } from "../plugins/firebase.js";
import { getJackpotGameRates } from "./jackpot.settings.service.js";

const JACKPOT_GAMES = db.collection("jackpot_games");
const JACKPOT_RESULTS_COLLECTION = "jackpot-results";
const GAME_SUBMISSIONS_COLLECTION = "game_submissions";
const FUNDS_COLLECTION = "funds";
const FUNDS_TRANSACTIONS_COLLECTION = "funds_transactions";

/**
 * Calculates the single-digits "Ank" from a 3-digit "Panna" string.
 */
const _sumDigits = (pannaStr) => {
    if (!pannaStr || pannaStr.length !== 3) return '';
    const sum = String(pannaStr).split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0);
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

    const winningAnk = _sumDigits(jodi);
    const batch = db.batch();
    const winningsByUser = new Map();

    bidsSnapshot.docs.forEach(doc => {
        const bid = { id: doc.id, ...doc.data() };
        console.log(bid)
        let isWinner = false;

        switch (bid.gameType) {
            case "Single Digit":
            case "Single Digits":
                isWinner = bid.answer === winningAnk;
                break;

            case "SP - SP DP TP":
            case "DP - SP DP TP":
            case "TP - SP DP TP":
            case "Single Pana":
            case "Double Pana":
            case "Triple Pana": {
                console.log("Hora")
                const panna = String(jodi);
                const answer = String(bid.answer).trim();

                // --- SP Logic (Single Pana style) ---
                if (bid.gameType.startsWith("SP") || bid.gameType === "Single Pana") {
                    isWinner = panna.includes(answer);
                }
                // --- DP Logic (Double Pana style) ---
                else if (bid.gameType.startsWith("DP") || bid.gameType === "Double Pana") {
                    isWinner = panna.includes(answer);
                }
                // --- TP Logic (Triple Pana style) ---
                else if (bid.gameType.startsWith("TP") || bid.gameType === "Triple Pana") {
                    isWinner = panna === answer;
                } else {
                    isWinner = false;
                }
                break;
            }

            case "Odd Even":
                isWinner =
                    bid.answer === "Even"
                        ? parseInt(winningAnk) % 2 === 0
                        : parseInt(winningAnk) % 2 !== 0;
                break;

            default:
                isWinner = false;
        }

        if (isWinner) {
            const rateKey = bid.gameType.toLowerCase().replace(/\s+/g, '-');

            const rate = rates[rateKey];

            let winningAmount = 0;
            if (rate && rate.min_value && rate.max_value) {
                winningAmount = (bid.bidAmount / rate.min_value) * rate.max_value;
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

    const winningAnk = _sumDigits(jodi);
    const winners = [];

    snapshot.docs.forEach(doc => {
        const bid = doc.data();

        let isWinner = false;
        switch (bid.gameType) {
            case "Single Digit":
            case "Single Digits":
                isWinner = bid.answer === winningAnk;
                break;

            case "SP - SP DP TP":
            case "DP - SP DP TP":
            case "TP - SP DP TP":
            case "Single Pana":
            case "Double Pana":
            case "Triple Pana": {
                const panna = String(jodi);
                const answer = String(bid.answer).trim();

                // --- SP Logic (Single Pana style) ---
                if (bid.gameType.startsWith("SP") || bid.gameType === "Single Pana") {
                    isWinner = panna.includes(answer);
                }
                // --- DP Logic (Double Pana style) ---
                else if (bid.gameType.startsWith("DP") || bid.gameType === "Double Pana") {
                    isWinner = panna.includes(answer);
                }
                // --- TP Logic (Triple Pana style) ---
                else if (bid.gameType.startsWith("TP") || bid.gameType === "Triple Pana") {
                    isWinner = panna === answer;
                } else {
                    isWinner = false;
                }
                break;
            }

            case "Odd Even":
                isWinner =
                    bid.answer === "Even"
                        ? parseInt(winningAnk) % 2 === 0
                        : parseInt(winningAnk) % 2 !== 0;
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