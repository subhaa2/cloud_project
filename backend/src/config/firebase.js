const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('../../service-account.json');

function getServiceAccount() {
    const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawEnv) {
        return JSON.parse(rawEnv);
    }

    const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (pathEnv) {
        const absPath = path.resolve(__dirname, '../../', pathEnv);
        const fileContents = fs.readFileSync(absPath, 'utf8');
        return JSON.parse(fileContents);
    }

    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
}

if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.GCS_BUCKET_NAME
    });
}

const db = admin.firestore();

module.exports = {
    admin,
    db
};

