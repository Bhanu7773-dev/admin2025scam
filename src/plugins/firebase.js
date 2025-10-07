import admin from 'firebase-admin'

const serviceAccount = {
    type: "service_account",
    project_id: "sara777-f6922",
    private_key_id: "dc8428c684e8407a210fb875e1f0ce4c04ada7ab",
    private_key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC9UMcnseeZWHNr
rjtpJDndKn3pxzO1mr+BY3kneIj1b1lY7fF2rndz7o8RxtdeV9Qz00T6Jy2xkC1Y
DTaLW81IHPFNZiEJWf86+03XvluMWmzq0QS2KPB8+/FB7q5PtKkT08VIwxzHD7ZO
FUKR+o9EXXhCjuEp9EijPMeAANh46InezXbJoE3Gll5wtgZrJ1n/1d9D/xlQw3+T
edFMh6BZRNJckTlL+D6JeUATfUSbR3Qbtl06X5rGswEt37X+tZMyA8XvgH7xxb+F
dR00tG4t9TshELKmD+iAP2MeQB+ClrV+W8PuyoqEDCpy2HzxDiVEIpZ6H426laAB
xCCq5RebAgMBAAECggEALfzhZBMjX2zNHOtGI1RZehBIZfGt7f+ZZaT0WVI+cuCJ
o8CpV1sqSU86Eedric9sDOrVZq79upR7b1hGV7QFOe9N7q9QdyUViw5g6nejZYTR
0HjV3Co1wSayhIGmdlY8fESFOBetde2rK2yerzdedgz+max7peVhf8XT8JREAZqQ
Equi1ySsKY2LXrozEgDNKhe4mMlgtDgBgIR39/1NN5gMt5nvJqJWds1l+FWh+w5B
8MH+JBxJfvGQrLXVmY8QVeZHmJPXp2KocYZSZnLrWFsdefZVkjiBvwh6LVuHd9wh
BUSsZELTzgpHR8POecUtXBKdM6mW97me+RcYTX65AQKBgQDu7LG6SVl+HN/JYdSo
Y0o6opcwjfGaPlEiOFVpgCAzXa+Ddu2hBMvLicx8za0AvDqORJrHZYqyRZLDflOl
/2P6eBJmOfSfNm2UC0iqedGtUPRhKef0J3P1Zdxv+b5/3cZT0u4IGnBz+MtGXp24
WdsvAnWBO7R1Xt2n3GMNHFs02QKBgQDK2HLeKTFnO7IhFPc1Lui2uxNqQ8kpsQ1q
mQ1e2bK6Fwc3fVTBsSbV6DMeQooeCgNtMFKpi1ZcngV9Q2HUku0YhJQE58pkDcR9
e/6Wi3WilFg8Ks/84KqNGK2sCagjk8Z2OuclbjjEtoIn+EOsL/ftvvma7ozi0lF2
LDp2BhBXkwKBgQDFn4JiU8lyRu/T4tfDcF01osbronz02BbD91SurwvzcMp8MyLa
zNzEvnYlxPoUYZ0NkDF2PMc8Lc/3Y8ZMx7IquqZ9Z/KuvpZknfC9EYYdlZiNxdvW
V8vSby6mcCziFs61BwNcMIJTara4vgo3MhvaBm6rNndNneo5rlE/xvSqAQKBgQCN
9HwuzVUtkbFPRYTbS0DA4JrtuxKEgsuI1iNtRZy2bnc2dhdilb8/44ginR5bd1Z+
i1rOHB0MI+pjh0xnn4sdpWqRJEWXT6s6xhOc92wTow08zhlQN0okBClGRFvOyhQR
mZc5srE3uSHNJwj073zqfMPhkSA3fEhWEw22mvfE0QKBgDmEfDkJNTj00CjCYUio
cTwO7DLZ8+zQBaow/1a2J2nWs53znIYN28pjXzZKPrzp6zl/q1mIqpDkBJuKQj30
tblJTtkw7aZPnNhbf1PoLcqaujwmFNQFdBPxBIX+0nI44N2OWK2+jPfHizpIxcVh
kAccs7wAqvfYrStfhlHXQgRx
-----END PRIVATE KEY-----`,
    client_email: "firebase-adminsdk-fbsvc@sara777-f6922.iam.gserviceaccount.com",
    client_id: "117093748564358924016",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40sara777-f6922.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
};

if (!admin.apps?.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore()

export { admin, db };