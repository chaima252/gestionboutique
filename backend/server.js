require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

let etats = [];
let versements = [];
let caisses = [];
let recouvrements = []; // ecarts recuperes

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
  etats.forEach(e => {
    if (e.status !== "open") return;
    const heures = Math.floor((now - e.openedAt) / 3600000);
    if (heures >= 24) {
      const depuisNotif = now - (e.lastNotifiedAt || 0);
      if (!e.lastNotifiedAt || depuisNotif >= 6 * 3600000) {
        sendNotification(e, heures);
        e.lastNotifiedAt = now;
      }
    }
  });
}, 3600000);

// ─── Calcul automatique caisse pour une date ───
function calculerCaisse(date) {
  // Trier les caisses par date
  const caissesTriees = [...caisses].sort((a, b) => a.date.localeCompare(b.date));

  // Initial = reste de la derniere caisse AVANT cette date
  let initial = 0;
  const caissesAvant = caissesTriees.filter(c => c.date < date);
  if (caissesAvant.length > 0) {
    initial = caissesAvant[caissesAvant.length - 1].reste;
  }

  // Total etat de vente du jour (totalFin saisi par le financier)
  const etatDuJour = etats.find(e => e.date === date && e.finFields);
  const totalEtatJour = etatDuJour ? parseFloat(etatDuJour.totalFin || 0) : 0;

  // Versement banque du jour
  const versementsDuJour = versements.filter(v => v.date === date);
  const totalVerse = versementsDuJour.reduce((s, v) => s + v.montant, 0);

  // Ecarts recuperes ce jour
  const recouvDuJour = recouvrements.filter(r => r.dateRecuperation === date);
  const totalRecouv = recouvDuJour.reduce((s, r) => s + r.montant, 0);

  // Depenses saisies manuellement pour ce jour
  const caisseCourante = caisses.find(c => c.date === date);
  const depenses = caisseCourante ? parseFloat(caisseCourante.depenses || 0) : 0;

  // Solde = initial + total etat + ecarts recuperes - versements - depenses
  const solde = parseFloat((initial + totalEtatJour + totalRecouv - totalVerse - depenses).toFixed(3));

  return { initial, totalEtatJour, totalVerse, totalRecouv, depenses, solde, reste: solde };
}

// ═══════════════════════════════
//  ETATS DE VENTE
// ═══════════════════════════════
app.get("/api/etats", (req, res) => res.json(etats));

app.post("/api/etats", (req, res) => {
  const { date, montantTotal } = req.body;
  if (!date || montantTotal === undefined) return res.status(400).json({ error: "Manque date ou montantTotal" });
  const etat = {
    id: Date.now().toString(), date,
    montantTotal: parseFloat(montantTotal),
    finFields: null, ecarts: null, totalFin: null,
    justifications: [],
    status: "open",
    openedAt: Date.now(), closedAt: null, lastNotifiedAt: 0,
  };
  etats.push(etat);
  res.status(201).json(etat);
});

