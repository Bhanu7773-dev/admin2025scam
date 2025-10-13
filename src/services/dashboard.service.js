import { db } from "../plugins/firebase.js"
import { getAllGames } from "./games.service.js"
import { getAllUsers } from "./users.service.js"
import { getTotalWithdrawals } from "./withdrawl.service.js"

const USERS_COLLECTION = db.collection("users")
const GAME_SUBMISSIONS_COLLECTION = db.collection("game_submissions")

export const getDashboard = async () => {
  // Aggregation for total amount and bid count per game name (separate from ank logic)
  function getMarketName(title) {
    // Extract main market name (e.g., "TIME BAZAR" from "TIME BAZAR - Jodi")
    return title.split(" - ")[0].trim();
  }

  function aggregateGames(submissions) {
    const result = {};
    submissions.forEach(sub => {
      const marketName = getMarketName(sub.title);
      if (!result[marketName]) result[marketName] = { amount: 0, bidsCount: 0 };
      result[marketName].amount += Number(sub.bidAmount) || 0;
      result[marketName].bidsCount += 1;
    });
    return result;
  }
  const allUsersResult = await getAllUsers({includeAdmins: true});
  const allUsers = Array.isArray(allUsersResult) ? allUsersResult : allUsersResult.users;

  const admins = allUsers.filter(u => u.isAdmin === true);
  const normalUsers = allUsers.filter(u => !u.isAdmin);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const newUsersCount = normalUsers.filter(u => u.createdAt?.toDate?.() > oneDayAgo).length

  const biddingsSnapshot = await GAME_SUBMISSIONS_COLLECTION.get()

  let totalBiddingAmount = 0
  let totalWinningAmount = 0
  let totalLostAmount = 0

  // Ank count aggregation for half sangam A and B
  function getBaseTitle(title) {
    // Remove " - Half Sangam A" or " - Half Sangam B" from the title
    return title.replace(/ - Half Sangam [AB]/i, "").trim();
  }

  function aggregateAnks(submissions) {
    const result = {};
    submissions.forEach(sub => {
      const baseTitle = getBaseTitle(sub.title);
      const ankMatch = sub.answer && sub.answer.match(/Ank: ?(\d)/);
      const ank = ankMatch ? ankMatch[1] : null;
      if (!ank) return;
      if (!result[baseTitle]) result[baseTitle] = {};
      if (!result[baseTitle][ank]) result[baseTitle][ank] = { amount: 0, bidsCount: 0 };
      result[baseTitle][ank].amount += Number(sub.bidAmount) || 0;
      result[baseTitle][ank].bidsCount += 1;
    });
    return result;
  }

  const halfSangamA = [];
  const halfSangamB = [];

  biddingsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const amount = Number(data.bidAmount) || 0;
    totalBiddingAmount += amount;

    if (data.status === "won") totalWinningAmount += amount;
    else if (data.status === "lost") totalLostAmount += amount;

    if (data.gameType === "Half Sangam A") halfSangamA.push({
      title: data.title,
      bidAmount: data.bidAmount,
      answer: data.answer
    });
    if (data.gameType === "Half Sangam B") halfSangamB.push({
      title: data.title,
      bidAmount: data.bidAmount,
      answer: data.answer
    });
  });

  // Combine both Half Sangam A and B submissions
  const combinedSangam = [...halfSangamA, ...halfSangamB];
  const ank = aggregateAnks(combinedSangam);

  // Aggregation for all game submissions (total amount and bid count per game name)
  const allGameSubmissions = biddingsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      title: data.title,
      bidAmount: data.bidAmount
    };
  });
  const market_detail = aggregateGames(allGameSubmissions);

  const totalSubmissions = biddingsSnapshot.size

  const totalDeclined = await getTotalWithdrawals("declined")
  const totalCompleted = await getTotalWithdrawals("completed")

  const totalGames = (await getAllGames()).length()

  return {
    admins,
    users: normalUsers,
    gamesCount: totalGames,
    stats: {
      totalBiddingAmount,
      totalWinningAmount,
      totalLostAmount,
      totalSubmissions,
      newUsersCount
    },
    ank, // <-- Add ank separately
      market_detail, // <-- Add market detail separately
    totalCompleted,
    totalDeclined
  }
}

// USELESS FOR NOW (DON'T DELETE THOUGH)
export const getNormalUsers = async () => {
  const snapshot = await USERS_COLLECTION.where("isAdmin", "==", false).get()
  const users = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
  return { users }
}

export const getAllAppSettings = async () => {
  const snapshot = await db.collection("app_settings").get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const getDeposits = async () => {
  const snapshot = await db.collection("deposits").get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const getWithdrawl = async () => {
  const snapshot = await db.collection("withdrawl").get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const getFunds = async () => {
  const snapshot = await db.collection("funds").get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const getFundsTransactions = async () => {
  const snapshot = await db.collection("funds_transactions").get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export const getGameSubmissions = async () => {
  const snapshot = await GAME_SUBMISSIONS_COLLECTION.get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
