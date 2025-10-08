export const getAllWithdrawals = async () => {
  const withdrawlSnapshot = await db.collection("withdrawl").get();
  // Get all unique uids from withdrawl
  const uids = withdrawlSnapshot.docs.map(doc => doc.data().uid).filter(Boolean);
  // Fetch user info from Firebase Auth for each uid
  const userInfoMap = {};
  for (const uid of uids) {
    try {
      const userRecord = await admin.auth().getUser(uid);
      userInfoMap[uid] = {
        username: userRecord.displayName || null,
        phone: userRecord.phoneNumber || null,
        email: userRecord.email || null
      };
    } catch (err) {
      userInfoMap[uid] = { username: null, phone: null, email: null };
    }
  }
  const fundWithdrawals = withdrawlSnapshot.docs.map(doc => {
    const data = doc.data();
    const info = userInfoMap[data.uid] || { username: null, phone: null, email: null };
    let createdDate = null;
    if (data.createdAt?.toDate) {
      const dateObj = data.createdAt.toDate();
      createdDate = dateObj.toISOString().slice(0, 10);
    } else if (data.createdAt) {
      createdDate = typeof data.createdAt === 'string' ? data.createdAt.slice(0, 10) : null;
    }
    return {
      username: info.username || 'user',
      no: info.email || '',
      amount: data.amount || null,
      createdAt: createdDate,
      status: data.status || null
    };
  });
  return { fund_withdrawl: fundWithdrawals };
}
import { db, admin } from "../plugins/firebase.js"

export const getFundsOfUser = async ({ uuid }) => {
  if (!uuid) throw new Error("getFundsOfUser(): uuid is required")

  const snapshot = await db.collection("funds").where("uid", "==", uuid).limit(1).get()

  if (snapshot.empty) return { balance: 0, uid }

  const doc = snapshot.docs[0]
  const data = doc.data()

  return {
    uuid: doc.id,
    balance: data.balance || 0,
    createdAt: data.createdAt?.toDate?.() || null,
    updatedAt: data.updatedAt?.toDate?.() || null,
    lastSyncAt: data.lastSyncAt?.toDate?.() || null,
    lastUpdateReason: data.lastUpdateReason || null
  }

}

export const getAllFunds = async () => {
  const depositsSnapshot = await db.collection("deposits").get();
  // Get all unique uids from deposits
  const uids = depositsSnapshot.docs.map(doc => doc.data().uid).filter(Boolean);
  // Fetch user info from Firebase Auth for each uid
  const userInfoMap = {};
  for (const uid of uids) {
    try {
      const userRecord = await admin.auth().getUser(uid);
      userInfoMap[uid] = {
        username: userRecord.displayName || null,
        phone: userRecord.phoneNumber || null,
        email: userRecord.email || null
      };
    } catch (err) {
      userInfoMap[uid] = { username: null, phone: null };
    }
  }
  // Fund Requests
  const fundRequests = depositsSnapshot.docs.map(doc => {
    const data = doc.data();
    const info = userInfoMap[data.uid] || { username: null, phone: null, email: null };
    let createdDate = null;
    if (data.createdAt?.toDate) {
      const dateObj = data.createdAt.toDate();
      createdDate = dateObj.toISOString().slice(0, 10);
    } else if (data.createdAt) {
      createdDate = typeof data.createdAt === 'string' ? data.createdAt.slice(0, 10) : null;
    }
    return {
      username: info.username || 'user',
      no: info.email || '',
      amount: data.amount || null,
      createdAt: createdDate,
      status: data.status || null
    };
  });

  const totalPendingFundRequestAmount = fundRequests
    .filter(req => req.status === 'pending')
    .reduce((sum, req) => sum + (req.amount || 0), 0);

  // Fund Withdrawals
  const withdrawlSnapshot = await db.collection("withdrawl").get();
  const withdrawlUids = withdrawlSnapshot.docs.map(doc => doc.data().uid).filter(Boolean);
  const withdrawlUserInfoMap = {};
  for (const uid of withdrawlUids) {
    try {
      const userRecord = await admin.auth().getUser(uid);
      withdrawlUserInfoMap[uid] = {
        username: userRecord.displayName || null,
        phone: userRecord.phoneNumber || null,
        email: userRecord.email || null
      };
    } catch (err) {
      withdrawlUserInfoMap[uid] = { username: null, phone: null, email: null };
    }
  }
  const fundWithdrawals = withdrawlSnapshot.docs.map(doc => {
    const data = doc.data();
    const info = withdrawlUserInfoMap[data.uid] || { username: null, phone: null, email: null };
    let createdDate = null;
    if (data.createdAt?.toDate) {
      const dateObj = data.createdAt.toDate();
      createdDate = dateObj.toISOString().slice(0, 10);
    } else if (data.createdAt) {
      createdDate = typeof data.createdAt === 'string' ? data.createdAt.slice(0, 10) : null;
    }
    return {
      username: info.username || 'user',
      no: info.email || '',
      amount: data.amount || null,
      createdAt: createdDate,
      status: data.status || null
    };
  });

  const totalFundRequestAmount = fundRequests.reduce((sum, req) => sum + (req.amount || 0), 0);
  const totalAcceptedFundRequestAmount = fundRequests
    .filter(req => req.status === 'approved')
    .reduce((sum, req) => sum + (req.amount || 0), 0);
  const totalDeclinedFundRequestAmount = fundRequests
    .filter(req => req.status === 'declined')
    .reduce((sum, req) => sum + (req.amount || 0), 0);
  // Withdrawals totals
  const totalFundWithdrawlAmount = fundWithdrawals.reduce((sum, req) => sum + (req.amount || 0), 0);
  const totalAcceptedFundWithdrawlAmount = fundWithdrawals
    .filter(req => req.status === 'approved')
    .reduce((sum, req) => sum + (req.amount || 0), 0);
  const totalDeclinedFundWithdrawlAmount = fundWithdrawals
    .filter(req => req.status === 'declined')
    .reduce((sum, req) => sum + (req.amount || 0), 0);
  const totalPendingFundWithdrawlAmount = fundWithdrawals
    .filter(req => req.status === 'pending')
    .reduce((sum, req) => sum + (req.amount || 0), 0);

  return {
    fund_request: {
      list: fundRequests,
      total_fund_request_amount: totalFundRequestAmount,
      total_accepted_fund_request_amount: totalAcceptedFundRequestAmount,
      total_declined_fund_request_amount: totalDeclinedFundRequestAmount,
      total_pending_fund_request_amount: totalPendingFundRequestAmount
    },
    fund_withdrawl: {
      list: fundWithdrawals,
      total_fund_withdrawl_amount: totalFundWithdrawlAmount,
      total_accepted_fund_withdrawl_amount: totalAcceptedFundWithdrawlAmount,
      total_declined_fund_withdrawl_amount: totalDeclinedFundWithdrawlAmount,
      total_pending_fund_withdrawl_amount: totalPendingFundWithdrawlAmount
    }
  };
}
