import { db } from "../plugins/firebase.js";

const USERS_COLLECTION = db.collection("users")

export const getAllUsers = async ({ includeAdmins = false, limit = 20, startAfterId } = {}) => {
  let query = USERS_COLLECTION.orderBy("createdAt", "desc").limit(limit)

  if (!includeAdmins) {
    query = query.where("isAdmin", "==", false)
  }

  if (startAfterId) {
    const lastDoc = await USERS_COLLECTION.doc(startAfterId).get()
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc)
    }
  }

  const snapshot = await query.get()

  const users = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  const lastVisible = snapshot.docs[snapshot.docs.length - 1]
  const nextCursor = lastVisible ? lastVisible.id : null

  return { users, nextCursor }
}

export const getUser = async ({ uuid }) => {
    if (!uuid) throw new Error("getUser(): uuid is empty")

    const docRef = USERS_COLLECTION.doc(uuid)
    const docSnap = await docRef.get()

    if (!docSnap.exists) return null

    return { id: docSnap.id, ...docSnap.data() }
}
