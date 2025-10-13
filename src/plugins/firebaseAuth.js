import { admin } from './firebase.js';

// Fastify middleware to verify Firebase ID token from Authorization header and ensure
// the corresponding Firestore user document exists and has isAdmin or isSubAdmin set.
export async function verifyFirebaseIdToken(request, reply) {
    try {
        const authHeader = request.headers['authorization'] || request.headers['Authorization'];
        if (!authHeader) {
            return reply.code(401).send({ error: 'Missing Authorization header' });
        }

        const parts = authHeader.split(' ');
        const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
        if (!token) {
            return reply.code(401).send({ error: 'Invalid Authorization header format. Expected: "Bearer <token>"' });
        }

        const decoded = await admin.auth().verifyIdToken(token);

        // Look up the corresponding user document in Firestore
        const userDocRef = admin.firestore().collection('users').doc(decoded.uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            // No Firestore user record -> forbidden
            return reply.code(403).send({ error: 'Access denied: user record not found' });
        }

        const userData = userDoc.data() || {};
        const isAdmin = Boolean(userData.isAdmin);
        const isSubAdmin = Boolean(userData.isSubAdmin);

        if (!isAdmin && !isSubAdmin) {
            // Not an admin or sub-admin -> forbidden
            return reply.code(403).send({ error: 'Access denied: not an admin' });
        }

        // Attach decoded token and Firestore user data for downstream handlers
        request.user = decoded;
        request.userDoc = userData;

    } catch (err) {
        console.error('Firebase token verification failed:', err);
        return reply.code(401).send({ error: 'Invalid or expired token' });
    }
}
