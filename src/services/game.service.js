import { Timestamp } from "firebase-admin/firestore";
import { admin } from '../plugins/firebase.js';
import * as cheerio from "cheerio";
import { getGameRates } from "./settings.service.js";

const GAME_RESULTS_COLLECTION = "game-results";
const FUNDS_TRANSACTIONS_COLLECTION = "funds_transactions";

// --- SERVICE FOR WEB SCRAPING ---
class MatkaService {
    static baseUrl = "https://sattamatkano1.me";

    async get(endpoint = "/") {
        try {
            const response = await fetch(MatkaService.baseUrl + endpoint);
            if (!response.ok) {
                return null;
            }
            return await response.text();
        } catch (err) {
            return null;
        }
    }

    async getChart(id) {
        const html = await this.get(`/${id}.php`);
        if (!html) return [];
        const $ = cheerio.load(html);
        const rows = $("tbody tr").slice(1);
        const weeklyResults = [];
        const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
        rows.each((_, row) => {
            const cells = $(row).children();
            if (cells.length < 1) return;
            const dateRange = $(cells[0]).text().trim().replace(/\s+/g, " ");
            const dailyResultsForWeek = [];
            for (let i = 0; i < 7; i++) {
                const dayStartIndex = 1 + i * 3;
                if (dayStartIndex + 2 >= cells.length) continue;
                const openingPannaCell = $(cells[dayStartIndex]);
                const jodiCell = $(cells[dayStartIndex + 1]);
                const closingPannaCell = $(cells[dayStartIndex + 2]);
                const openingPanna = openingPannaCell.text().trim().replace(/\s+/g, "");
                const jodi = jodiCell.text().trim();
                const closingPanna = closingPannaCell.text().trim().replace(/\s+/g, "");
                const isHoliday = (jodiCell.html()?.includes('color="red"') ?? false) && isNaN(parseInt(jodi));
                dailyResultsForWeek.push({
                    dayOfWeek: days[i],
                    isClosed: isHoliday,
                    openingPanna: isHoliday ? "***" : openingPanna,
                    jodi: isHoliday ? "**" : jodi,
                    closingPanna: isHoliday ? "***" : closingPanna,
                });
            }
            weeklyResults.push({ dateRange, results: dailyResultsForWeek });
        });
        return weeklyResults;
    }
}

const matka = new MatkaService();

// --- HELPER FUNCTIONS & CONSTANTS ---
const families = { "12": ["12", "17", "21", "26", "62", "67", "71", "76"], "13": ["13", "18", "31", "36", "63", "68", "81", "86"], "14": ["14", "19", "41", "46", "64", "69", "91", "96"], "15": ["01", "06", "10", "15", "51", "56", "60", "65"], "23": ["23", "28", "32", "37", "73", "78", "82", "87"], "24": ["24", "29", "42", "47", "74", "79", "92", "97"], "25": ["02", "07", "20", "25", "52", "57", "70", "75"], "34": ["34", "39", "43", "48", "84", "89", "93", "98"], "35": ["03", "08", "30", "35", "53", "58", "80", "85"], "45": ["04", "09", "40", "45", "54", "59", "90", "95"] };
const familiesRed = { half_red: ["05", "16", "27", "38", "49", "50", "61", "72", "83", "94"], full_red: ["00", "11", "22", "33", "44", "55", "66", "77", "88", "99"] };

