import { db } from "../plugins/firebase.js"

export const getTotalWithdrawals = async (statusFilter) => {
  let snapshot

  if (statusFilter) {
    snapshot = await db.collection("withdrawl").where("status", "==", statusFilter).get()
  } else {
    snapshot = await db.collection("withdrawl").get()
  }

  const totalAmount = snapshot.docs.reduce((acc, doc) => {
    const data = doc.data()
    return acc + (Number(data.amount) || 0)
  }, 0)

  return totalAmount
}
