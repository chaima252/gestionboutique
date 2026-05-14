require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ═══════════════════════════════
//  SQLITE SETUP
// ═══════════════════════════════
const dbPath = path.join(__dirname, "data", "boutique.db");
if (!fs.existsSync(path.join(__dirname, "data"))) fs.mkdirSync(path.join(__dirname, "data"));

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS etats (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    montantTotal REAL NOT NULL,
    finFields TEXT,
    ecarts TEXT,
    totalFin REAL,
    justifications TEXT DEFAULT '[]',
    status TEXT DEFAULT 'open',
    openedAt INTEGER,
    closedAt INTEGER,
    lastNotifiedAt INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS versements (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    montant REAL NOT NULL,
    note TEXT DEFAULT '',
    pieceJointe TEXT,
    createdAt INTEGER,
    locked INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS caisses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    initial REAL DEFAULT 0,
    totalEtatJour REAL DEFAULT 0,
    totalVerse REAL DEFAULT 0,
    totalRecouv REAL DEFAULT 0,
    depenses REAL DEFAULT 0,
    solde REAL DEFAULT 0,
    reste REAL DEFAULT 0,
    note TEXT DEFAULT '',
    createdAt INTEGER,
    locked INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS recouvrements (
    id TEXT PRIMARY KEY,
    etatId TEXT NOT NULL,
    justificationId TEXT NOT NULL UNIQUE,
    dateRecuperation TEXT NOT NULL,
    montant REAL NOT NULL,
    createdAt INTEGER
  );
`);

// ─── Helpers SQLite ───
function getEtats() {
  return db.prepare("SELECT * FROM etats").all().map(e => ({
    ...e,
    finFields: e.finFields ? JSON.parse(e.finFields) : null,
    ecarts: e.ecarts ? JSON.parse(e.ecarts) : null,
    justifications: e.justifications ? JSON.parse(e.justifications) : [],
  }));
}

function getEtatById(id) {
  const e = db.prepare("SELECT * FROM etats WHERE id = ?").get(id);
  if (!e) return null;
  return {
    ...e,
    finFields: e.finFields ? JSON.parse(e.finFields) : null,
    ecarts: e.ecarts ? JSON.parse(e.ecarts) : null,
    justifications: e.justifications ? JSON.parse(e.justifications) : [],
  };
}

function saveEtat(etat) {
  db.prepare(`
    INSERT OR REPLACE INTO etats
    (id, date, montantTotal, finFields, ecarts, totalFin, justifications, status, openedAt, closedAt, lastNotifiedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    etat.id, etat.date, etat.montantTotal,
    etat.finFields ? JSON.stringify(etat.finFields) : null,
    etat.ecarts ? JSON.stringify(etat.ecarts) : null,
    etat.totalFin ?? null,
    JSON.stringify(etat.justifications || []),
    etat.status, etat.openedAt, etat.closedAt ?? null, etat.lastNotifiedAt ?? 0
  );
}

function getVersements() {
  return db.prepare("SELECT * FROM versements").all();
}

function saveVersement(v) {
  db.prepare(`
    INSERT OR REPLACE INTO versements (id, date, montant, note, pieceJointe, createdAt, locked)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(v.id, v.date, v.montant, v.note, v.pieceJointe, v.createdAt, v.locked ? 1 : 0);
}

function getCaisses() {
  return db.prepare("SELECT * FROM caisses").all();
}

function saveCaisse(c) {
  db.prepare(`
    INSERT OR REPLACE INTO caisses
    (id, date, initial, totalEtatJour, totalVerse, totalRecouv, depenses, solde, reste, note, createdAt, locked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(c.id, c.date, c.initial, c.totalEtatJour, c.totalVerse, c.totalRecouv,
    c.depenses, c.solde, c.reste, c.note, c.createdAt, c.locked ? 1 : 0);
}

function getRecouvrements() {
  return db.prepare("SELECT * FROM recouvrements").all();
}

function saveRecouvrement(r) {
  db.prepare(`
    INSERT OR REPLACE INTO recouvrements (id, etatId, justificationId, dateRecuperation, montant, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(r.id, r.etatId, r.justificationId, r.dateRecuperation, r.montant, r.createdAt);
}

// ═══════════════════════════════
//  EMAIL
// ═══════════════════════════════
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
transporter.verify((err) => {
  if (err) console.log("SMTP non connecte:", err.message);
  else console.log("SMTP OK:", process.env.SMTP_HOST);
});

async function sendNotification(etat, heures) {
  const recipients = [process.env.EMAIL_ADMIN, process.env.EMAIL_FINANCIER].filter(Boolean);
  if (!recipients.length) return;
  try {
    await transporter.sendMail({
      from: `"Gestion Boutique" <${process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      subject: `Etat du ${etat.date} ouvert depuis ${heures}h`,
      html: `<div style="font-family:monospace;padding:20px;background:#0f1117;color:#e8e0d0;">
        <h2 style="color:#fbbf24;">Etat ouvert depuis ${heures}h</h2>
        <p>L etat du <strong>${etat.date}</strong> n est toujours pas ferme.</p>
      </div>`,
    });
  } catch (err) { console.error("Erreur email:", err.message); }
}

setInterval(() => {
  const now = Date.now();
  const etats = getEtats();
  etats.forEach(e => {
    if (e.status !== "open") return;
    const heures = Math.floor((now - e.openedAt) / 3600000);
    if (heures >= 24) {
      const depuisNotif = now - (e.lastNotifiedAt || 0);
      if (!e.lastNotifiedAt || depuisNotif >= 6 * 3600000) {
        sendNotification(e, heures);
        e.lastNotifiedAt = now;
        saveEtat(e);
      }
    }
  });
}, 3600000);

// ─── Calcul automatique caisse pour une date ───
function calculerCaisse(date) {
  const caisses = getCaisses();
  const caissesTriees = [...caisses].sort((a, b) => a.date.localeCompare(b.date));
  let initial = 0;
  const caissesAvant = caissesTriees.filter(c => c.date < date);
  if (caissesAvant.length > 0) initial = caissesAvant[caissesAvant.length - 1].reste;

  const etats = getEtats();
  const versements = getVersements();
  const recouvrements = getRecouvrements();

  const etatDuJour = etats.find(e => e.date === date && e.finFields);
  const totalEtatJour = etatDuJour ? parseFloat(etatDuJour.totalFin || 0) : 0;

  const versementsDuJour = versements.filter(v => v.date === date);
  const totalVerse = versementsDuJour.reduce((s, v) => s + v.montant, 0);

  const recouvDuJour = recouvrements.filter(r => r.dateRecuperation === date);
  const totalRecouv = recouvDuJour.reduce((s, r) => s + r.montant, 0);

  const caisseCourante = caisses.find(c => c.date === date);
  const depenses = caisseCourante ? parseFloat(caisseCourante.depenses || 0) : 0;

  const solde = parseFloat((initial + totalEtatJour + totalRecouv - totalVerse - depenses).toFixed(3));
  return { initial, totalEtatJour, totalVerse, totalRecouv, depenses, solde, reste: solde };
}

// ═══════════════════════════════
//  ETATS DE VENTE
// ═══════════════════════════════
app.get("/api/etats", (req, res) => res.json(getEtats()));

app.post("/api/etats", (req, res) => {
  const { date, montantTotal } = req.body;
  if (!date || montantTotal === undefined) return res.status(400).json({ error: "Manque date ou montantTotal" });

  const etats = getEtats();
  const dejaExistant = etats.find(e => e.date === date);
  if (dejaExistant) return res.status(400).json({ error: "Un état existe déjà pour le " + date });

  const etat = {
    id: Date.now().toString(), date,
    montantTotal: parseFloat(montantTotal),
    finFields: null, ecarts: null, totalFin: null,
    justifications: [],
    status: "open",
    openedAt: Date.now(), closedAt: null, lastNotifiedAt: 0,
  };
  saveEtat(etat);
  res.status(201).json(etat);
});

app.put("/api/etats/:id/valider", (req, res) => {
  const etat = getEtatById(req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  if (etat.status === "closed") return res.status(400).json({ error: "Deja ferme" });

  const { finFields } = req.body;
  etat.finFields = finFields;
  const totalFin = Object.values(finFields).reduce((s, v) => s + parseFloat(v || 0), 0);
  etat.totalFin = parseFloat(totalFin.toFixed(3));
  const ecartGlobal = parseFloat((totalFin - etat.montantTotal).toFixed(3));
  etat.ecarts = { ecartGlobal };

  if (Math.abs(ecartGlobal) < 0.001) {
    etat.status = "closed";
    etat.closedAt = Date.now();
    console.log("Etat ferme automatiquement (aucun ecart): " + etat.id);
  }
  saveEtat(etat);
  res.json(etat);
});

app.post("/api/etats/:id/justifications", (req, res) => {
  const etat = getEtatById(req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });

  const { type, montant, note } = req.body;
  etat.justifications.push({
    id: Date.now().toString(), type,
    montant: parseFloat(montant), note,
    recupere: false, dateRecuperation: null,
  });
  saveEtat(etat);
  res.json(etat);
});

app.delete("/api/etats/:id/justifications/:jid", (req, res) => {
  const etat = getEtatById(req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  etat.justifications = etat.justifications.filter(j => j.id !== req.params.jid);
  saveEtat(etat);
  res.json(etat);
});

app.put("/api/etats/:id/fermer", (req, res) => {
  const etat = getEtatById(req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  if (!etat.finFields) return res.status(400).json({ error: "Etat pas encore validé par le financier." });

  const ecart = etat.ecarts?.ecartGlobal || 0;
  const totalJustifie = etat.justifications.reduce((s, j) => s + j.montant, 0);
  const restant = parseFloat((Math.abs(ecart) - totalJustifie).toFixed(3));

  if (restant > 0.001)
    return res.status(400).json({
      error: "Écart de " + restant.toFixed(3) + " TND non justifié. Fermeture impossible."
    });

  etat.status = "closed";
  etat.closedAt = Date.now();
  saveEtat(etat);
  res.json(etat);
});

// ═══════════════════════════════
//  RECOUVREMENTS
// ═══════════════════════════════
app.get("/api/recouvrements", (req, res) => {
  const recouvrements = getRecouvrements();
  const etats = getEtats();
  const enriched = recouvrements.map(r => {
    const etat = etats.find(e => e.id === r.etatId);
    const just = etat?.justifications.find(j => j.id === r.justificationId);
    return { ...r, etatDate: etat?.date, justType: just?.type, justNote: just?.note };
  });
  res.json(enriched);
});

app.get("/api/ecarts-a-recuperer", (req, res) => {
  const etats = getEtats();
  const recouvrements = getRecouvrements();
  const result = [];
  etats.forEach(etat => {
    etat.justifications.forEach(j => {
      const dejaRecupere = recouvrements.find(r => r.justificationId === j.id);
      if (!dejaRecupere) {
        result.push({
          etatId: etat.id, etatDate: etat.date,
          justificationId: j.id, type: j.type,
          montant: j.montant, note: j.note,
        });
      }
    });
  });
  res.json(result);
});

app.post("/api/recouvrements", (req, res) => {
  const { etatId, justificationId, dateRecuperation, montant } = req.body;
  if (!etatId || !justificationId || !dateRecuperation) return res.status(400).json({ error: "Manque données" });

  const etat = getEtatById(etatId);
  if (!etat) return res.status(404).json({ error: "Etat introuvable" });
  const just = etat.justifications.find(j => j.id === justificationId);
  if (!just) return res.status(404).json({ error: "Justification introuvable" });

  const recouvrements = getRecouvrements();
  if (recouvrements.find(r => r.justificationId === justificationId))
    return res.status(400).json({ error: "Deja recupere" });

  const recouvrement = {
    id: Date.now().toString(),
    etatId, justificationId, dateRecuperation,
    montant: parseFloat(montant || just.montant),
    createdAt: Date.now(),
  };
  saveRecouvrement(recouvrement);

  just.recupere = true;
  just.dateRecuperation = dateRecuperation;
  saveEtat(etat);

  const caisses = getCaisses();
  const caisseDuJour = caisses.find(c => c.date === dateRecuperation);
  if (caisseDuJour) {
    const calc = calculerCaisse(dateRecuperation);
    saveCaisse({ ...caisseDuJour, ...calc });
  }

  res.status(201).json(recouvrement);
});

// ═══════════════════════════════
//  VERSEMENTS BANQUE
// ═══════════════════════════════
app.get("/api/versements", (req, res) => res.json(getVersements()));

app.post("/api/versements", upload.single("pieceJointe"), (req, res) => {
  const { date, montant, note } = req.body;
  if (!date || !montant) return res.status(400).json({ error: "Manque date ou montant" });

  const versement = {
    id: Date.now().toString(), date,
    montant: parseFloat(montant), note: note || "",
    pieceJointe: req.file ? req.file.filename : null,
    createdAt: Date.now(), locked: true,
  };
  saveVersement(versement);

  const caisses = getCaisses();
  const caisseDuJour = caisses.find(c => c.date === date);
  if (caisseDuJour) {
    const calc = calculerCaisse(date);
    saveCaisse({ ...caisseDuJour, ...calc });
  }
  res.status(201).json(versement);
});

// ═══════════════════════════════
//  CAISSE ESPECE
// ═══════════════════════════════
app.get("/api/caisses", (req, res) => {
  const caisses = getCaisses();
  res.json([...caisses].sort((a, b) => b.date.localeCompare(a.date)));
});

app.post("/api/caisses", (req, res) => {
  const { date, depenses, note } = req.body;
  if (!date) return res.status(400).json({ error: "Manque date" });

  const caisses = getCaisses();
  if (caisses.find(c => c.date === date))
    return res.status(400).json({ error: "Caisse deja creee pour ce jour" });

  const depensesVal = parseFloat(depenses || 0);
  const etats = getEtats();
  const versements = getVersements();
  const recouvrements = getRecouvrements();

  const caissesTriees = [...caisses].sort((a, b) => a.date.localeCompare(b.date));
  const caissesAvant = caissesTriees.filter(c => c.date < date);
  const initial = caissesAvant.length > 0 ? caissesAvant[caissesAvant.length - 1].reste : 0;

  const etatDuJour = etats.find(e => e.date === date && e.finFields);
  const totalEtatJour = etatDuJour ? parseFloat(etatDuJour.totalFin || 0) : 0;
  const totalVerse = versements.filter(v => v.date === date).reduce((s, v) => s + v.montant, 0);
  const totalRecouv = recouvrements.filter(r => r.dateRecuperation === date).reduce((s, r) => s + r.montant, 0);
  const solde = parseFloat((initial + totalEtatJour + totalRecouv - totalVerse - depensesVal).toFixed(3));

  const caisse = {
    id: Date.now().toString(), date,
    initial, totalEtatJour, totalVerse, totalRecouv,
    depenses: depensesVal,
    solde, reste: solde,
    note: note || "",
    createdAt: Date.now(), locked: true,
  };
  saveCaisse(caisse);
  console.log("Caisse creee: " + date + " solde=" + solde + " depenses=" + depensesVal);
  res.status(201).json(caisse);
});

app.get("/api/caisses/preview/:date", (req, res) => {
  const depenses = parseFloat(req.query.depenses || 0);
  const date = req.params.date;

  const caisses = getCaisses();
  const etats = getEtats();
  const versements = getVersements();
  const recouvrements = getRecouvrements();

  const caissesTriees = [...caisses].sort((a, b) => a.date.localeCompare(b.date));
  const caissesAvant = caissesTriees.filter(c => c.date < date);
  const initial = caissesAvant.length > 0 ? caissesAvant[caissesAvant.length - 1].reste : 0;

  const etatDuJour = etats.find(e => e.date === date && e.finFields);
  const totalEtatJour = etatDuJour ? parseFloat(etatDuJour.totalFin || 0) : 0;
  const totalVerse = versements.filter(v => v.date === date).reduce((s, v) => s + v.montant, 0);
  const totalRecouv = recouvrements.filter(r => r.dateRecuperation === date).reduce((s, r) => s + r.montant, 0);
  const solde = parseFloat((initial + totalEtatJour + totalRecouv - totalVerse - depenses).toFixed(3));

  res.json({ initial, totalEtatJour, totalVerse, totalRecouv, depenses, solde, reste: solde });
});

// ═══════════════════════════════
//  TEST EMAIL
// ═══════════════════════════════
app.post("/api/test-email", async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"Gestion Boutique" <${process.env.SMTP_USER}>`,
      to: process.env.EMAIL_ADMIN,
      subject: "Test email - Gestion Boutique",
      html: "<div style='font-family:monospace;padding:20px;background:#0f1117;color:#e8e0d0;'><h2 style='color:#a78bfa;'>Email OK!</h2></div>",
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Serveur sur http://localhost:${PORT}`));