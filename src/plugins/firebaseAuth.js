import { admin } from './firebase.js';

// Fastify middleware to verify Firebase ID token from Authorization header.
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
        // Attach decoded token (uid, email, etc.) to request for downstream handlers
        request.user = decoded;
    } catch (err) {
        console.error('Firebase token verification failed:', err);
        return reply.code(401).send({ error: 'Invalid or expired token' });
    }
}
