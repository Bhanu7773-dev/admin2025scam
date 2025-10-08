import { db, admin } from "../plugins/firebase.js"

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
  // fund requests
  const depositsSnap = await db.collection("deposits").get()
  const depositDocs = depositsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  // get all unique uids
  const uids = [...new Set(depositDocs.map(d => d.uid).filter(Boolean))]

  // fetch user info from auth
  const userInfoMap = {}
  for (const uid of uids) {
    try {
      const user = await admin.auth().getUser(uid)
      const email = user.email || ""
      const phone = email.includes("@") ? email.split("@")[0] : ""
      userInfoMap[uid] = {
        username: user.displayName || "User",
        mobile: phone || user.phoneNumber || "",
      }
    } catch {
      userInfoMap[uid] = { username: "User", mobile: "" }
    }
  }

  const fundRequests = depositDocs.map((d, i) => {
    const info = userInfoMap[d.uid] || {}
    const createdAt =
      d.createdAt?.toDate?.().toISOString().slice(0, 10) || null

    return {
      index: i + 1,
      username: info.username,
      mobile: info.mobile,
      amount: d.amount || 0,
      requestNo: d.requestNo || d.id,
      date: createdAt,
      status: d.status || "",
    }
  })

  const totalFundRequestAmount = fundRequests.reduce(
    (s, r) => s + (r.amount || 0),
    0
  )

  // withdrawls
  const withdrawSnap = await db.collection("withdrawl").get()
  const withdrawDocs = withdrawSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const withdrawUids = [...new Set(withdrawDocs.map(d => d.uid).filter(Boolean))]

  const withdrawUserInfoMap = {}
  for (const uid of withdrawUids) {
    try {
      const user = await admin.auth().getUser(uid)
      const email = user.email || ""
      const phone = email.includes("@") ? email.split("@")[0] : ""
      withdrawUserInfoMap[uid] = {
        username: user.displayName || "User",
        mobile: phone || user.phoneNumber || "",
      }
    } catch {
      withdrawUserInfoMap[uid] = { username: "User", mobile: "" }
    }
  }

  const fundWithdrawals = withdrawDocs.map((d, i) => {
    const info = withdrawUserInfoMap[d.uid] || {}
    const createdAt =
      d.createdAt?.toDate?.().toISOString().slice(0, 10) || null

    return {
      index: i + 1,
      username: info.username,
      mobile: info.mobile,
      amount: d.amount || 0,
      requestNo: d.withdrawalId || d.id,
      date: createdAt,
      status: d.status || "",
    }
  })

  const totalFundWithdrawlAmount = fundWithdrawals.reduce(
    (s, r) => s + (r.amount || 0),
    0
  )

  return {
    fund_requests: {
      total_amount: totalFundRequestAmount,
      list: fundRequests,
    },
    fund_withdrawals: {
      total_amount: totalFundWithdrawlAmount,
      list: fundWithdrawals,
    },
  }
}
