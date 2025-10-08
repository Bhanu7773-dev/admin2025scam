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
  return depositsSnapshot.docs.map(doc => {
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
}
