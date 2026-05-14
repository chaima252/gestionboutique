import { useState, useEffect } from "react";

const API = "http://localhost:3001/api";

const USERS = {
  admin: { email: "admin@boutique.com", password: "admin123", role: "admin" },
  financier: { email: "financier@boutique.com", password: "fin123", role: "financier" },
};

const FIELD_LABELS = {
  banque: "Banque", tpe: "TPE", espece: "Espece",
  paiementLivraison: "Paiement a la livraison", steLivraison: "STE de livraison",
};

// Modes de paiement par défaut pour chaque champ
const FIELD_MODES = {
  banque: "virement",
  tpe: "tpe",
  espece: "espece",
  paiementLivraison: "espece",
  steLivraison: "cheque",
};

const INITIAL_FIN = { banque: "", tpe: "", espece: "", paiementLivraison: "", steLivraison: "" };

const fmt = (v) => new Intl.NumberFormat("fr-TN", { style: "currency", currency: "TND", minimumFractionDigits: 3 }).format(parseFloat(v) || 0);
const fnum = (v) => parseFloat(v) || 0;

const JUSTIFICATION_TYPES = [
  { value: "manque", label: "Manque" },
  { value: "avoir_facture", label: "Avoir facture" },
  { value: "depense", label: "Depense" },
  { value: "reste_payer", label: "Reste a payer" },
  { value: "reste_deposer", label: "Reste a deposer STE" },
];

