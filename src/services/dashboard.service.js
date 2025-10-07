import { db } from "../plugins/firebase.js"

const USERS_COLLECTION = db.collection("users")
const GAME_SUBMISSIONS_COLLECTION = db.collection("game_submissions")

export const getDashboard = async () => {
  const usersSnapshot = await USERS_COLLECTION.get()
  const allUsers = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    isActive: true
  }))

  const admins = allUsers.filter(u => u.isAdmin === true)
  const normalUsers = allUsers.filter(u => !u.isAdmin)

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const newUsersCount = normalUsers.filter(u => u.createdAt?.toDate?.() > oneDayAgo).length

  const biddingsSnapshot = await GAME_SUBMISSIONS_COLLECTION.get()
  const totalBiddingAmount = biddingsSnapshot.docs.reduce(
    (acc, doc) => acc + (Number(doc.data().bidAmount) || 0),
    0
  )
  const totalSubmissions = biddingsSnapshot.size

  return {
    admins,
    users: normalUsers,
    stats: { totalBiddingAmount, totalSubmissions, newUsersCount }
  }
}

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
