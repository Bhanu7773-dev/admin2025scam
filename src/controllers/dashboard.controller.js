import { getDashboard } from "../services/dashboard.service.js";

import { getNormalUsers } from "../services/dashboard.service.js";

import { getAllAppSettings } from "../services/dashboard.service.js";

import { getDeposits } from "../services/dashboard.service.js";

import { getWithdrawl } from "../services/dashboard.service.js";

import { getFunds } from "../services/dashboard.service.js";

import { getFundsTransactions } from "../services/dashboard.service.js";

import { getGameSubmissions } from "../services/dashboard.service.js";

export async function getDashboardHandler(req, rep) {
  try {
    const data = await getDashboard()
    rep.send({ data })
  } catch (err) {
    rep.status(500).send({ error: err instanceof Error ? err.message : "Unknown error" })
  }
}
export async function getNormalUsersHandler(req, rep) {
    const data = await getNormalUsers();
    rep.send({
        data
    });
}

export async function getAllAppSettingsHandler(req, rep) {
    const data = await getAllAppSettings();
    rep.send({
        data
    });
}

import { db } from "../plugins/firebase.js";

export async function getAppSettingHandler(req, rep) {
    const docId = req.params.docId;
    const doc = await db.collection('app_settings').doc(docId).get();
    rep.send({ data: doc.data() });
}

export async function getDepositsHandler(req, rep) {
    const data = await getDeposits();
    rep.send({ data });
}

export async function getWithdrawlHandler(req, rep) {
    const data = await getWithdrawl();
    rep.send({ data });
}

export async function getFundsHandler(req, rep) {
    const data = await getFunds();
    rep.send({ data });
}

export async function getFundsTransactionsHandler(req, rep) {
    const data = await getFundsTransactions();
    rep.send({ data });
}

export async function getGameSubmissionsHandler(req, rep) {
    const data = await getGameSubmissions();
    rep.send({ data });
}