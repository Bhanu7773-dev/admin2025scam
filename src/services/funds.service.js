import { db } from "../plugins/firebase.js"

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

export const getAllFunds = async ({ limit = 20, startAfterId }) => {
  let funds = []
  return funds;
}
