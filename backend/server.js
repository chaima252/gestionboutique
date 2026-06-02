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

const FIELD_MODES = {
  banque: "virement",
  tpe: "tpe",
  espece: "espece",
  paiementLivraison: "espece",
  steLivraison: "cheque",
};

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
    finModes TEXT,
    ecarts TEXT,
    totalFin REAL,
    lignesEcart TEXT DEFAULT '[]',
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
`);

// Migration: si ancienne colonne "justifications" existe encore, on migre
try {
  const cols = db.prepare("PRAGMA table_info(etats)").all().map(c => c.name);
  if (cols.includes("justifications") && !cols.includes("lignesEcart")) {
    db.exec(`ALTER TABLE etats ADD COLUMN lignesEcart TEXT DEFAULT '[]'`);
    console.log("Migration: colonne lignesEcart ajoutée");
  }
} catch (e) { /* déjà fait */ }

// ─── Helpers SQLite ───
function getEtats() {
  return db.prepare("SELECT * FROM etats").all().map(parseEtat);
}

function parseEtat(e) {
  return {
    ...e,
    finFields: e.finFields ? JSON.parse(e.finFields) : null,
    finModes: e.finModes ? JSON.parse(e.finModes) : null,
    ecarts: e.ecarts ? JSON.parse(e.ecarts) : null,
    lignesEcart: e.lignesEcart ? JSON.parse(e.lignesEcart) : [],
  };
}

function getEtatById(id) {
  const e = db.prepare("SELECT * FROM etats WHERE id = ?").get(id);
  if (!e) return null;
  return parseEtat(e);
}

function saveEtat(etat) {
  db.prepare(`
    INSERT OR REPLACE INTO etats
    (id, date, montantTotal, finFields, finModes, ecarts, totalFin, lignesEcart, status, openedAt, closedAt, lastNotifiedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    etat.id, etat.date, etat.montantTotal,
    etat.finFields ? JSON.stringify(etat.finFields) : null,
    etat.finModes ? JSON.stringify(etat.finModes) : null,
    etat.ecarts ? JSON.stringify(etat.ecarts) : null,
    etat.totalFin ?? null,
    JSON.stringify(etat.lignesEcart || []),
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
        <p>L'état du <strong>${etat.date}</strong> n'est toujours pas fermé.</p>
      </div>`,
    });
  } catch (err) { console.error("Erreur email:", err.message); }
}

setInterval(async () => {
  const now = Date.now();
  const etats = getEtats();
  for (const e of etats) {
    if (e.status !== "open") continue;
    const heures = Math.floor((now - e.openedAt) / 3600000);
    
    // Nouvelle logique: premier email à 48h, puis tous les 24h
    if (heures >= 48) {
      const depuisNotif = now - (e.lastNotifiedAt || 0);
      // Premier envoi ou dernier envoi il y a plus de 24h
      if (!e.lastNotifiedAt || depuisNotif >= 24 * 3600000) {
        try {
          await sendNotification(e, heures);
          console.log("Email envoyé pour état " + e.date + " (ouvert depuis " + heures + "h)");
        } catch (err) {
          console.error("Erreur envoi email:", err.message);
        }
        e.lastNotifiedAt = now;
        saveEtat(e);
      }
    }
  }
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

  const dateJ1 = new Date(new Date(date).getTime() - 86400000).toISOString().slice(0, 10);
  const etatDuJour = etats.find(e => e.date === dateJ1 && e.finFields);
  const CHAMPS_ESPECE = ["espece", "paiementLivraison"];
  const totalEtatJour = etatDuJour?.finFields
    ? CHAMPS_ESPECE.reduce((s, k) => s + parseFloat(etatDuJour.finFields[k] || 0), 0)
    : 0;

  // Lignes d'écart "payé en espece" récupérées à cette date
  const totalRecouv = etats.reduce((sum, etat) => {
    return sum + (etat.lignesEcart || []).reduce((s, l) => {
      if (l.statut === "paye" && l.datePaiement === date && l.modePaiement === "espece") {
        return s + (l.montant || 0);
      }
      return s;
    }, 0);
  }, 0);

  const versementsDuJour = versements.filter(v => v.date === date);
  const totalVerse = versementsDuJour.reduce((s, v) => s + v.montant, 0);

  const caisseCourante = caisses.find(c => c.date === date);
  const depenses = caisseCourante ? parseFloat(caisseCourante.depenses || 0) : 0;

  const solde = parseFloat((initial + totalEtatJour + totalRecouv - totalVerse - depenses).toFixed(3));
  return { initial, totalEtatJour, totalVerse, totalRecouv, depenses, solde, reste: solde };
}

// ─── Helper: vérifier si un état peut être fermé ───
function etatPeutEtreFerme(etat) {
  if (!etat.finFields) return false;
  const ecart = Math.abs(etat.ecarts?.ecartGlobal || 0);
  if (ecart < 0.001) return true; // pas d'écart

  const lignes = etat.lignesEcart || [];
  if (lignes.length === 0) return false;

  // Toutes les lignes doivent être "paye" ou "manque" (manque = accepté et acté)
  const toutesTraitees = lignes.every(l => l.statut === "paye" || l.statut === "manque");
  const totalLignes = lignes.reduce((s, l) => s + (l.montant || 0), 0);
  const ecartCouvert = totalLignes >= ecart - 0.001;

  return toutesTraitees && ecartCouvert;
}

// ═══════════════════════════════
//  ETATS DE VENTE
// ═══════════════════════════════
app.get("/api/etats", (req, res) => {
  const etats = getEtats();
  res.json([...etats].sort((a, b) => b.date.localeCompare(a.date)));
});

app.post("/api/etats", (req, res) => {
  const { date, montantTotal } = req.body;
  if (!date || montantTotal === undefined) return res.status(400).json({ error: "Manque date ou montantTotal" });

  const etats = getEtats();
  const dejaExistant = etats.find(e => e.date === date);
  if (dejaExistant) return res.status(400).json({ error: "Un état existe déjà pour le " + date });

  const etat = {
    id: Date.now().toString(), date,
    montantTotal: parseFloat(montantTotal),
    finFields: null, finModes: null, ecarts: null, totalFin: null,
    lignesEcart: [],
    status: "open",
    openedAt: Date.now(), closedAt: null, lastNotifiedAt: 0,
  };
  saveEtat(etat);
  res.status(201).json(etat);
});

// Valider (financier saisit ses montants)
app.put("/api/etats/:id/valider", (req, res) => {
  const etat = getEtatById(req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  if (etat.status === "closed") return res.status(400).json({ error: "Deja ferme" });

  const { finFields, finModes } = req.body;
  etat.finFields = finFields;
  etat.finModes = finModes || {};

  const totalFin = Object.values(finFields).reduce((s, v) => s + parseFloat(v || 0), 0);
  etat.totalFin = parseFloat(totalFin.toFixed(3));
  const ecartGlobal = parseFloat((totalFin - etat.montantTotal).toFixed(3));
  etat.ecarts = { ecartGlobal };

  // Fermeture auto si écart = 0 ET tout espece
  const modes = finModes || {};
  const hasNonZeroNonEspece = Object.keys(finFields).some(k => {
    const val = parseFloat(finFields[k] || 0);
    const mode = modes[k] || FIELD_MODES[k] || "espece";
    return val !== 0 && mode !== "espece";
  });

  if (Math.abs(ecartGlobal) < 0.001 && !hasNonZeroNonEspece) {
    etat.status = "closed";
    etat.closedAt = Date.now();
    console.log("Etat ferme automatiquement (aucun ecart + tout espece): " + etat.id);
  } else if (Math.abs(ecartGlobal) < 0.001 && hasNonZeroNonEspece) {
    console.log("Etat NON ferme auto (ecart=0 mais mode non-espece): " + etat.id);
  }

  saveEtat(etat);
  res.json(etat);
});

// ─── LIGNES D'ÉCART ───

// Ajouter une ligne d'écart (financier)
app.post("/api/etats/:id/lignes-ecart", (req, res) => {
  const etat = getEtatById(req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  if (etat.status === "closed") return res.status(400).json({ error: "Etat ferme" });
  if (!etat.finFields) return res.status(400).json({ error: "Valider d'abord les montants" });

  const { client, montant, note } = req.body;
  if (!client || !montant) return res.status(400).json({ error: "Client et montant obligatoires" });

  const ligne = {
    id: Date.now().toString(),
    client: client.trim(),
    montant: parseFloat(montant),
    note: note || "",
    statut: "a_voir", // "a_voir" | "manque" | "paye"
    modePaiement: null,
    datePaiement: null,
    createdAt: Date.now(),
  };

  etat.lignesEcart.push(ligne);
  saveEtat(etat);
  res.json(etat);
});

// Modifier le statut d'une ligne (financier ou admin)
app.put("/api/etats/:id/lignes-ecart/:lid", (req, res) => {
  const etat = getEtatById(req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  if (etat.status === "closed") return res.status(400).json({ error: "Etat ferme" });

  const ligne = etat.lignesEcart.find(l => l.id === req.params.lid);
  if (!ligne) return res.status(404).json({ error: "Ligne introuvable" });

  const { statut, modePaiement, datePaiement } = req.body;
  if (!["a_voir", "manque", "paye"].includes(statut))
    return res.status(400).json({ error: "Statut invalide" });

  ligne.statut = statut;

if (statut === "paye") {
  ligne.modePaiement = modePaiement || "espece";
  const datePaiementOriginale = datePaiement || new Date().toISOString().slice(0, 10);
  
  // Pour paiement en espèce : la caisse est mise à jour le LENDEMAIN
  if (ligne.modePaiement === "espece") {
    // Calculer la date du lendemain
    const dateObj = new Date(datePaiementOriginale);
    dateObj.setDate(dateObj.getDate() + 1);
    const lendemain = dateObj.toISOString().slice(0, 10);
    ligne.datePaiement = lendemain;
    
    // Mettre à jour la caisse du lendemain
    const caisses = getCaisses();
    const caisseDuLendemain = caisses.find(c => c.date === lendemain);
    if (caisseDuLendemain) {
      const calc = calculerCaisse(lendemain);
      saveCaisse({ ...caisseDuLendemain, ...calc });
    }
  } else {
    ligne.modePaiement = null;
    ligne.datePaiement = null;
  }
}

  saveEtat(etat);
  res.json(etat);
});

// Supprimer une ligne (seulement si statut "a_voir")
app.delete("/api/etats/:id/lignes-ecart/:lid", (req, res) => {
  const etat = getEtatById(req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  if (etat.status === "closed") return res.status(400).json({ error: "Etat ferme" });

  const idx = etat.lignesEcart.findIndex(l => l.id === req.params.lid);
  if (idx === -1) return res.status(404).json({ error: "Ligne introuvable" });
  if (etat.lignesEcart[idx].statut !== "a_voir")
    return res.status(400).json({ error: "Seules les lignes 'A voir' peuvent être supprimées" });

  etat.lignesEcart.splice(idx, 1);
  saveEtat(etat);
  res.json(etat);
});

// Fermer un état (admin)
app.put("/api/etats/:id/fermer", (req, res) => {
  const etat = getEtatById(req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  if (!etat.finFields) return res.status(400).json({ error: "Etat pas encore validé par le financier." });

  if (!etatPeutEtreFerme(etat)) {
    const ecart = Math.abs(etat.ecarts?.ecartGlobal || 0);
    const lignes = etat.lignesEcart || [];
    const totalLignes = lignes.reduce((s, l) => s + (l.montant || 0), 0);
    const nonTraitees = lignes.filter(l => l.statut === "a_voir").length;

    if (totalLignes < ecart - 0.001)
      return res.status(400).json({ error: `Ecart de ${(ecart - totalLignes).toFixed(3)} TND non couvert par les lignes.` });
    if (nonTraitees > 0)
      return res.status(400).json({ error: `${nonTraitees} ligne(s) encore en statut "A voir". Changez leur statut avant de fermer.` });
  }

  etat.status = "closed";
  etat.closedAt = Date.now();
  saveEtat(etat);
  res.json(etat);
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

  const caissesTriees = [...caisses].sort((a, b) => a.date.localeCompare(b.date));
  const caissesAvant = caissesTriees.filter(c => c.date < date);
  const initial = caissesAvant.length > 0 ? caissesAvant[caissesAvant.length - 1].reste : 0;

  const dateJ1 = new Date(new Date(date).getTime() - 86400000).toISOString().slice(0, 10);
  const etatDuJour = etats.find(e => e.date === dateJ1 && e.finFields);
  const CHAMPS_ESPECE = ["espece", "paiementLivraison"];
  const totalEtatJour = etatDuJour?.finFields
    ? CHAMPS_ESPECE.reduce((s, k) => s + parseFloat(etatDuJour.finFields[k] || 0), 0)
    : 0;

  const totalVerse = versements.filter(v => v.date === date).reduce((s, v) => s + v.montant, 0);

  // Lignes d'écart payées en espece à cette date
  const totalRecouv = etats.reduce((sum, etat) => {
    return sum + (etat.lignesEcart || []).reduce((s, l) => {
      if (l.statut === "paye" && l.datePaiement === date && l.modePaiement === "espece") {
        return s + (l.montant || 0);
      }
      return s;
    }, 0);
  }, 0);

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
  console.log("Caisse creee: " + date + " solde=" + solde);
  res.status(201).json(caisse);
});

app.get("/api/caisses/preview/:date", (req, res) => {
  const depenses = parseFloat(req.query.depenses || 0);
  const date = req.params.date;

  const caisses = getCaisses();
  const etats = getEtats();
  const versements = getVersements();

  const caissesTriees = [...caisses].sort((a, b) => a.date.localeCompare(b.date));
  const caissesAvant = caissesTriees.filter(c => c.date < date);
  const initial = caissesAvant.length > 0 ? caissesAvant[caissesAvant.length - 1].reste : 0;

  const dateJ1 = new Date(new Date(date).getTime() - 86400000).toISOString().slice(0, 10);
  const etatDuJour = etats.find(e => e.date === dateJ1 && e.finFields);
  const CHAMPS_ESPECE = ["espece", "paiementLivraison"];
  const totalEtatJour = etatDuJour?.finFields
    ? CHAMPS_ESPECE.reduce((s, k) => s + parseFloat(etatDuJour.finFields[k] || 0), 0)
    : 0;

  const totalVerse = versements.filter(v => v.date === date).reduce((s, v) => s + v.montant, 0);

  const totalRecouv = etats.reduce((sum, etat) => {
    return sum + (etat.lignesEcart || []).reduce((s, l) => {
      if (l.statut === "paye" && l.datePaiement === date && l.modePaiement === "espece") {
        return s + (l.montant || 0);
      }
      return s;
    }, 0);
  }, 0);

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