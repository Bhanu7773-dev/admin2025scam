import { db } from "../plugins/firebase.js"

const USERS_COLLECTION = db.collection("users")

export const getDashboard = async () => {
  const snapshot = await USERS_COLLECTION.where("isAdmin", "==", true).get()

  const admins = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))

  return { admins }
}

export const getNormalUsers = async () => {
  const snapshot = await USERS_COLLECTION.where("isAdmin", "==", false).get()

  const users = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))

  return { users }
}

export const getAllAppSettings = async () => {
  const snapshot = await db.collection('app_settings').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export const getDeposits = async () => {
  const snapshot = await db.collection('deposits').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export const getWithdrawl = async () => {
  const snapshot = await db.collection('withdrawl').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export const getFunds = async () => {
  const snapshot = await db.collection('funds').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export const getFundsTransactions = async () => {
  const snapshot = await db.collection('funds_transactions').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export const getGameSubmissions = async () => {
  const snapshot = await db.collection('game_submissions').get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}