import { db, admin } from "../plugins/firebase.js";

const USERS_COLLECTION = db.collection("users")

// helper: batch array into chunks
const chunkArray = (arr, size) => {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export const getAllUsers = async ({
  includeAdmins = false,
  limit = 20,
  startAfterId,
} = {}) => {
  let query = db.collection("users").orderBy("createdAt", "desc").limit(limit)
  if (!includeAdmins) query = query.where("isAdmin", "==", false)

  if (startAfterId) {
    const lastDoc = await db.collection("users").doc(startAfterId).get()
    if (lastDoc.exists) query = query.startAfter(lastDoc)
  }

  const snapshot = await query.get()
  const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  const uids = users.map(u => u.uid).filter(Boolean)

  if (!uids.length) return { users: [], nextCursor: null }

  // --- Fetch Auth info in batches ---
  const authMap = new Map()
  const uidChunks = chunkArray(uids, 100)
  for (const chunk of uidChunks) {
    await Promise.all(
      chunk.map(async uid => {
        try {
          const userRecord = await admin.auth().getUser(uid)
          const email = userRecord.email || ""
          const phone = email.includes("@") ? email.split("@")[0] : "N/A"
          authMap.set(uid, {
            username: userRecord.displayName || "User",
            email,
            mobile: phone,
          })
        } catch {
          authMap.set(uid, { username: "User", email: "", mobile: "N/A" })
        }
      })
    )
  }

  // --- Fetch funds ---
  const fundsMap = new Map()
  for (const chunk of chunkArray(uids, 10)) {
    const snap = await db.collection("funds").where("uid", "in", chunk).get()
    snap.docs.forEach(doc => {
      const data = doc.data()
      fundsMap.set(data.uid, data.balance || 0)
    })
  }

  // --- Betting status (pending only) ---
  const bettingMap = new Map()
  for (const chunk of chunkArray(uids, 10)) {
    const snap = await db.collection("game_submissions")
      .where("uid", "in", chunk)
      .where("status", "==", "pending")
      .get()
    snap.docs.forEach(doc => {
      const data = doc.data()
      if (data.uid) bettingMap.set(data.uid, true)
    })
  }

  // --- Transfer status (pending only from funds_transactions & withdrawl) ---
  const transferMap = new Map()
  for (const chunk of chunkArray(uids, 10)) {
    const [fundTxSnap, withdrawSnap] = await Promise.all([
      db.collection("funds_transactions").where("uid", "in", chunk).where("status", "==", "pending").get(),
      db.collection("withdrawl").where("uid", "in", chunk).where("status", "==", "pending").get(),
    ])
    fundTxSnap.docs.forEach(doc => {
      const data = doc.data()
      if (data.uid) transferMap.set(data.uid, true)
    })
    withdrawSnap.docs.forEach(doc => {
      const data = doc.data()
      if (data.uid) transferMap.set(data.uid, true)
    })
  }

  // --- Map final results ---
  const results = users
    .filter(u => authMap.has(u.uid)) // only users present in Auth
    .map(u => {
      const auth = authMap.get(u.uid)
      return {
        id: u.id,
        username: auth.username || "User",
        mobile: auth.mobile || "N/A",
        email: auth.email || "",
        date: u.createdAt?._seconds
          ? new Date(u.createdAt._seconds * 1000).toISOString().split("T")[0]
          : null,
        balance: fundsMap.get(u.uid) || 0,
        betting: bettingMap.has(u.uid) || false,
        transfer: transferMap.has(u.uid) || false,
      }
    })

  const lastVisible = snapshot.docs[snapshot.docs.length - 1]
  const nextCursor = lastVisible ? lastVisible.id : null

  return { users: results, nextCursor }
}

export const getUser = async ({ uuid }) => {
    if (!uuid) throw new Error("getUser(): uuid is empty")

    const docRef = USERS_COLLECTION.doc(uuid)
    const docSnap = await docRef.get()

    if (!docSnap.exists) return null

    return { id: docSnap.id, ...docSnap.data() }
}
