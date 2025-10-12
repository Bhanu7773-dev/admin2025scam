import { Timestamp } from "firebase-admin/firestore";
import { admin } from '../plugins/firebase.js';
import * as cheerio from "cheerio";
import { getGameRates } from "./settings.service.js";

// ===================================================================
// == MatkaService Class for Web Scraping ==
// ===================================================================

class MatkaService {
    static baseUrl = "https://sattamatkano1.me";

    async get(endpoint = "/") {
        try {
            const response = await fetch(MatkaService.baseUrl + endpoint);
            if (!response.ok) {
                console.error(`Request failed with status: ${response.status}`);
                return null;
            }
            return await response.text();
        } catch (err) {
            console.error("An error occurred during the GET request:", err);
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

            weeklyResults.push({
                dateRange,
                results: dailyResultsForWeek,
            });
        });

        return weeklyResults;
    }
}

// ===================================================================
// == Game Result Processing Logic ==
// ===================================================================

const matka = new MatkaService();

// --- CONSTANTS & HELPERS ---
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
const reverseString = (str) => str.split('').reverse().join('');
const findFamily = (numStr) => { for (const [, values] of Object.entries(families)) { if (values.includes(numStr)) return values; } return null; };
const findRedFamily = (numStr) => { for (const [, values] of Object.entries(familiesRed)) { if (values.includes(numStr)) return values; } return null; };
const parseOverrideResult = (resultStr) => {
    if (!resultStr || !resultStr.includes('-')) return null;
    const [digit, panna] = resultStr.split('-');
    return { digit, panna };
};

function normalizePayoutRates(flatRates) {
    const rateMap = {
        "Single Digits": flatRates.single_digit_2,
        "Jodi": flatRates.jodi_digit_2,
        "Single Pana": flatRates.single_pana_2,
        "Double Pana": flatRates.double_pana_2,
        "Triple Pana": flatRates.triple_pana_2,
        "Half Sangam A": flatRates.half_sangam_2,
        "Half Sangam B": flatRates.half_sangam_2,
        "Full Sangam": flatRates.full_sangam_2,
        "Red Bracket": flatRates.jodi_digit_2,
        "Group Jodi": flatRates.jodi_digit_2,
        "default": 1
    };
    return Object.fromEntries(Object.entries(rateMap).filter(([, value]) => value !== undefined));
}

/**
 * Handler to declare a result and process all winning/losing bids for a specific game and date.
 * This is a destructive action that updates the database.
 * @route POST /biddings/declare
 */