function parseIstDateString(dateStr) {
    const [day, month, year] = dateStr.split('/');
    return new Date(`${year}-${month}-${day}T00:00:00.000+05:30`);
}
const findResultForDate = (chartData, submissionDate) => {
    const dayOfWeekInIndia = submissionDate.toLocaleString("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).toUpperCase();
    for (const week of chartData) {
        const dateParts = week.dateRange.match(/(\d{2}\/\d{2}\/\d{4})to(\d{2}\/\d{2}\/\d{4})/);
        if (!dateParts) continue;
        const startDate = parseIstDateString(dateParts[1]);
        const endDate = parseIstDateString(dateParts[2]);
        endDate.setHours(23, 59, 59, 999);
        if (submissionDate >= startDate && submissionDate <= endDate) {
            return week.results.find(r => r.dayOfWeek === dayOfWeekInIndia) || null;
        }
    }
    return null;
};
const isResultDeclared = (result, marketType) => {
    if (result.isClosed) return false;
    switch (marketType) {
        case 'open': return result.openingPanna !== '***';
        case 'close': return result.closingPanna !== '***';
        default: return result.jodi !== '**' && result.jodi !== 'N/A';
    }
};
const sumDigits = (numStr) => String(numStr).split('').reduce((sum, digit) => sum + parseInt(digit, 10), 0) % 10;
const parseSangamData = (str) => str.split(",").reduce((acc, part) => { const [key, value] = part.split(":").map(s => s.trim()); if (key && value) { acc[key] = value; } return acc; }, {});
const findFamily = (numStr) => { for (const [, values] of Object.entries(families)) { if (values.includes(numStr)) return values; } return null; };
const findRedFamily = (numStr) => { for (const [, values] of Object.entries(familiesRed)) { if (values.includes(numStr)) return values; } return null; };
const parseOverrideResult = (resultStr) => {
    if (!resultStr || !resultStr.includes('-')) return null;
    const [digit, panna] = resultStr.split('-');
    return { digit, panna };
};
function normalizePayoutRates(flatRates) {
    const calculateRate = (betKey, winKey) => {
        const betAmount = flatRates[betKey];
        const winAmount = flatRates[winKey];
        if (betAmount && betAmount > 0 && winAmount) {
            return winAmount / betAmount;
        }
        return 1;
    };
    const rateMap = {
        "Single Digits": calculateRate('single_digit_1', 'single_digit_2'),
        "Jodi Bulk": calculateRate('jodi_digit_1', 'jodi_digit_2'),
        "Two Digits Panel": calculateRate('jodi_digit_1', 'jodi_digit_2'),
        "Jodi": calculateRate('jodi_digit_1', 'jodi_digit_2'),
        "Single Pana Bulk": calculateRate('single_pana_1', 'single_pana_2'),
        "Double Pana Bulk": calculateRate('single_pana_1', 'single_pana_2'),
        "Panel Group": calculateRate('single_pana_1', 'single_pana_2'),
        "Single Pana": calculateRate('single_pana_1', 'single_pana_2'),
        "Single Pana": calculateRate('single_pana_1', 'single_pana_2'),
        "Double Pana": calculateRate('double_pana_1', 'double_pana_2'),
        "Triple Pana": calculateRate('triple_pana_1', 'triple_pana_2'),
        "Half Sangam A": calculateRate('half_sangam_1', 'half_sangam_2'),
        "Half Sangam B": calculateRate('half_sangam_1', 'half_sangam_2'),
        "Full Sangam": calculateRate('full_sangam_1', 'full_sangam_2'),
        "Red Bracket": calculateRate('jodi_digit_1', 'jodi_digit_2'),
        "Group Jodi": calculateRate('jodi_digit_1', 'jodi_digit_2'),
        "SP - SP DP TP": calculateRate('single_pana_1', 'single_pana_2'),
        "DP - SP DP TP": calculateRate('double_pana_1', 'double_pana_2'),
        "TP - SP DP TP": calculateRate('triple_pana_1', 'triple_pana_2'),
        "default": 1
    };
    return Object.fromEntries(Object.entries(rateMap).filter(([, value]) => value !== undefined));
}

// --- CENTRALIZED WINNER CHECK LOGIC ---
function checkIfWinner(submission, dailyResult, type) {
    const { gameType, answer, selectedGameType } = submission;
    const marketType = String(selectedGameType).toLowerCase();
    let isWinner = false;

    switch (gameType) {
        case "Single Digit":
        case "Single Digits":
        case "Single Digits Bulk":
            const digit = marketType === 'open' ? sumDigits(dailyResult.openingPanna) : sumDigits(dailyResult.closingPanna);
            isWinner = String(digit) === answer;
            break;
        case "Jodi Bulk":
        case "Two Digits Panel":
        case "Jodi":
            isWinner = dailyResult.jodi === answer;
            break;
        case "Single Pana":
        case "Double Pana":
        case "Triple Pana":
        case "Single Pana Bulk":
        case "Double Pana Bulk":
        case "SP - SP DP TP":
        case "DP - SP DP TP":
        case "TP - SP DP TP":
            const pannaToMatch = marketType === 'open' ? dailyResult.openingPanna : dailyResult.closingPanna;
            isWinner = pannaToMatch === answer;
            break;
        case "SP Motor":
        case "DP Motor":
        case "TP Motor":
            const motorPanna = marketType === 'open' ? dailyResult.openingPanna : dailyResult.closingPanna;
            isWinner = String(motorPanna).includes(answer);
            break;
        case 'Group Jodi':
        case 'Red Bracket':
            const family = gameType === 'Group Jodi' ? findFamily(answer) : answer == 'Full Bracket' ? familiesRed['full_red'] : familiesRed['half_red'];
            isWinner = family?.includes(dailyResult.jodi) ?? false;
            break;
        case 'Half Sangam A':
            const sangamAData = parseSangamData(answer);
            isWinner = sangamAData['Pana'] === dailyResult.openingPanna && sangamAData['Ank'] === String(sumDigits(dailyResult.closingPanna));
            break;
        case 'Half Sangam B':
            const sangamBData = parseSangamData(answer);
            isWinner = sangamBData['Pana'] === dailyResult.closingPanna && sangamBData['Ank'] === String(sumDigits(dailyResult.openingPanna));
            break;
        case 'Full Sangam':
            const sangamData = parseSangamData(answer);
            isWinner = sangamData['Open'] === dailyResult.openingPanna && sangamData['Close'] === dailyResult.closingPanna;
            break;
        case 'Odd Even':
            const ankForOddEven = marketType === 'open' ? sumDigits(dailyResult.openingPanna) : sumDigits(dailyResult.closingPanna);
            const isOdd = ankForOddEven % 2 !== 0;
            isWinner = (String(answer).toLowerCase() === 'odd' && isOdd) || (String(answer).toLowerCase() === 'even' && !isOdd);
            break;
        case 'Panel Group':
            isWinner = answer === dailyResult.openingPanna || answer === dailyResult.closingPanna
            break;
    }
    return isWinner;
}


// --- MAIN HANDLERS & EXPORTS ---

export async function declareResultHandler(request, reply) {
    try {
        const db = admin.firestore();
        const { gameId, date, openPana, closePana } = request.body;
        if (!gameId || !date || !openPana || !closePana) {
            return reply.code(400).send({ error: "Required fields are missing." });
        }
        const resultDate = new Date(date);
        if (isNaN(resultDate.getTime())) {
            return reply.code(400).send({ error: "Invalid 'date' format." });
        }
        const gameDoc = await db.collection("games").doc(gameId).get();
        if (!gameDoc.exists) {
            throw new Error(`Game with ID '${gameId}' not found.`);
        }
        const gameTitle = gameDoc.data().name || gameId;
        const jodi = `${sumDigits(openPana)}${sumDigits(closePana)}`;
        const docId = `${date}_${gameId}`;
        const resultDocRef = db.collection(GAME_RESULTS_COLLECTION).doc(docId);
        await resultDocRef.set({
            gameId,
            gameTitle,
            declarationDate: date,
            openPana,
            closePana,
            jodi,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        const startDate = new Date(resultDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(resultDate);
        endDate.setHours(23, 59, 59, 999);
        const overrideList = {
            [gameId]: {
                firstHalf: `${sumDigits(openPana)}-${openPana}`,
                secondHalf: `${sumDigits(closePana)}-${closePana}`,
            }
        };
        const result = await processGameResults({
            startDate,
            endDate,
            overrideList
        });
        return reply.send({ success: true, message: "Result declared and bids processed.", data: result });
    } catch (error) {
        console.error("Error in declareResultHandler:", error);
        return reply.code(500).send({ error: error.message || "An internal server error occurred." });
    }
}

export const getResults = async ({ date } = {}) => {
    try {
        const db = admin.firestore();
        let query = db.collection(GAME_RESULTS_COLLECTION).orderBy("lastUpdated", "desc");
        if (date) {
            query = query.where("declarationDate", "==", date);
        }
        const snapshot = await query.get();
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching game results:", error);
        throw new Error("Failed to fetch game results from the database.");
    }
};

export const processGameResults = async ({ startDate, endDate, overrideList = null }) => {
    const flatGameRates = await getGameRates();
    const dynamicPayoutRates = normalizePayoutRates(flatGameRates);
    if (Object.keys(dynamicPayoutRates).length <= 1) {
        throw new Error("Game rates are not configured.");
    }
    const summary = { totalSubmissions: 0, processed: 0, won: 0, lost: 0, skipped: 0 };
    const winnersList = [];
    const db = admin.firestore();
    try {
        const batch = db.batch();
        const pendingSubmissionsSnapshot = await db.collection("game_submissions")
            .where("status", "==", "pending")
            .where("createdAt", ">=", startDate)
            .where("createdAt", "<=", endDate)
            .where("isStarline", "==", false)
            .where("isJackpot", "==", false)
            .get();
        if (pendingSubmissionsSnapshot.empty) {
            return { ...summary, winners: [] };
        }
        const allUids = new Set(pendingSubmissionsSnapshot.docs.map(doc => doc.data().uid));
        const userCache = new Map();
        const userDocs = await Promise.all([...allUids].map(uid => db.collection("users").doc(uid).get()));
        userDocs.forEach(doc => {
            if (doc.exists) userCache.set(doc.id, doc.data());
        });
        let submissionsByGame = new Map();
        pendingSubmissionsSnapshot.forEach(doc => {
            const submission = { id: doc.id, ...doc.data() };
            const gameId = submission.gameId;
            submissionsByGame.set(gameId, [...(submissionsByGame.get(gameId) || []), submission]);
        });
        const useOverride = overrideList && Object.keys(overrideList).length > 0;
        if (useOverride) {
            const filteredGames = new Map();
            for (const gameId of Object.keys(overrideList)) {
                if (submissionsByGame.has(gameId)) {
                    filteredGames.set(gameId, submissionsByGame.get(gameId));
                }
            }
            submissionsByGame = filteredGames;
        }
        const chartCache = new Map();
        for (const [gameId, submissions] of submissionsByGame.entries()) {
            let dailyResult = null;
            let isOverriding = useOverride && overrideList[gameId];
            if (isOverriding) {
                const overrideData = overrideList[gameId];
                const firstHalf = parseOverrideResult(overrideData.firstHalf);
                const secondHalf = parseOverrideResult(overrideData.secondHalf);
                dailyResult = {
                    dayOfWeek: 'N/A', isClosed: false,
                    openingPanna: firstHalf ? firstHalf.panna : '***',
                    jodi: `${firstHalf ? firstHalf.digit : '*'}${secondHalf ? secondHalf.digit : '*'}`,
                    closingPanna: secondHalf ? secondHalf.panna : '***',
                };
            } else {
                if (!chartCache.has(gameId)) {
                    const chartData = await matka.getChart(gameId);
                    if (!chartData || chartData.length === 0) {
                        summary.skipped += submissions.length;
                        continue;
                    }
                    chartCache.set(gameId, chartData);
                }
            }
            for (const submission of submissions) {
                if (!isOverriding) {
                    const submissionDate = submission.createdAt.toDate();
                    const gameChart = chartCache.get(gameId);
                    dailyResult = findResultForDate(gameChart, submissionDate);
                    if (!dailyResult) {
                        summary.skipped++;
                        continue;
                    }
                    // IMPORTANT FIX: Recalculate Jodi to ensure consistency
                    if (dailyResult.openingPanna !== '***' && dailyResult.closingPanna !== '***') {
                        dailyResult.jodi = `${sumDigits(dailyResult.openingPanna)}${sumDigits(dailyResult.closingPanna)}`;
                    }
                }
                if (!dailyResult) {
                    summary.skipped++;
                    continue;
                }
                const marketType = String(submission.selectedGameType).toLowerCase();
                if (!isResultDeclared(dailyResult, marketType)) {
                    summary.skipped++;
                    continue;
                }

                const isWinner = checkIfWinner(submission, dailyResult);
                const submissionRef = db.collection("game_submissions").doc(submission.id);

                if (isWinner) {
                    summary.won++;
                    const payoutRate = dynamicPayoutRates[submission.gameType] || dynamicPayoutRates['default'];
                    const winnings = submission.bidAmount * payoutRate;
                    const fundsQuery = db.collection("funds").where("uid", "==", submission.uid).limit(1);
                    const fundsSnapshot = await fundsQuery.get();
                    if (!fundsSnapshot.empty) {
                        const fundDocRef = fundsSnapshot.docs[0].ref;
                        batch.update(submissionRef, { status: "won", winAmount: winnings });
                        batch.update(fundDocRef, {
                            balance: admin.firestore.FieldValue.increment(winnings),
                            updatedAt: Timestamp.now(),
                            lastSyncAt: Timestamp.now(),
                            lastUpdateReason: `Game Won - ${submission.gameType}`
                        });
                        const transactionRef = db.collection(FUNDS_TRANSACTIONS_COLLECTION).doc();
                        batch.set(transactionRef, {
                            uid: submission.uid,
                            amount: winnings,
                            type: 'credit',
                            reason: `Game Win: ${submission.gameType} on ${submission.title || gameId}`,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        const user = userCache.get(submission.uid) || { username: 'N/A' };
                        winnersList.push({
                            submissionId: submission.id,
                            userId: submission.uid,
                            username: user.username,
                            gameType: submission.gameType,
                            winAmount: winnings
                        });
                    } else {
                        console.error(`CRITICAL: Fund document not found for user ${submission.uid}.`);
                    }
                } else {
                    summary.lost++;
                    batch.update(submissionRef, { status: "lost" });
                }
                summary.processed++;
            }
        }
        if (summary.processed > 0) {
            await batch.commit();
        }
        return { ...summary, winners: winnersList };
    } catch (err) {
        console.error("A critical error occurred during result processing:", err);
        throw new Error(err.message);
    }
};

export const getPrediction = async ({ gameId, date, type, openPana, closePana }) => {
    if (!gameId || !date || !openPana || !closePana) {
        throw new Error("Missing required parameters.");
    }
    const flatGameRates = await getGameRates();
    const dynamicPayoutRates = normalizePayoutRates(flatGameRates);
    if (Object.keys(dynamicPayoutRates).length <= 1) {
        throw new Error("Game rates are not configured.");
    }
    const winners = [];
    const db = admin.firestore();
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    const submissionsSnapshot = await db.collection("game_submissions")
        .where("status", "==", "pending")
        .where("gameId", "==", gameId)
        .where("createdAt", ">=", startDate)
        .where("createdAt", "<=", endDate)
        .where("isStarline", "==", false)
        .where("isJackpot", "==", false)
        .get();
    if (submissionsSnapshot.empty) {
        return [];
    }
    const allUids = new Set(submissionsSnapshot.docs.map(doc => doc.data().uid));
    const userCache = new Map();
    const userDocs = await Promise.all([...allUids].map(uid => db.collection("users").doc(uid).get()));
    userDocs.forEach(doc => {
        if (doc.exists) userCache.set(doc.id, doc.data());
    });
    const dailyResult = {
        openingPanna: openPana,
        closingPana: closePana,
        jodi: `${sumDigits(openPana)}${sumDigits(closePana)}`,
        isClosed: false,
    };
    for (const doc of submissionsSnapshot.docs) {
        const submission = { id: doc.id, ...doc.data() };
        const marketType = String(submission.selectedGameType).toLowerCase();

        // if (type && marketType !== type) {
        //     continue;
        // }

        const isWinner = checkIfWinner(submission, dailyResult, type);

        if (isWinner) {
            const payoutRate = dynamicPayoutRates[submission.gameType] || dynamicPayoutRates['default'];
            const winAmount = submission.bidAmount * payoutRate;
            const user = userCache.get(submission.uid) || { username: 'N/A' };
            winners.push({
                submissionId: submission.id,
                userId: submission.uid,
                username: user.username,
                gameType: submission.gameType,
                bidAmount: submission.bidAmount,
                answer: submission.answer,
                winAmount: winAmount
            });
        }
    }
    return winners;
};