app.put("/api/etats/:id/valider", (req, res) => {
  const etat = etats.find(e => e.id === req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  if (etat.status === "closed") return res.status(400).json({ error: "Deja ferme" });
  const { finFields } = req.body;
  etat.finFields = finFields;
  const totalFin = Object.values(finFields).reduce((s, v) => s + parseFloat(v || 0), 0);
  etat.totalFin = parseFloat(totalFin.toFixed(3));
  const ecartGlobal = parseFloat((totalFin - etat.montantTotal).toFixed(3));
  etat.ecarts = { ecartGlobal };

  // Fermeture automatique si aucun ecart
  if (Math.abs(ecartGlobal) < 0.001) {
    etat.status = "closed";
    etat.closedAt = Date.now();
    console.log("Etat ferme automatiquement (aucun ecart): " + etat.id);
  }
  res.json(etat);
});

app.post("/api/etats/:id/justifications", (req, res) => {
  const etat = etats.find(e => e.id === req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  const { type, montant, note } = req.body;
  etat.justifications.push({
    id: Date.now().toString(), type,
    montant: parseFloat(montant), note,
    recupere: false, dateRecuperation: null,
  });
  res.json(etat);
});

app.delete("/api/etats/:id/justifications/:jid", (req, res) => {
  const etat = etats.find(e => e.id === req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  etat.justifications = etat.justifications.filter(j => j.id !== req.params.jid);
  res.json(etat);
});

app.put("/api/etats/:id/fermer", (req, res) => {
  const etat = etats.find(e => e.id === req.params.id);
  if (!etat) return res.status(404).json({ error: "Introuvable" });
  etat.status = "closed";
  etat.closedAt = Date.now();
  res.json(etat);
});

// ═══════════════════════════════
//  RECOUVREMENTS (ecarts recuperes)
// ═══════════════════════════════
app.get("/api/recouvrements", (req, res) => {
  // Enrichir avec info justification
  const enriched = recouvrements.map(r => {
    const etat = etats.find(e => e.id === r.etatId);
    const just = etat?.justifications.find(j => j.id === r.justificationId);
    return { ...r, etatDate: etat?.date, justType: just?.type, justNote: just?.note };
  });
  res.json(enriched);
});

// Ecarts disponibles a recuperer (justifications non encore recuperees)
app.get("/api/ecarts-a-recuperer", (req, res) => {
  const result = [];
  etats.forEach(etat => {
    etat.justifications.forEach(j => {
      const dejaRecupere = recouvrements.find(r => r.justificationId === j.id);
      if (!dejaRecupere) {
        result.push({
          etatId: etat.id,
          etatDate: etat.date,
          justificationId: j.id,
          type: j.type,
          montant: j.montant,
          note: j.note,
        });
      }
    });
  });
  res.json(result);
});

app.post("/api/recouvrements", (req, res) => {
  const { etatId, justificationId, dateRecuperation, montant } = req.body;
  if (!etatId || !justificationId || !dateRecuperation) return res.status(400).json({ error: "Manque données" });

  // Verifier que la justification existe
  const etat = etats.find(e => e.id === etatId);
  if (!etat) return res.status(404).json({ error: "Etat introuvable" });
  const just = etat.justifications.find(j => j.id === justificationId);
  if (!just) return res.status(404).json({ error: "Justification introuvable" });

  // Verifier pas deja recupere
  if (recouvrements.find(r => r.justificationId === justificationId))
    return res.status(400).json({ error: "Deja recupere" });

  const recouvrement = {
    id: Date.now().toString(),
    etatId, justificationId,
    dateRecuperation,
    montant: parseFloat(montant || just.montant),
    createdAt: Date.now(),
  };
  recouvrements.push(recouvrement);

  // Mettre a jour la justification
  just.recupere = true;
  just.dateRecuperation = dateRecuperation;

  // Recalculer la caisse du jour de recuperation si elle existe
  const caisseDuJour = caisses.find(c => c.date === dateRecuperation);
  if (caisseDuJour) {
    const calc = calculerCaisse(dateRecuperation);
    Object.assign(caisseDuJour, calc);
  }

  res.status(201).json(recouvrement);
});

// ═══════════════════════════════
//  VERSEMENTS BANQUE
// ═══════════════════════════════
app.get("/api/versements", (req, res) => res.json(versements));

app.post("/api/versements", upload.single("pieceJointe"), (req, res) => {
  const { date, montant, note } = req.body;
  if (!date || !montant) return res.status(400).json({ error: "Manque date ou montant" });
  const versement = {
    id: Date.now().toString(), date,
    montant: parseFloat(montant), note: note || "",
    pieceJointe: req.file ? req.file.filename : null,
    createdAt: Date.now(), locked: true,
  };
  versements.push(versement);

  // Recalculer caisse si existe pour ce jour
  const caisseDuJour = caisses.find(c => c.date === date);
  if (caisseDuJour) {
    const calc = calculerCaisse(date);
    Object.assign(caisseDuJour, calc);
  }
  res.status(201).json(versement);
});

// ═══════════════════════════════
//  CAISSE ESPECE
// ═══════════════════════════════
app.get("/api/caisses", (req, res) => res.json([...caisses].sort((a, b) => b.date.localeCompare(a.date))));

app.post("/api/caisses", (req, res) => {
  const { date, depenses, note } = req.body;
  if (!date) return res.status(400).json({ error: "Manque date" });

  if (caisses.find(c => c.date === date))
    return res.status(400).json({ error: "Caisse deja creee pour ce jour" });

  const depensesVal = parseFloat(depenses || 0);

  // Calculer initial (reste du jour precedent)
  const caissesTriees = [...caisses].sort((a, b) => a.date.localeCompare(b.date));
  const caissesAvant = caissesTriees.filter(c => c.date < date);
  const initial = caissesAvant.length > 0 ? caissesAvant[caissesAvant.length - 1].reste : 0;

  // Total etat de vente du jour
  const etatDuJour = etats.find(e => e.date === date && e.finFields);
  const totalEtatJour = etatDuJour ? parseFloat(etatDuJour.totalFin || 0) : 0;

  // Versements du jour
  const totalVerse = versements.filter(v => v.date === date).reduce((s, v) => s + v.montant, 0);

  // Ecarts recuperes ce jour
  const totalRecouv = recouvrements.filter(r => r.dateRecuperation === date).reduce((s, r) => s + r.montant, 0);

  // Solde final
  const solde = parseFloat((initial + totalEtatJour + totalRecouv - totalVerse - depensesVal).toFixed(3));

  const caisse = {
    id: Date.now().toString(), date,
    initial, totalEtatJour, totalVerse, totalRecouv,
    depenses: depensesVal,
    solde, reste: solde,
    note: note || "",
    createdAt: Date.now(), locked: true,
  };

  caisses.push(caisse);
  caisses.sort((a, b) => a.date.localeCompare(b.date));
  console.log("Caisse creee: " + date + " solde=" + solde + " depenses=" + depensesVal);
  res.status(201).json(caisse);
});

// Preview caisse avant creation
app.get("/api/caisses/preview/:date", (req, res) => {
  const depenses = parseFloat(req.query.depenses || 0);
  const date = req.params.date;
  
  // Calcul avec depenses temporaires
  const caissesTriees = [...caisses].sort((a, b) => a.date.localeCompare(b.date));
  const caissesAvant = caissesTriees.filter(c => c.date < date);
  let initial = caissesAvant.length > 0 ? caissesAvant[caissesAvant.length - 1].reste : 0;

  const etatDuJour = etats.find(e => e.date === date && e.finFields);
  const totalEtatJour = etatDuJour ? parseFloat(etatDuJour.totalFin || 0) : 0;
  const versementsDuJour = versements.filter(v => v.date === date);
  const totalVerse = versementsDuJour.reduce((s, v) => s + v.montant, 0);
  const recouvDuJour = recouvrements.filter(r => r.dateRecuperation === date);
  const totalRecouv = recouvDuJour.reduce((s, r) => s + r.montant, 0);
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