export async function declareResultHandler(request, reply) {
    try {
        const { gameId, date, openPana, closePana } = request.body;

        if (!gameId || !date || !openPana || !closePana) {
            return reply.code(400).send({ error: "Required fields are missing. 'gameId', 'date', 'openPana', and 'closePana' are mandatory." });
        }

        const resultDate = new Date(date);
        if (isNaN(resultDate.getTime())) {
            return reply.code(400).send({ error: "Invalid 'date' format. Please use a valid date string like YYYY-MM-DD." });
        }
        
        // Define the date range for the entire day to process
        const startDate = new Date(resultDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(resultDate);
        endDate.setHours(23, 59, 59, 999);
        
        // Helper to calculate the single digit from a pana
        const sumDigits = (numStr) => String(numStr).split('').reduce((sum, digit) => sum + parseInt(digit, 10), 0) % 10;

        // Construct the overrideList that processGameResults expects
        const overrideList = {
            [gameId]: {
                firstHalf: `${sumDigits(openPana)}-${openPana}`,
                secondHalf: `${sumDigits(closePana)}-${closePana}`,
            }
        };

        // Call the main processing function with the override data
        const summary = await processGameResults({
            startDate,
            endDate,
            overrideList
        });

        return reply.send({ success: true, message: "Result declared and bids processed successfully.", data: summary });

    } catch (error) {
        console.error("Error in declareResultHandler:", error);
        return reply.code(500).send({ error: error.message || "An internal server error occurred." });
    }
}


/**
 * Processes pending game submissions within a given date range.
 * This function WRITES to the database.
 */
export const processGameResults = async ({ startDate, endDate, overrideList = null }) => {
    console.log(`Starting game result processing for ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const flatGameRates = await getGameRates();
    const dynamicPayoutRates = normalizePayoutRates(flatGameRates);
    
    if (Object.keys(dynamicPayoutRates).length <= 1) {
        console.error("CRITICAL: Game rates could not be loaded from the database. Aborting.");
        throw new Error("Game rates are not configured.");
    }
    console.log("Successfully loaded dynamic game rates for processing.");

    const summary = { totalSubmissions: 0, processed: 0, won: 0, lost: 0, skipped: 0 };

    try {
        const db = admin.firestore();
        const batch = db.batch();

        const pendingSubmissionsQuery = db.collection("game_submissions")
            .where("status", "==", "pending")
            .where("createdAt", ">=", startDate)
            .where("createdAt", "<=", endDate);

        const pendingSubmissionsSnapshot = await pendingSubmissionsQuery.get();

        if (pendingSubmissionsSnapshot.empty) {
            console.log("No pending submissions found in the specified date range.");
            return summary;
        }

        summary.totalSubmissions = pendingSubmissionsSnapshot.size;
        console.log(`Found ${summary.totalSubmissions} pending submissions.`);

        let submissionsByGame = new Map();
        pendingSubmissionsSnapshot.forEach(doc => {
            const submission = { id: doc.id, ...doc.data() };
            const gameId = submission.gameId;
            submissionsByGame.set(gameId, [...(submissionsByGame.get(gameId) || []), submission]);
        });

        const useOverride = overrideList && Object.keys(overrideList).length > 0;
        if (useOverride) {
            console.log("Override list provided. Filtering games to process:", Object.keys(overrideList));
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
                console.log(`[${gameId}] Using override data to declare result.`);
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
                    console.log(`[${gameId}] Scraping chart data...`);
                    const chartData = await matka.getChart(gameId);
                    if (!chartData || chartData.length === 0) {
                        console.warn(`[${gameId}] No chart data found. Skipping game.`);
                        summary.skipped += submissions.length;
                        continue;
                    }
                    chartCache.set(gameId, chartData);
                }
            }

            for (const submission of submissions) {
                const logPrefix = `[${gameId}/${submission.id}]`;

                if (!isOverriding) {
                    const submissionDate = submission.createdAt.toDate();
                    const gameChart = chartCache.get(gameId);
                    dailyResult = findResultForDate(gameChart, submissionDate);
                    if (!dailyResult) {
                        console.log(`${logPrefix} No result row for date: ${submissionDate.toISOString()}`);
                        summary.skipped++;
                        continue;
                    }
                }

                if (!dailyResult) {
                    console.error(`${logPrefix} Internal error: dailyResult is null. Skipping.`);
                    summary.skipped++;
                    continue;
                }

                const marketType = String(submission.selectedGameType).toLowerCase();
                if (!isResultDeclared(dailyResult, marketType)) {
                    console.log(`${logPrefix} Result for '${marketType}' not declared. Skipping.`);
                    summary.skipped++;
                    continue;
                }

                console.log(`${logPrefix} Evaluating with result: ${JSON.stringify(dailyResult)}`);
                let isWinner = false;
                const { gameType, answer, uid, bidAmount } = submission;
                const overrideData = isOverriding ? overrideList[gameId] : null;
                const checkLoss = (dependsOn) => {
                    if (!isOverriding) return false;
                    if (dependsOn.includes('first') && overrideData.firstHalf === null) return true;
                    if (dependsOn.includes('second') && overrideData.secondHalf === null) return true;
                    if (dependsOn.includes('both') && (overrideData.firstHalf === null || overrideData.secondHalf === null)) return true;
                    return false;
                };

                // --- WIN/LOSS LOGIC ---
                switch (gameType) {
                    case "Single Digits": if (checkLoss(marketType === 'open' ? ['first'] : ['second'])) break; const digit = marketType === 'open' ? sumDigits(dailyResult.openingPanna) : sumDigits(dailyResult.closingPanna); isWinner = String(digit) === answer; break;
                    case "Jodi": if (checkLoss(['both'])) break; isWinner = dailyResult.jodi === answer; break;
                    case "Single Pana": case "Double Pana": case "Triple Pana": case "SP Motor": case "DP Motor": if (checkLoss(marketType === 'open' ? ['first'] : ['second'])) break; if (marketType == 'open') { isWinner = gameType === 'Double Pana' ? dailyResult.openingPanna == reverseString(answer) : dailyResult.openingPanna.includes(answer); } else { isWinner = gameType === 'Double Pana' ? dailyResult.closingPanna == reverseString(answer) : dailyResult.closingPanna.includes(answer); } break;
                    case 'Two Digits Panel': if (checkLoss(['both'])) break; isWinner = `${sumDigits(dailyResult.openingPanna)}${sumDigits(dailyResult.closingPanna)}` == answer; break;
                    case 'Group Jodi': case 'Red Bracket': if (checkLoss(['both'])) break; const family = gameType === 'Group Jodi' ? findFamily(answer) : findRedFamily(answer); isWinner = family?.includes(dailyResult.jodi) ?? false; break;
                    case 'Half Sangam A': if (checkLoss(['both'])) break; const sangamAData = parseSangamData(answer); isWinner = sangamAData['Pana'] === dailyResult.openingPanna && sangamAData['Ank'] === String(sumDigits(dailyResult.closingPanna)); break;
                    case 'Half Sangam B': if (checkLoss(['both'])) break; const sangamBData = parseSangamData(answer); isWinner = sangamBData['Pana'] === dailyResult.closingPanna && sangamBData['Ank'] === String(sumDigits(dailyResult.openingPanna)); break;
                    case 'Full Sangam': if (checkLoss(['both'])) break; const sangamData = parseSangamData(answer); isWinner = sangamData['Open'] === dailyResult.openingPanna && sangamData['Close'] === dailyResult.closingPanna; break;
                    case 'Odd Even': if (checkLoss(marketType === 'open' ? ['first'] : ['second'])) break; const ankForOddEven = marketType === 'open' ? sumDigits(dailyResult.openingPanna) : sumDigits(dailyResult.closingPanna); const isOdd = ankForOddEven % 2 !== 0; isWinner = (String(answer).toLowerCase() === 'odd' && isOdd) || (String(answer).toLowerCase() === 'even' && !isOdd); break;
                }

                const submissionRef = db.collection("game_submissions").doc(submission.id);
                if (isWinner) {
                    summary.won++;
                    const payoutRate = dynamicPayoutRates[gameType] || dynamicPayoutRates['default'];
                    const winnings = bidAmount * payoutRate;
                    const totalCredit = bidAmount + winnings;
                    const fundsQuery = db.collection("funds").where("uid", "==", uid).limit(1);
                    const fundsSnapshot = await fundsQuery.get();
                    if (!fundsSnapshot.empty) {
                        const fundDocRef = fundsSnapshot.docs[0].ref;
                        batch.update(submissionRef, { status: "won", winAmount: winnings });
                        batch.update(fundDocRef, { balance: admin.firestore.FieldValue.increment(totalCredit), updatedAt: Timestamp.now(), lastSyncAt: Timestamp.now(), lastUpdateReason: `Game Won - ${gameType}` });
                        console.log(`${logPrefix} Outcome: WON. Crediting ${totalCredit}.`);
                    } else { console.error(`${logPrefix} CRITICAL: Fund document not found for user ${uid}.`); }
                } else {
                    summary.lost++;
                    batch.update(submissionRef, { status: "lost" });
                    console.log(`${logPrefix} Outcome: LOST.`);
                }
                summary.processed++;
            }
        }

        if (summary.processed > 0) {
            await batch.commit();
            console.log(`Batch commit successful. Processed ${summary.processed} submissions.`);
        } else {
            console.log("Finished. No submissions were eligible for processing in this run.");
        }
        return summary;
    } catch (err) {
        console.error("A critical error occurred during result processing:", err);
        throw new Error(err.message);
    }
};

/**
 * Predicts winners for a given game and date based on a hypothetical result.
 * This function is READ-ONLY and does not update the database.
 */
export const getPrediction = async ({ gameId, date, type, openPanna, closePanna }) => {
    if (!gameId || !date || !openPanna || !closePanna) {
        throw new Error("Missing required parameters: gameId, date, openPanna, and closePanna are required.");
    }
    console.log(`[Prediction] Running for ${gameId} on ${date.toDateString()} with result ${openPanna}-${closePanna}`);

    const flatGameRates = await getGameRates();
    const dynamicPayoutRates = normalizePayoutRates(flatGameRates);
    if (Object.keys(dynamicPayoutRates).length <= 1) {
        throw new Error("Game rates are not configured in the database.");
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
        .get();

    if (submissionsSnapshot.empty) {
        console.log(`[Prediction] No pending submissions found for ${gameId} on this date.`);
        return [];
    }

    const dailyResult = {
        openingPanna,
        closingPanna,
        jodi: `${sumDigits(openPanna)}${sumDigits(closePanna)}`,
        isClosed: false,
    };

    console.log(`[Prediction] Found ${submissionsSnapshot.size} submissions. Evaluating with result: ${JSON.stringify(dailyResult)}`);

    for (const doc of submissionsSnapshot.docs) {
        const submission = { id: doc.id, ...doc.data() };
        const marketType = String(submission.selectedGameType).toLowerCase();

        if (type && marketType !== type) {
            continue;
        }

        let isWinner = false;
        const { gameType, answer, bidAmount } = submission;

        // --- WIN/LOSS LOGIC ---
        switch (gameType) {
            case "Single Digits": const digit = marketType === 'open' ? sumDigits(dailyResult.openingPanna) : sumDigits(dailyResult.closingPanna); isWinner = String(digit) === answer; break;
            case "Jodi": isWinner = dailyResult.jodi === answer; break;
            case "Single Pana": case "Double Pana": case "Triple Pana": case "SP Motor": case "DP Motor": if (marketType === 'open') { isWinner = gameType === 'Double Pana' ? dailyResult.openingPanna == reverseString(answer) : dailyResult.openingPanna.includes(answer); } else { isWinner = gameType === 'Double Pana' ? dailyResult.closingPanna == reverseString(answer) : dailyResult.closingPanna.includes(answer); } break;
            case 'Two Digits Panel': isWinner = `${sumDigits(dailyResult.openingPanna)}${sumDigits(dailyResult.closingPanna)}` == answer; break;
            case 'Group Jodi': case 'Red Bracket': const family = gameType === 'Group Jodi' ? findFamily(answer) : findRedFamily(answer); isWinner = family?.includes(dailyResult.jodi) ?? false; break;
            case 'Half Sangam A': const sangamAData = parseSangamData(answer); isWinner = sangamAData['Pana'] === dailyResult.openingPanna && sangamAData['Ank'] === String(sumDigits(dailyResult.closingPanna)); break;
            case 'Half Sangam B': const sangamBData = parseSangamData(answer); isWinner = sangamBData['Pana'] === dailyResult.closingPanna && sangamBData['Ank'] === String(sumDigits(dailyResult.openingPanna)); break;
            case 'Full Sangam': const sangamData = parseSangamData(answer); isWinner = sangamData['Open'] === dailyResult.openingPanna && sangamData['Close'] === dailyResult.closingPanna; break;
            case 'Odd Even': const ankForOddEven = marketType === 'open' ? sumDigits(dailyResult.openingPanna) : sumDigits(dailyResult.closingPanna); const isOdd = ankForOddEven % 2 !== 0; isWinner = (String(answer).toLowerCase() === 'odd' && isOdd) || (String(answer).toLowerCase() === 'even' && !isOdd); break;
        }

        if (isWinner) {
            const payoutRate = dynamicPayoutRates[gameType] || dynamicPayoutRates['default'];
            const winAmount = bidAmount * payoutRate;
            winners.push({
                submissionId: submission.id,
                userId: submission.uid,
                gameType: submission.gameType,
                bidAmount: submission.bidAmount,
                answer: submission.answer,
                winAmount: winAmount
            });
        }
    }

    console.log(`[Prediction] Found ${winners.length} potential winners.`);
    return winners;
};