const JUST_LABELS = Object.fromEntries(JUSTIFICATION_TYPES.map(t => [t.value, t.label]));

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#0f1117;color:#e8e0d0;font-family:'Crimson Pro',Georgia,serif;}
  .inp{background:#1a1a2e;border:1px solid #2e2a3e;border-radius:6px;padding:10px 13px;color:#e8e0d0;font-size:15px;outline:none;width:100%;font-family:inherit;transition:border-color 0.2s;}
  .inp:focus{border-color:#8b5cf6;}
  .inp:disabled{opacity:0.5;cursor:not-allowed;}
  .ig{margin-bottom:14px;}
  .ig label{font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8a7f9a;font-family:'JetBrains Mono',monospace;display:block;margin-bottom:5px;}
  .btn{border:none;border-radius:7px;padding:12px 28px;font-size:15px;font-family:'Crimson Pro',serif;font-weight:600;cursor:pointer;transition:all 0.18s;}
  .bp{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;}
  .bp:hover{transform:translateY(-1px);box-shadow:0 6px 20px #7c3aed44;}
  .bs{background:linear-gradient(135deg,#15803d,#22c55e);color:#fff;}
  .bg{background:#252438;color:#8a7f9a;}
  .bg:hover{background:#2e2a3e;}
  .card{background:#161622;border:1px solid #252438;border-radius:12px;padding:28px 32px;margin-bottom:16px;}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;}
  .sb{display:inline-flex;align-items:center;background:#1e1a2e;border:1px solid #3a3454;border-radius:20px;padding:5px 14px;font-size:12px;font-family:'JetBrains Mono',monospace;color:#a78bfa;margin-bottom:18px;}
  .st{font-size:22px;font-weight:600;color:#e8e0d0;margin-bottom:6px;}
  .ss{font-size:14px;color:#6b6380;margin-bottom:24px;font-family:'JetBrains Mono',monospace;}
  hr{border:none;border-top:1px solid #252438;margin:20px 0;}
  .er{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-radius:8px;margin-bottom:8px;font-family:'JetBrains Mono',monospace;font-size:13px;flex-wrap:wrap;gap:8px;}
  .ep{background:#0d231855;border:1px solid #16532d44;color:#4ade80;}
  .en{background:#2d0d0d55;border:1px solid #7f1d1d44;color:#f87171;}
  .pb{background:#1a1a2e;border-radius:20px;height:8px;overflow:hidden;margin:10px 0;}
  .pbi{height:100%;border-radius:20px;transition:width 0.4s;}
  .ji{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;background:#1a1a2e;border:1px solid #2e2a3e;border-radius:8px;padding:12px 16px;margin-bottom:10px;}
  .toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);padding:12px 28px;border-radius:8px;font-size:14px;font-family:'JetBrains Mono',monospace;color:#fff;z-index:1000;box-shadow:0 8px 30px #00000066;white-space:nowrap;}
  .role-admin{background:#7c3aed22;border:1px solid #7c3aed44;border-radius:8px;padding:6px 14px;font-size:12px;font-family:'JetBrains Mono',monospace;color:#a78bfa;}
  .role-fin{background:#15803d22;border:1px solid #22c55e44;border-radius:8px;padding:6px 14px;font-size:12px;font-family:'JetBrains Mono',monospace;color:#4ade80;}
  .etat-card{background:#1a1a2e;border:1px solid #2e2a3e;border-radius:10px;padding:16px 20px;margin-bottom:12px;transition:border-color 0.2s;}
  .etat-card.clickable{cursor:pointer;}
  .etat-card.clickable:hover{border-color:#7c3aed;}
  .etat-open{border-left:3px solid #fbbf24;}
  .etat-closed{border-left:3px solid #22c55e;opacity:0.8;}
  .navbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid #252438;flex-wrap:wrap;gap:12px;}
  .tabs{display:flex;gap:0;margin-bottom:24px;border-bottom:1px solid #252438;}
  .tab{padding:10px 18px;border:none;background:none;color:#6b6380;font-size:14px;font-family:'Crimson Pro',serif;cursor:pointer;border-bottom:2px solid transparent;transition:all 0.2s;font-weight:600;}
  .tab.active{color:#a78bfa;border-bottom-color:#7c3aed;}
  .tab:hover{color:#e8e0d0;}
  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
  .login-card{background:#161622;border:1px solid #252438;border-radius:16px;padding:40px;width:100%;max-width:420px;}
  .stat-box{background:#1a1a2e;border:1px solid #2e2a3e;border-radius:10px;padding:16px 20px;text-align:center;}
  .stat-num{font-size:28px;font-weight:700;font-family:'JetBrains Mono',monospace;margin-bottom:4px;}
  .stat-label{font-size:11px;letter-spacing:0.1em;color:#6b6380;font-family:'JetBrains Mono',monospace;}
  .locked-badge{background:#1a2e1a;border:1px solid #16532d;border-radius:6px;padding:4px 10px;font-size:11px;font-family:'JetBrains Mono',monospace;color:#4ade80;white-space:nowrap;}
  .read-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e1a2e;font-size:14px;}
  .file-link{color:#a78bfa;font-family:'JetBrains Mono',monospace;font-size:12px;text-decoration:none;}
  .file-link:hover{text-decoration:underline;}
  .caisse-calc{background:#0f1117;border-radius:8px;padding:14px 18px;margin-bottom:12px;}
  .recouv-item{background:#1a1a2e;border:1px solid #2e2a3e;border-radius:8px;padding:12px 16px;margin-bottom:10px;cursor:pointer;transition:border-color 0.2s;}
  .recouv-item:hover{border-color:#7c3aed;}
  .recouv-item.selected{border-color:#7c3aed;background:#1e1a2e;}
  @media(max-width:600px){.two{grid-template-columns:1fr;}.three{grid-template-columns:1fr!important;}}
  @keyframes pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
`;

export default function App() {
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState(null);

  // Admin
  const [adminEtats, setAdminEtats] = useState([]);
  const [adminView, setAdminView] = useState("dashboard");
  const [adminDate, setAdminDate] = useState(new Date().toISOString().slice(0, 10));
  const [adminTotal, setAdminTotal] = useState("");
  const [adminTab, setAdminTab] = useState("etats");
  const [adminVersements, setAdminVersements] = useState([]);
  const [adminCaisses, setAdminCaisses] = useState([]);
  const [selectedEtatAdmin, setSelectedEtatAdmin] = useState(null);

  // Financier - Etats
  const [finTab, setFinTab] = useState("etats");
  const [etats, setEtats] = useState([]);
  const [selectedEtat, setSelectedEtat] = useState(null);
  const [finFields, setFinFields] = useState({ ...INITIAL_FIN });
  const [finStep, setFinStep] = useState("list");
  const [newJust, setNewJust] = useState({ type: "", montant: "", note: "", dateEcart: new Date().toISOString().slice(0,10), modePaiement: "espece", pieceJointe: null });

  // Financier - Versement
  const [versDate, setVersDate] = useState(new Date().toISOString().slice(0, 10));
  const [versMontant, setVersMontant] = useState("");
  const [versNote, setVersNote] = useState("");
  const [versFichier, setVersFichier] = useState(null);
  const [versements, setVersements] = useState([]);

  // Financier - Caisse
  const [caisseDate, setCaisseDate] = useState(new Date().toISOString().slice(0, 10));
  const [caisseNote, setCaisseNote] = useState("");
  const [caisseDeps, setCaisseDeps] = useState("");
  const [caisses, setCaisses] = useState([]);
  const [caissePreview, setCaissePreview] = useState(null);
  const [ecartsARecuperer, setEcartsARecuperer] = useState([]);
  const [selectedEcart, setSelectedEcart] = useState(null);
  const [dateRecup, setDateRecup] = useState(new Date().toISOString().slice(0, 10));
  const [montantRecup, setMontantRecup] = useState("");
  const [modePaiementRecup, setModePaiementRecup] = useState("espece");
  const [showRecoupModal, setShowRecoupModal] = useState(false);

  const showToast = (msg, color = "#22c55e") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLogin = () => {
    setLoginError("");
    const found = Object.values(USERS).find(u => u.email === loginEmail.trim() && u.password === loginPass);
    if (!found) { setLoginError("Email ou mot de passe incorrect."); return; }
    setUser(found);
    if (found.role === "financier") { loadEtats(); loadVersements(); loadCaisses(); loadEcartsARecuperer(); }
    if (found.role === "admin") { loadAdminEtats(); loadAdminVersements(); loadAdminCaisses(); }
  };

  const handleLogout = () => {
    setUser(null); setLoginEmail(""); setLoginPass("");
    setAdminView("dashboard"); setFinStep("list"); setSelectedEtat(null);
  };

  // ── LOADS ──
  const loadAdminEtats = async () => { try { const r = await fetch(API + "/etats"); setAdminEtats(await r.json()); } catch {} };
  const loadAdminVersements = async () => { try { const r = await fetch(API + "/versements"); setAdminVersements(await r.json()); } catch {} };
  const loadAdminCaisses = async () => { try { const r = await fetch(API + "/caisses"); setAdminCaisses(await r.json()); } catch {} };
  const loadEtats = async () => { try { const r = await fetch(API + "/etats"); setEtats(await r.json()); } catch {} };
  const loadVersements = async () => { try { const r = await fetch(API + "/versements"); setVersements(await r.json()); } catch {} };
  const loadCaisses = async () => { try { const r = await fetch(API + "/caisses"); setCaisses(await r.json()); } catch {} };
  const loadEcartsARecuperer = async () => { try { const r = await fetch(API + "/ecarts-a-recuperer"); setEcartsARecuperer(await r.json()); } catch {} };

  const loadCaissePreview = async (date, deps) => {
    try {
      const depVal = deps !== undefined ? deps : caisseDeps;
      const r = await fetch(API + "/caisses/preview/" + date + "?depenses=" + (parseFloat(depVal) || 0));
      setCaissePreview(await r.json());
    } catch {}
  };

  useEffect(() => { if (user?.role === "financier") loadCaissePreview(caisseDate, caisseDeps); }, [caisseDate, caisseDeps, user]);

  // ── ADMIN ACTIONS ──
  const handleAdminOpen = async () => {
    if (!adminDate || !adminTotal) return showToast("Remplissez tous les champs.", "#ef4444");
    setLoading(true);
    try {
      const r = await fetch(API + "/etats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: adminDate, montantTotal: parseFloat(adminTotal) }) });
      if (!r.ok) {
        const err = await r.json();
        showToast(err.error, "#ef4444");
        setLoading(false);
        return;
      }
      const data = await r.json();
      setAdminEtats(prev => [data, ...prev]);
      setAdminTotal(""); setAdminView("dashboard"); showToast("Etat ouvert!");
    } catch { showToast("Erreur.", "#ef4444"); }
    setLoading(false);
  };

  const handleFermerEtat = async (id) => {
    try {
      const r = await fetch(API + "/etats/" + id + "/fermer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      });
      if (!r.ok) {
        const err = await r.json();
        showToast(err.error, "#ef4444");
        return;
      }
      const data = await r.json();
      setAdminEtats(prev => prev.map(e => e.id === id ? data : e));
      if (selectedEtatAdmin?.id === id) setSelectedEtatAdmin(data);
      showToast("Etat fermé!");
    } catch { showToast("Erreur.", "#ef4444"); }
  };

  const testEmail = async () => {
    setTestEmailStatus("sending");
    try {
      const r = await fetch(API + "/test-email", { method: "POST" });
      const d = await r.json();
      setTestEmailStatus(d.success ? "ok" : "error");
      showToast(d.success ? "Email envoye!" : d.error, d.success ? "#22c55e" : "#ef4444");
    } catch { setTestEmailStatus("error"); }
    setTimeout(() => setTestEmailStatus(null), 3000);
  };

  // ── FINANCIER ETATS ──
  const selectEtat = (etat) => {
    setSelectedEtat(etat);
    setFinFields({ ...INITIAL_FIN });
    if (etat.status === "closed") {
      setFinStep("readonly");
    } else {
      setFinStep(etat.finFields ? "ecart" : "saisie");
    }
  };

  const handleFinancierValidate = async () => {
    for (const k of Object.keys(finFields)) {
      if (finFields[k] === "") return showToast("Remplissez tous les champs.", "#ef4444");
    }
    setLoading(true);
    try {
      const r = await fetch(API + "/etats/" + selectedEtat.id + "/valider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finFields, finModes: FIELD_MODES })
      });
      const data = await r.json();
      setSelectedEtat(data);
      const ecart = data.ecarts?.ecartGlobal || 0;

      if (data.status === "closed") {
        // Fermé automatiquement (tout espece + ecart 0)
        setFinStep("list");
        loadEtats();
        showToast("Aucun ecart! Etat ferme automatiquement.", "#22c55e");
      } else if (Math.abs(ecart) < 0.001) {
        // Ecart = 0 mais mode non-espece → admin doit fermer
        setFinStep("ecart");
        showToast("Validation OK. En attente de fermeture par l'admin (mode non-espece).", "#f59e0b");
      } else {
        // Ecart détecté
        setFinStep("ecart");
        showToast("Ecart detecte : " + (ecart > 0 ? "+" : "") + ecart.toFixed(3) + " TND", "#f59e0b");
      }
    } catch { showToast("Erreur.", "#ef4444"); }
    setLoading(false);
  };

  const addJustification = async () => {
    if (!newJust.type || !newJust.montant || !newJust.note) return showToast("Remplissez tous les champs.", "#ef4444");
    if (newJust.modePaiement !== "espece" && !newJust.pieceJointe) return showToast("Piece jointe obligatoire pour TPE/Virement/Cheque.", "#ef4444");

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("type", newJust.type);
      fd.append("montant", newJust.montant);
      fd.append("note", newJust.note);
      fd.append("dateEcart", newJust.dateEcart);
      fd.append("modePaiement", newJust.modePaiement);
      if (newJust.pieceJointe) fd.append("pieceJointe", newJust.pieceJointe);

      const r = await fetch(API + "/etats/" + selectedEtat.id + "/justifications", { method: "POST", body: fd });

      if (!r.ok) {
        const err = await r.json();
        showToast(err.error, "#ef4444");
        setLoading(false);
        return;
      }

      const data = await r.json();
      setSelectedEtat(data);
      setNewJust({ type: "", montant: "", note: "", dateEcart: new Date().toISOString().slice(0, 10), modePaiement: "espece", pieceJointe: null });

      // Si espece → rafraichir le preview de la caisse d'aujourd'hui
      if (newJust.modePaiement === "espece") {
        const today = new Date().toISOString().slice(0, 10);
        loadCaissePreview(today, caisseDeps);
      }

      showToast("Ecart ajoute.");
    } catch { showToast("Erreur.", "#ef4444"); }
    setLoading(false);
  };

  const removeJustification = async (jid) => {
    try { const r = await fetch(API + "/etats/" + selectedEtat.id + "/justifications/" + jid, { method: "DELETE" }); setSelectedEtat(await r.json()); } catch { }
  };

  // ── VERSEMENT ──
  const handleVersement = async () => {
    if (!versDate || !versMontant) return showToast("Remplissez date et montant.", "#ef4444");
    if (!versFichier) return showToast("Ajoutez la piece jointe.", "#ef4444");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("date", versDate); fd.append("montant", versMontant);
      fd.append("note", versNote); fd.append("pieceJointe", versFichier);
      const r = await fetch(API + "/versements", { method: "POST", body: fd });
      const data = await r.json();
      setVersements(prev => [data, ...prev]);
      setVersMontant(""); setVersNote(""); setVersFichier(null);
      loadCaissePreview(caisseDate);
      showToast("Versement enregistre!");
    } catch { showToast("Erreur.", "#ef4444"); }
    setLoading(false);
  };

  // ── CAISSE ──
  const handleCaisse = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + "/caisses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: caisseDate, depenses: parseFloat(caisseDeps) || 0, note: caisseNote }) });
      if (!r.ok) { const e = await r.json(); showToast(e.error, "#ef4444"); setLoading(false); return; }
      const data = await r.json();
      setCaisses(prev => [data, ...prev]);
      setCaisseNote(""); loadCaissePreview(caisseDate);
      showToast("Caisse enregistree!");
    } catch { showToast("Erreur.", "#ef4444"); }
    setLoading(false);
  };

  // ── RECOUVREMENT ──
  const handleRecouvrement = async () => {
    if (!selectedEcart || !dateRecup) return showToast("Selectionnez un ecart et une date.", "#ef4444");
    setLoading(true);
    try {
      const r = await fetch(API + "/recouvrements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etatId: selectedEcart.etatId, justificationId: selectedEcart.justificationId, dateRecuperation: dateRecup, montant: parseFloat(montantRecup) || selectedEcart.restant, modePaiement: modePaiementRecup }),
      });
      if (!r.ok) { const e = await r.json(); showToast(e.error, "#ef4444"); setLoading(false); return; }
      await r.json();
      setShowRecoupModal(false); setSelectedEcart(null); setMontantRecup(""); setModePaiementRecup("espece");
      loadEcartsARecuperer(); loadCaisses(); loadCaissePreview(caisseDate);
      showToast("Ecart marque comme recupere le " + dateRecup + "!");
    } catch { showToast("Erreur.", "#ef4444"); }
    setLoading(false);
  };

  const ecarts = selectedEtat?.ecarts || {};
  const justifications = selectedEtat?.justifications || [];
  const ecartGlobal = ecarts.ecartGlobal || 0;
  const totalJustifie = justifications.reduce((s, j) => s + j.montant, 0);
  const restant = Math.max(0, Math.abs(ecartGlobal) - totalJustifie);

  const Navbar = () => (
    <div className="navbar">
      <div>
        <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#5a5070", letterSpacing: "0.2em" }}>GESTION BOUTIQUE</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, background: "linear-gradient(135deg,#e8e0d0,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {user.role === "admin" ? "Administrateur" : "Financier"}
        </h2>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {user.role === "admin" && (
          <button className="btn bg" style={{ fontSize: 12, padding: "8px 14px" }} onClick={testEmail} disabled={testEmailStatus === "sending"}>
            {testEmailStatus === "sending" ? "Envoi..." : testEmailStatus === "ok" ? "Email OK" : "Tester email"}
          </button>
        )}
        <div className={user.role === "admin" ? "role-admin" : "role-fin"}>{user.email}</div>
        <button className="btn bg" style={{ fontSize: 12, padding: "8px 14px" }} onClick={handleLogout}>Deconnexion</button>
      </div>
    </div>
  );

  const CaisseCalcBox = ({ data, title }) => data ? (
    <div className="caisse-calc">
      {title && <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", marginBottom: 10 }}>{title}</div>}
      <div className="read-row"><span style={{ color: "#8a7f9a", fontSize: 13 }}>Initial (reste j-1)</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{fmt(data.initial)}</span></div>
      <div className="read-row"><span style={{ color: "#4ade80", fontSize: 13 }}>+ Total etat de vente</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#4ade80" }}>+{fmt(data.totalEtatJour)}</span></div>
      {(data.totalRecouv > 0) && <div className="read-row"><span style={{ color: "#a78bfa", fontSize: 13 }}>+ Ecarts recuperes</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#a78bfa" }}>+{fmt(data.totalRecouv)}</span></div>}
      <div className="read-row"><span style={{ color: "#f87171", fontSize: 13 }}>- Verse banque</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#f87171" }}>-{fmt(data.totalVerse)}</span></div>
      {data.depenses > 0 && <div className="read-row"><span style={{ color: "#f87171", fontSize: 13 }}>- Depenses</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#f87171" }}>-{fmt(data.depenses)}</span></div>}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, fontWeight: 700, fontSize: 16 }}>
        <span>= Solde caisse</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#fbbf24" }}>{fmt(data.solde)}</span>
      </div>
    </div>
  ) : null;

  // LOGIN
  if (!user) return (
    <div style={{ background: "#0f1117", minHeight: "100vh" }}>
      <style>{css}</style>
      {toast && <div className="toast" style={{ background: toast.color }}>{toast.msg}</div>}
      <div className="login-wrap">
        <div className="login-card">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#5a5070", letterSpacing: "0.2em", marginBottom: 8 }}>SYSTEME DE GESTION</div>
            <h1 style={{ fontSize: 30, fontWeight: 700, background: "linear-gradient(135deg,#e8e0d0,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Boutique</h1>
          </div>
          <div className="ig"><label>Email</label><input className="inp" type="email" placeholder="votre@email.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} /></div>
          <div className="ig"><label>Mot de passe</label><input className="inp" type="password" placeholder="••••••••" value={loginPass} onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} /></div>
          {loginError && <div style={{ background: "#2d0d0d", border: "1px solid #7f1d1d44", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#f87171", fontFamily: "'JetBrains Mono',monospace", marginBottom: 16 }}>{loginError}</div>}
          <button className="btn bp" style={{ width: "100%" }} onClick={handleLogin}>Se connecter</button>
          <div style={{ marginTop: 20, background: "#1a1a2e", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", marginBottom: 8 }}>COMPTES DE TEST</div>
            <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#8a7f9a", lineHeight: 2.2 }}>
              <span style={{ color: "#a78bfa" }}>Admin :</span> admin@boutique.com / admin123<br />
              <span style={{ color: "#4ade80" }}>Financier :</span> financier@boutique.com / fin123
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ADMIN
  if (user.role === "admin") {
    const nbOuverts = adminEtats.filter(e => e.status === "open").length;
    const nbFermes = adminEtats.filter(e => e.status === "closed").length;

    return (
      <div style={{ background: "#0f1117", minHeight: "100vh" }}>
        <style>{css}</style>
        {toast && <div className="toast" style={{ background: toast.color }}>{toast.msg}</div>}
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
          <Navbar />

          {adminView === "form" && (
            <div>
              <button className="btn bg" style={{ fontSize: 12, padding: "8px 14px", marginBottom: 20 }} onClick={() => setAdminView("dashboard")}>← Retour</button>
              <div className="card">
                <div className="sb">Nouvel etat</div>
                <div className="st">Ouvrir un etat de vente</div>
                <div className="ig"><label>Date</label><input type="date" className="inp" value={adminDate} onChange={e => setAdminDate(e.target.value)} /></div>
                <div className="ig"><label>Montant total (TND)</label><input type="number" className="inp" placeholder="0.000" step="0.001" value={adminTotal} onChange={e => setAdminTotal(e.target.value)} /></div>
                <hr />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn bp" onClick={handleAdminOpen} disabled={loading}>{loading ? "..." : "Ouvrir l etat"}</button>
                </div>
              </div>
            </div>
          )}

          {adminView === "detail" && selectedEtatAdmin && (
            <div>
              <button className="btn bg" style={{ fontSize: 12, padding: "8px 14px", marginBottom: 20 }} onClick={() => { setAdminView("dashboard"); setSelectedEtatAdmin(null); }}>← Retour</button>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                  <div>
                    <div className="sb">Detail etat</div>
                    <div className="st">Etat du {selectedEtatAdmin.date}</div>
                  </div>
                  {selectedEtatAdmin.status === "open" && (() => {
                    const ecart = selectedEtatAdmin.ecarts?.ecartGlobal || 0;
                    const hasEcart = Math.abs(ecart) > 0.001;
                    const justifs = selectedEtatAdmin.justifications || [];
                    // Couvert = espece recupere OU non-espece justifie (TPE/virement/cheque avec piece jointe)
                    const totalCouvert = justifs.reduce((s, j) => {
                      if (j.modePaiement === "espece") return s + (j.montantRecupere || 0);
                      return s + (j.montant || 0); // non-espece: justification suffit
                    }, 0);
                    const restant = Math.max(0, parseFloat((Math.abs(ecart) - totalCouvert).toFixed(3)));

                    // Pas encore validé par le financier
                    if (!selectedEtatAdmin.finFields) {
                      return (
                        <div style={{
                          background: "#2d0d0d", border: "1px solid #7f1d1d44",
                          borderRadius: 8, padding: "8px 16px", fontSize: 12,
                          fontFamily: "'JetBrains Mono',monospace", color: "#f87171"
                        }}>
                          En attente de validation financier
                        </div>
                      );
                    }

                    // Validé AVEC écart non couvert
                    if (hasEcart && restant > 0.001) {
                      return (
                        <div style={{
                          background: "#2d1a0d", border: "1px solid #92400e44",
                          borderRadius: 8, padding: "8px 16px", fontSize: 12,
                          fontFamily: "'JetBrains Mono',monospace", color: "#fbbf24"
                        }}>
                          En attente de justification — reste {restant.toFixed(3)} TND
                        </div>
                      );
                    }

                    // Validé SANS écart ou tout justifié/recouvré → bouton fermer visible
                    return (
                      <button className="btn bs" onClick={() => handleFermerEtat(selectedEtatAdmin.id)}>
                        Fermer l etat
                      </button>
                    );
                  })()}
                  {selectedEtatAdmin.status === "closed" && (
                    <div style={{ background: "#0d2318", border: "1px solid #16532d", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#4ade80" }}>FERME</div>
                  )}
                </div>
                <div style={{ background: "#1a1a2e", border: "1px solid #2e2a3e", borderRadius: 8, padding: "14px 18px", marginBottom: 16 }}>
                  <div className="read-row"><span style={{ color: "#8a7f9a" }}>Montant admin</span><span style={{ color: "#a78bfa", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{fmt(selectedEtatAdmin.montantTotal)}</span></div>
                  {selectedEtatAdmin.totalFin !== null && <div className="read-row"><span style={{ color: "#8a7f9a" }}>Total financier</span><span style={{ color: "#4ade80", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{fmt(selectedEtatAdmin.totalFin)}</span></div>}
                  {selectedEtatAdmin.ecarts && (
                    <div className="read-row">
                      <span style={{ color: "#8a7f9a" }}>Ecart</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: selectedEtatAdmin.status === "closed" ? "#4ade80" : Math.abs(selectedEtatAdmin.ecarts.ecartGlobal) < 0.001 ? "#4ade80" : "#f87171" }}>
                        {selectedEtatAdmin.status === "closed" && Math.abs(selectedEtatAdmin.ecarts.ecartGlobal) > 0.001
                          ? `Écart recouvré de ${fmt(Math.abs(selectedEtatAdmin.ecarts.ecartGlobal))}`
                          : fmt(selectedEtatAdmin.ecarts.ecartGlobal)}
                      </span>
                    </div>
                  )}
                </div>
                {selectedEtatAdmin.finFields && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", marginBottom: 10 }}>DETAIL FINANCIER</div>
                    <div style={{ background: "#1a1a2e", border: "1px solid #2e2a3e", borderRadius: 8, padding: "14px 18px" }}>
                      {Object.keys(FIELD_LABELS).map(k => (
                        <div className="read-row" key={k}>
                          <span style={{ color: "#8a7f9a" }}>{FIELD_LABELS[k]} <span style={{ fontSize: 10, color: "#6b6380" }}>({selectedEtatAdmin.finModes?.[k] || FIELD_MODES[k]})</span></span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{fmt(selectedEtatAdmin.finFields[k])}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedEtatAdmin.justifications?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", marginBottom: 10 }}>ECARTS ({selectedEtatAdmin.justifications.length})</div>
                    {selectedEtatAdmin.justifications.map(j => (
                      <div className="ji" key={j.id}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: "#a78bfa" }}>{JUST_LABELS[j.type]}</span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#fbbf24", marginLeft: "auto" }}>{fmt(j.montant)}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "#8a7f9a", marginBottom: 4 }}>{j.note}</div>
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                            {j.modePaiement && (
                              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: j.modePaiement === "espece" ? "#4ade80" : j.modePaiement === "cheque" ? "#a78bfa" : "#fbbf24" }}>
                                {j.modePaiement === "espece" ? "Espece" : j.modePaiement === "tpe" ? "TPE" : j.modePaiement === "virement" ? "Virement" : "Cheque"}
                              </span>
                            )}
                            {j.dateEcart && <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380" }}>Date: {j.dateEcart}</span>}
                            {j.recupere && <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#4ade80" }}>Recupere le {j.dateRecuperation}</span>}
                          </div>
                          {j.pieceJointe && (
                            <a href={"http://localhost:3001/uploads/" + j.pieceJointe} target="_blank" rel="noreferrer" className="file-link" style={{ display: "inline-block", marginTop: 4 }}>
                              📎 Voir piece jointe
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {adminView === "dashboard" && (
            <div>
              <div className="two" style={{ marginBottom: 20 }}>
                <div className="stat-box"><div className="stat-num" style={{ color: "#fbbf24" }}>{nbOuverts}</div><div className="stat-label">OUVERTS</div></div>
                <div className="stat-box"><div className="stat-num" style={{ color: "#4ade80" }}>{nbFermes}</div><div className="stat-label">FERMES</div></div>
              </div>
              <div className="tabs">
                {["etats", "versements", "caisse"].map(t => (
                  <button key={t} className={"tab " + (adminTab === t ? "active" : "")} onClick={() => { setAdminTab(t); if (t === "versements") loadAdminVersements(); if (t === "caisse") loadAdminCaisses(); }}>
                    {t === "etats" ? "Etats de vente" : t === "versements" ? "Versements" : "Caisse Espece"}
                  </button>
                ))}
              </div>

              {adminTab === "etats" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div className="st">Historique</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn bg" style={{ fontSize: 12, padding: "8px 14px" }} onClick={loadAdminEtats}>Actualiser</button>
                      <button className="btn bp" style={{ fontSize: 13, padding: "10px 20px" }} onClick={() => setAdminView("form")}>+ Nouvel etat</button>
                    </div>
                  </div>
                  {adminEtats.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "40px", color: "#6b6380" }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                      <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>Aucun etat</p>
                    </div>
                  ) : adminEtats.map(e => (
                    <div key={e.id} className={"etat-card clickable " + (e.status === "open" ? "etat-open" : "etat-closed")}
                      onClick={() => { setSelectedEtatAdmin(e); setAdminView("detail"); }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{e.date}</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a78bfa", fontSize: 13 }}>Montant : {fmt(e.montantTotal)}</div>
                          {e.ecarts && (() => {
                            const ecart = e.ecarts.ecartGlobal;
                            const justifs = e.justifications || [];
                            const totalCouvert = justifs.reduce((s, j) => {
                              if (j.modePaiement === "espece") return s + (j.montantRecupere || 0);
                              return s + (j.montant || 0);
                            }, 0);
                            const restant = Math.max(0, parseFloat((Math.abs(ecart) - totalCouvert).toFixed(3)));
                            const isJustified = Math.abs(ecart) > 0.001 && restant < 0.001;
                            const color = e.status === "closed" ? "#4ade80" : Math.abs(ecart) < 0.001 ? "#4ade80" : isJustified ? "#f59e0b" : "#f87171";
                            let label;
                            if (e.status === "closed" && Math.abs(ecart) > 0.001) label = `Écart recouvré de ${fmt(Math.abs(ecart))}`;
                            else if (e.status === "closed") label = `Écart : ${fmt(ecart)}`;
                            else if (isJustified) label = `Écart justifié ${fmt(ecart)} — à fermer`;
                            else label = `Écart : ${fmt(ecart)}`;
                            return <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginTop: 3, color }}>{label}</div>;
                          })()}
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: "4px 12px", borderRadius: 20, background: e.status === "open" ? "#2d1a0d" : "#0d2318", color: e.status === "open" ? "#fbbf24" : "#4ade80" }}>
                          {e.status === "open" ? "EN ATTENTE" : "FERME"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === "versements" && (
                <div>
                  <div className="st" style={{ marginBottom: 16 }}>Versements Banque</div>
                  {adminVersements.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "40px", color: "#6b6380" }}><div style={{ fontSize: 36, marginBottom: 12 }}>🏦</div><p>Aucun versement</p></div>
                  ) : adminVersements.map(v => (
                    <div key={v.id} className="etat-card" style={{ borderLeft: "3px solid #7c3aed" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{v.date}</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a78bfa", fontSize: 14, marginBottom: 4 }}>{fmt(v.montant)}</div>
                          {v.note && <div style={{ fontSize: 13, color: "#8a7f9a", marginBottom: 4 }}>{v.note}</div>}
                          {v.pieceJointe && <a href={"http://localhost:3001/uploads/" + v.pieceJointe} target="_blank" rel="noreferrer" className="file-link">Voir piece jointe</a>}
                        </div>
                        <div className="locked-badge">VERROUILLE</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === "caisse" && (
                <div>
                  <div className="st" style={{ marginBottom: 16 }}>Caisse Espece</div>
                  {adminCaisses.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "40px", color: "#6b6380" }}><div style={{ fontSize: 36, marginBottom: 12 }}>💵</div><p>Aucune caisse</p></div>
                  ) : adminCaisses.map(c => (
                    <div key={c.id} className="etat-card" style={{ borderLeft: "3px solid #22c55e" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{c.date}</div>
                          <CaisseCalcBox data={c} />
                          {c.note && <div style={{ fontSize: 13, color: "#8a7f9a", marginTop: 8 }}>{c.note}</div>}
                        </div>
                        <div className="locked-badge" style={{ alignSelf: "flex-start" }}>VERROUILLE</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // FINANCIER
  return (
    <div style={{ background: "#0f1117", minHeight: "100vh" }}>
      <style>{css}</style>
      {toast && <div className="toast" style={{ background: toast.color }}>{toast.msg}</div>}

      {/* Modal recouvrement */}
      {showRecoupModal && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#161622", border: "1px solid #252438", borderRadius: 12, padding: 28, maxWidth: 500, width: "100%" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Marquer un ecart comme recupere</div>
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", marginBottom: 12 }}>SELECTIONNER L ECART</div>
            <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 16 }}>
              {ecartsARecuperer.length === 0 ? (
                <div style={{ color: "#6b6380", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", padding: "12px 0" }}>Aucun ecart a recuperer</div>
              ) : ecartsARecuperer.map(e => (
                <div key={e.justificationId} className={"recouv-item " + (selectedEcart?.justificationId === e.justificationId ? "selected" : "")}
                  onClick={() => { setSelectedEcart(e); setMontantRecup(e.restant.toFixed(3)); setModePaiementRecup(e.modePaiement || "espece"); }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{JUST_LABELS[e.type]} — {e.etatDate}</div>
                      <div style={{ fontSize: 12, color: "#8a7f9a", marginBottom: 2 }}>{e.note}</div>
                      {e.modePaiement && <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: e.modePaiement === "espece" ? "#4ade80" : e.modePaiement === "cheque" ? "#a78bfa" : "#fbbf24" }}>{e.modePaiement === "espece" ? "Espece" : e.modePaiement === "cheque" ? "Cheque" : "Traite"}</div>}
                      {e.montantDejaRecup > 0 && <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#f87171" }}>Deja recu: {fmt(e.montantDejaRecup)}</div>}
                      {e.pieceJointe && <span style={{ fontSize: 10, color: "#a78bfa" }}>📎 PJ</span>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#fbbf24", fontWeight: 600 }}>{fmt(e.restant)}</div>
                      <div style={{ fontSize: 10, color: "#6b6380", fontFamily: "'JetBrains Mono',monospace" }}>restant</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="two">
              <div className="ig">
                <label>Date de recuperation</label>
                <input type="date" className="inp" value={dateRecup} onChange={e => setDateRecup(e.target.value)} />
              </div>
              <div className="ig">
                <label>Mode de paiement</label>
                <select className="inp" value={modePaiementRecup} onChange={e => setModePaiementRecup(e.target.value)}>
                  <option value="espece">Espece</option>
                  <option value="cheque">Cheque</option>
                  <option value="traite">Traite</option>
                </select>
              </div>
            </div>
            <div className="ig">
              <label>Montant recupere (TND)</label>
              <input type="number" className="inp" placeholder="0.000" step="0.001" value={montantRecup} onChange={e => setMontantRecup(e.target.value)} />
              {selectedEcart && <div style={{ fontSize: 11, color: "#6b6380", fontFamily: "'JetBrains Mono',monospace", marginTop: 4 }}>Restant a recuperer: {fmt(selectedEcart.restant)}</div>}
            </div>
            {modePaiementRecup !== "espece" && (
              <div style={{ background: "#1a1a2e", border: "1px solid #2e2a3e", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#8a7f9a" }}>
                Cheque et Traite ne s ajoutent pas a la caisse espece.
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn bg" onClick={() => { setShowRecoupModal(false); setSelectedEcart(null); setMontantRecup(""); setModePaiementRecup("espece"); }}>Annuler</button>
              <button className="btn bp" onClick={handleRecouvrement} disabled={loading || !selectedEcart}>{loading ? "..." : "Confirmer"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px" }}>
        <Navbar />

        <div className="tabs">
          {["etats", "versement", "caisse"].map(t => (
            <button key={t} className={"tab " + (finTab === t ? "active" : "")}
              onClick={() => { setFinTab(t); if (t === "etats") { setFinStep("list"); loadEtats(); } if (t === "caisse") { loadCaisses(); loadCaissePreview(caisseDate); loadEcartsARecuperer(); } if (t === "versement") loadVersements(); }}>
              {t === "etats" ? "Etats de vente" : t === "versement" ? "Versement Banque" : "Caisse Espece"}
            </button>
          ))}
        </div>

        {/* TAB ETATS */}
        {finTab === "etats" && (
          <div>
            {finStep === "list" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div className="st">Etats a valider</div>
                  <button className="btn bg" style={{ fontSize: 12, padding: "8px 14px" }} onClick={loadEtats}>Actualiser</button>
                </div>
                {etats.length === 0 ? (
                  <div className="card" style={{ textAlign: "center", padding: "40px", color: "#6b6380" }}><div style={{ fontSize: 36, marginBottom: 12 }}>📋</div><p>Aucun etat disponible</p></div>
                ) : etats.map(e => (
                  <div key={e.id} className={"etat-card clickable " + (e.status === "open" ? "etat-open" : "etat-closed")} onClick={() => selectEtat(e)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Etat du {e.date}</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", fontSize: 12 }}>
                          {e.status === "open" ? (e.finFields ? "Ecarts en cours" : "Cliquez pour valider") : "Ferme"}
                        </div>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: "4px 12px", borderRadius: 20, background: e.status === "open" ? "#2d1a0d" : "#0d2318", color: e.status === "open" ? "#fbbf24" : "#4ade80" }}>
                        {e.status === "open" ? "A VALIDER" : "FERME"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {finStep === "saisie" && selectedEtat && (
              <div>
                <button className="btn bg" style={{ fontSize: 12, padding: "8px 14px", marginBottom: 20 }} onClick={() => { setFinStep("list"); loadEtats(); }}>← Retour</button>
                <div className="card">
                  <div className="sb">Validation</div>
                  <div className="st">Etat du {selectedEtat.date}</div>
                  <div className="two">
                    {Object.keys(INITIAL_FIN).map(k => (
                      <div className="ig" key={k}>
                        <label>{FIELD_LABELS[k]} <span style={{ fontSize: 10, color: "#6b6380" }}>({FIELD_MODES[k]})</span></label>
                        <input type="number" className="inp" placeholder="0.000" step="0.001" value={finFields[k]} onChange={e => setFinFields({ ...finFields, [k]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "#1a1a2e", border: "1px solid #2e2a3e", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span style={{ color: "#8a7f9a", fontFamily: "'JetBrains Mono',monospace" }}>Total saisi</span>
                      <span style={{ color: "#a78bfa", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{fmt(Object.values(finFields).reduce((s, v) => s + fnum(v), 0))}</span>
                    </div>
                  </div>
                  <hr />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn bs" onClick={handleFinancierValidate} disabled={loading}>{loading ? "..." : "Valider"}</button>
                  </div>
                </div>
              </div>
            )}

            {finStep === "ecart" && selectedEtat && (
              <div>
                <button className="btn bg" style={{ fontSize: 12, padding: "8px 14px", marginBottom: 20 }} onClick={() => { setFinStep("list"); loadEtats(); }}>← Retour</button>
                <div className="card">
                  <div className="sb" style={{ borderColor: "#92400e", color: "#fbbf24" }}>Resultat</div>
                  <div className="st">Etat du {selectedEtat.date}</div>
                  <div style={{ background: "#2d1a0d", border: "1px solid #92400e44", borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
                    <div className="read-row"><span style={{ color: "#8a7f9a" }}>Total saisi</span><span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a78bfa", fontWeight: 600 }}>{fmt(selectedEtat.totalFin)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, fontWeight: 700, fontSize: 16 }}>
                      <span style={{ color: Math.abs(ecartGlobal) < 0.001 ? "#4ade80" : "#f87171" }}>{Math.abs(ecartGlobal) < 0.001 ? "Aucun ecart" : ecartGlobal > 0 ? "Excedent" : "Manque"}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: Math.abs(ecartGlobal) < 0.001 ? "#4ade80" : "#f87171" }}>{fmt(ecartGlobal)}</span>
                    </div>
                  </div>
                  {Math.abs(ecartGlobal) < 0.001 && (
                    <div style={{ background: "#0d2318", border: "1px solid #16532d44", borderRadius: 8, padding: "12px 16px", color: "#4ade80", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, textAlign: "center" }}>
                      {selectedEtat.finFields && Object.keys(selectedEtat.finFields).some(k => {
                        const mode = (selectedEtat.finModes?.[k]) || FIELD_MODES[k] || "espece";
                        return parseFloat(selectedEtat.finFields[k] || 0) !== 0 && mode !== "espece";
                      })
                        ? "Mode non-espece detecte. En attente de fermeture par l'administrateur."
                        : "En attente de fermeture par l administrateur."}
                    </div>
                  )}
                </div>

                {Math.abs(ecartGlobal) > 0.001 && (
                  <>
                    <div className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                        <span style={{ color: "#8a7f9a", fontFamily: "'JetBrains Mono',monospace" }}>Ecart total</span>
                        <span style={{ color: "#fbbf24", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{fmt(Math.abs(ecartGlobal))}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
                        <span style={{ color: "#8a7f9a", fontFamily: "'JetBrains Mono',monospace" }}>Justifie ecart</span>
                        <span style={{ color: "#4ade80", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{fmt(totalJustifie)}</span>
                      </div>
                      <div className="pb"><div className="pbi" style={{ width: (Math.abs(ecartGlobal) > 0 ? Math.min(100, (totalJustifie / Math.abs(ecartGlobal)) * 100) : 0) + "%", background: restant < 0.001 ? "#22c55e" : "linear-gradient(90deg,#7c3aed,#a855f7)" }} /></div>
                      <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", textAlign: "right" }}>Restant : {fmt(restant)}</div>
                      {restant < 0.001 && (
                        <div style={{ marginTop: 12, background: "#0d2318", border: "1px solid #16532d44", borderRadius: 8, padding: "12px 16px", color: "#4ade80", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, textAlign: "center" }}>
                          Tous les ecarts sont justifies. En attente de fermeture par l administrateur.
                        </div>
                      )}
                    </div>
                    <div className="card">
                      <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", marginBottom: 16 }}>AJOUTER UN ECART</div>
                      <div className="two">
                        <div className="ig"><label>Type</label>
                          <select className="inp" value={newJust.type} onChange={e => setNewJust({ ...newJust, type: e.target.value })}>
                            <option value="">Selectionner</option>
                            {JUSTIFICATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div className="ig">
                          <label>Mode de paiement</label>
                          <select className="inp" value={newJust.modePaiement} onChange={e => setNewJust({ ...newJust, modePaiement: e.target.value })}>
                            <option value="espece">Espece</option>
                            <option value="tpe">TPE</option>
                            <option value="virement">Virement</option>
                            <option value="cheque">Cheque</option>
                          </select>
                        </div>
                      </div>
                      <div className="two">
                        <div className="ig"><label>Montant (TND)</label><input type="number" className="inp" placeholder="0.000" step="0.001" value={newJust.montant} onChange={e => setNewJust({ ...newJust, montant: e.target.value })} /></div>
                        <div className="ig">
                          <label>Date de l ecart</label>
                          <input type="date" className="inp" value={newJust.dateEcart} onChange={e => setNewJust({ ...newJust, dateEcart: e.target.value })} />
                        </div>
                      </div>
                      {/* Champ pièce jointe pour non-espece */}
                      {newJust.modePaiement !== "espece" && (
                        <div className="ig">
                          <label>Pièce jointe {newJust.modePaiement === "tpe" ? "(ticket TPE)" : newJust.modePaiement === "virement" ? "(preuve virement)" : "(cheque scan)"} *</label>
                          <input
                            type="file"
                            className="inp"
                            accept="image/*,.pdf"
                            onChange={e => setNewJust({ ...newJust, pieceJointe: e.target.files[0] })}
                            style={{ padding: "8px" }}
                          />
                          {newJust.pieceJointe && <div style={{ fontSize: 12, color: "#4ade80", fontFamily: "'JetBrains Mono',monospace", marginTop: 4 }}>{newJust.pieceJointe.name}</div>}
                        </div>
                      )}
                      <div className="ig"><label>Note</label><textarea className="inp" rows={2} value={newJust.note} onChange={e => setNewJust({ ...newJust, note: e.target.value })} style={{ resize: "vertical" }} /></div>
                      <button className="btn bp" onClick={addJustification} disabled={loading}>{loading ? "..." : "+ Ajouter"}</button>
                    </div>
                    {justifications.length > 0 && (
                      <div className="card">
                        <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", marginBottom: 14 }}>ECARTS ({justifications.length})</div>
                        {justifications.map(j => (
                          <div className="ji" key={j.id}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, color: "#a78bfa" }}>{JUST_LABELS[j.type]}</span>
                                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#fbbf24", marginLeft: "auto" }}>{fmt(j.montant)}</span>
                              </div>
                              <div style={{ fontSize: 13, color: "#8a7f9a", marginBottom: 4 }}>{j.note}</div>
                              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>


                                {j.dateEcart && <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380" }}>Ecart: {j.dateEcart}</span>}
                                {j.dateRecuperation && <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380" }}>Recup: {j.dateRecuperation}</span>}
                                {j.modePaiement && (
                                  <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: j.modePaiement === "espece" ? "#4ade80" : j.modePaiement === "cheque" ? "#a78bfa" : "#fbbf24" }}>
                                    {j.modePaiement === "espece" ? "Espece" : j.modePaiement === "tpe" ? "TPE" : j.modePaiement === "virement" ? "Virement" : "Cheque"}
                                  </span>
                                )}
                                {j.modePaiement === "espece" && j.recupere && <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#4ade80" }}>+ Caisse {j.dateRecuperation}</span>}
                              </div>
                              {j.pieceJointe && (
                                <a href={"http://localhost:3001/uploads/" + j.pieceJointe} target="_blank" rel="noreferrer" className="file-link" style={{ display: "inline-block", marginTop: 4 }}>
                                  📎 Voir piece jointe
                                </a>
                              )}
                            </div>
                            <div className="locked-badge" style={{ alignSelf: "flex-start", fontSize: 10 }}>VERROUILLE</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {finStep === "readonly" && selectedEtat && (
              <div>
                <button className="btn bg" style={{ fontSize: 12, padding: "8px 14px", marginBottom: 20 }} onClick={() => { setFinStep("list"); }}>← Retour</button>
                <div className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div className="sb">Etat ferme - Lecture seule</div>
                      <div className="st">Etat du {selectedEtat.date}</div>
                    </div>
                    <div style={{ background: "#0d2318", border: "1px solid #16532d", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#4ade80" }}>FERME</div>
                  </div>
                  {selectedEtat.finFields && (
                    <div style={{ background: "#1a1a2e", border: "1px solid #2e2a3e", borderRadius: 8, padding: "14px 18px", marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", marginBottom: 10 }}>MONTANTS SAISIS</div>
                      {Object.keys(FIELD_LABELS).map(k => (
                        <div className="read-row" key={k}>
                          <span style={{ color: "#8a7f9a" }}>{FIELD_LABELS[k]} <span style={{ fontSize: 10, color: "#6b6380" }}>({selectedEtat.finModes?.[k] || FIELD_MODES[k]})</span></span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{fmt(selectedEtat.finFields[k])}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, fontWeight: 700 }}>
                        <span>Total</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a78bfa" }}>{fmt(selectedEtat.totalFin)}</span>
                      </div>
                    </div>
                  )}
                  {selectedEtat.ecarts && Math.abs(selectedEtat.ecarts.ecartGlobal) > 0.001 && (
                    <div style={{ background: "#2d1a0d", border: "1px solid #92400e44", borderRadius: 8, padding: "14px 18px", marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", marginBottom: 10 }}>ECART</div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#f87171" }}>
                        <span>Ecart global</span>
                        <span>{fmt(selectedEtat.ecarts.ecartGlobal)}</span>
                      </div>
                    </div>
                  )}
                  {selectedEtat.justifications?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", marginBottom: 12 }}>ECARTS AJOUTES ({selectedEtat.justifications.length})</div>
                      {selectedEtat.justifications.map(j => (
                        <div className="ji" key={j.id} style={{ cursor: "default" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, color: "#a78bfa" }}>{JUST_LABELS[j.type]}</span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#fbbf24", marginLeft: "auto" }}>{fmt(j.montant)}</span>
                            </div>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                              {j.dateEcart && <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380" }}>Date ecart: {j.dateEcart}</span>}
                              {j.dateRecuperation && <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380" }}>Recupere: {j.dateRecuperation}</span>}
                              {j.modePaiement && (
                                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: j.modePaiement === "espece" ? "#4ade80" : j.modePaiement === "cheque" ? "#a78bfa" : "#fbbf24" }}>
                                  {j.modePaiement === "espece" ? "Espece" : j.modePaiement === "tpe" ? "TPE" : j.modePaiement === "virement" ? "Virement" : "Cheque"}
                                </span>
                              )}
                            </div>
                            {j.pieceJointe && (
                              <a href={"http://localhost:3001/uploads/" + j.pieceJointe} target="_blank" rel="noreferrer" className="file-link" style={{ display: "inline-block", marginTop: 4 }}>
                                📎 Voir piece jointe
                              </a>
                            )}
                          </div>
                          <div className="locked-badge" style={{ alignSelf: "flex-start", fontSize: 10 }}>VERROUILLE</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB VERSEMENT */}
        {finTab === "versement" && (
          <div>
            <div className="card">
              <div className="sb">Nouveau versement</div>
              <div className="st">Versement Banque</div>
              <div className="ss">Verrouille apres enregistrement</div>
              <div className="two">
                <div className="ig"><label>Date</label><input type="date" className="inp" value={versDate} onChange={e => setVersDate(e.target.value)} /></div>
                <div className="ig"><label>Montant verse (TND)</label><input type="number" className="inp" placeholder="0.000" step="0.001" value={versMontant} onChange={e => setVersMontant(e.target.value)} /></div>
              </div>
              <div className="ig">
                <label>Piece jointe (facture banque)</label>
                <input type="file" className="inp" accept="image/*,.pdf" onChange={e => setVersFichier(e.target.files[0])} style={{ padding: "8px" }} />
                {versFichier && <div style={{ fontSize: 12, color: "#4ade80", fontFamily: "'JetBrains Mono',monospace", marginTop: 4 }}>{versFichier.name}</div>}
              </div>
              <div className="ig"><label>Note (optionnel)</label><textarea className="inp" rows={2} value={versNote} onChange={e => setVersNote(e.target.value)} style={{ resize: "vertical" }} /></div>
              <hr />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn bp" onClick={handleVersement} disabled={loading}>{loading ? "..." : "Enregistrer et verrouiller"}</button>
              </div>
            </div>
            {versements.length > 0 && (
              <div>
                <div className="st" style={{ marginBottom: 16 }}>Historique</div>
                {versements.map(v => (
                  <div key={v.id} className="etat-card" style={{ borderLeft: "3px solid #7c3aed" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{v.date}</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a78bfa", fontSize: 14, marginBottom: 4 }}>{fmt(v.montant)}</div>
                        {v.note && <div style={{ fontSize: 13, color: "#8a7f9a", marginBottom: 4 }}>{v.note}</div>}
                        {v.pieceJointe && <a href={"http://localhost:3001/uploads/" + v.pieceJointe} target="_blank" rel="noreferrer" className="file-link">Voir piece jointe</a>}
                      </div>
                      <div className="locked-badge">VERROUILLE</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB CAISSE */}
        {finTab === "caisse" && (
          <div>
            {/* Ecarts a recuperer */}
            {ecartsARecuperer.length > 0 && (
              <div style={{ background: "#2d1a0d", border: "1px solid #92400e44", borderRadius: 10, padding: "14px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{ecartsARecuperer.length} ecart(s) a recuperer</div>
                  <div style={{ fontSize: 12, color: "#8a7f9a", fontFamily: "'JetBrains Mono',monospace" }}>Total : {fmt(ecartsARecuperer.reduce((s, e) => s + e.montant, 0))}</div>
                </div>
                <button className="btn" style={{ background: "linear-gradient(135deg,#92400e,#f59e0b)", color: "#fff", fontSize: 13, padding: "8px 16px" }}
                  onClick={() => setShowRecoupModal(true)}>
                  Marquer comme recupere
                </button>
              </div>
            )}

            <div className="card">
              <div className="sb">Nouvelle entree caisse</div>
              <div className="st">Caisse Espece</div>
              <div className="ss">Initial = Reste du jour precedent (automatique)</div>
              <div className="ig"><label>Date</label><input type="date" className="inp" value={caisseDate} onChange={e => { setCaisseDate(e.target.value); loadCaissePreview(e.target.value); }} /></div>

              {caissePreview && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#6b6380", marginBottom: 8 }}>CALCUL AUTOMATIQUE POUR LE {caisseDate}</div>
                  <CaisseCalcBox data={caissePreview} />
                </div>
              )}

              <div className="ig"><label>Depenses du jour (TND)</label><input type="number" className="inp" placeholder="0.000" step="0.001" value={caisseDeps} onChange={e => { setCaisseDeps(e.target.value); loadCaissePreview(caisseDate, e.target.value); }} /></div>
              <div className="ig"><label>Note (optionnel)</label><textarea className="inp" rows={2} value={caisseNote} onChange={e => setCaisseNote(e.target.value)} style={{ resize: "vertical" }} /></div>
              <hr />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn bp" onClick={handleCaisse} disabled={loading}>{loading ? "..." : "Enregistrer et verrouiller"}</button>
              </div>
            </div>

            {caisses.length > 0 && (
              <div>
                <div className="st" style={{ marginBottom: 16 }}>Historique caisse</div>
                {caisses.map(c => (
                  <div key={c.id} className="etat-card" style={{ borderLeft: "3px solid #22c55e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{c.date}</div>
                        <CaisseCalcBox data={c} />
                        {c.note && <div style={{ fontSize: 13, color: "#8a7f9a", marginTop: 8 }}>{c.note}</div>}
                      </div>
                      <div className="locked-badge" style={{ alignSelf: "flex-start" }}>VERROUILLE</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  
  );

  }