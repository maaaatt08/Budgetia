"use client";
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { supabase } from "../lib/supabase";

const BADGES = [
  { id: "first", icon: "🌱", label: "Premier pas", desc: "Première analyse", condition: (h) => h.length >= 1 },
  { id: "streak3", icon: "🔥", label: "En feu", desc: "3 mois d'amélioration", condition: (h) => h.length >= 3 && h.slice(-3).every((m, i, a) => i === 0 || m.score > a[i - 1].score) },
  { id: "saver", icon: "💎", label: "Épargnant", desc: "10% de revenus épargnés", condition: (h) => h.some(m => m.epargne / m.revenus >= 0.1) },
  { id: "goal", icon: "🎯", label: "Objectif atteint", desc: "Objectif d'épargne atteint", condition: (h) => h.some(m => m.epargne >= m.objectif) },
  { id: "champion", icon: "🏆", label: "Champion", desc: "Score > 80 pendant 2 mois", condition: (h) => { const hi = h.filter(m => m.score > 80); return hi.length >= 2; } },
];

const CAT_COLORS = { loyer: "#6366f1", courses: "#f59e0b", transport: "#10b981", abonnements: "#ec4899", loisirs: "#8b5cf6", autres: "#94a3b8" };
const CAT_LABELS = { loyer: "🏠 Loyer", courses: "🛒 Courses", transport: "🚗 Transport", abonnements: "📱 Abonnements", loisirs: "🎮 Loisirs", autres: "📦 Autres" };

function scoreColor(s) { return s >= 70 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444"; }
function scoreLabel(s) { return s >= 80 ? "Excellent" : s >= 70 ? "Bien" : s >= 55 ? "Correct" : s >= 40 ? "À améliorer" : "Critique"; }
function totalDep(m) { return (m.loyer||0) + (m.courses||0) + (m.transport||0) + (m.abonnements||0) + (m.loisirs||0) + (m.autres||0); }

function ScoreRing({ score, size = 120 }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const col = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e1e2e" strokeWidth={10} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={10}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }} />
      <text x={size / 2} y={size / 2 + 6} textAnchor="middle" fill={col}
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px`, fontSize: size * 0.22, fontWeight: 700, fontFamily: "Playfair Display, serif" }}>
        {score}
      </text>
    </svg>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#111118", border: "1px solid #2a2a3e", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span><span style={{ fontWeight: 700 }}>{p.value}{p.dataKey === "score" ? "" : "€"}</span>
        </div>
      ))}
    </div>
  );
}

export default function BudgetTracker({ view, setView }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ month: "", revenus: "", loyer: "", courses: "", transport: "", abonnements: "", loisirs: "", autres: "", objectif: "300" });
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("budget_entries")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });
      if (!error && data) setHistory(data);
      setLoading(false);
    }
    loadData();
  }, []);

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const scoreDelta = latest && prev ? latest.score - prev.score : 0;
  const epDelta = latest && prev ? latest.epargne - prev.epargne : 0;
  const totalEpargne = history.reduce((s, m) => s + (m.epargne || 0), 0);

  async function generateAIAnalysis(monthData) {
    setAiLoading(true);
    const dep = totalDep(monthData);
    const rev = monthData.revenus;
    const hist = history.slice(-3);

    const prompt = `Tu es un conseiller financier expert et bienveillant. Analyse ce budget mensuel et réponds UNIQUEMENT en JSON pur (sans backticks).

Données du mois (${monthData.month}) :
- Revenus : ${rev}€
- Dépenses totales : ${dep}€
- Épargne réalisée : ${monthData.epargne}€ (objectif : ${monthData.objectif}€)
- Score : ${monthData.score}/100
- Loyer : ${monthData.loyer}€ (${((monthData.loyer/rev)*100).toFixed(1)}% des revenus)
- Courses : ${monthData.courses}€ (${((monthData.courses/rev)*100).toFixed(1)}%)
- Transport : ${monthData.transport}€ (${((monthData.transport/rev)*100).toFixed(1)}%)
- Abonnements : ${monthData.abonnements}€ (${((monthData.abonnements/rev)*100).toFixed(1)}%)
- Loisirs : ${monthData.loisirs}€ (${((monthData.loisirs/rev)*100).toFixed(1)}%)
- Autres : ${monthData.autres}€ (${((monthData.autres/rev)*100).toFixed(1)}%)
${hist.length > 0 ? `Historique récent : ${hist.map(m => `${m.month}: score ${m.score}, épargne ${m.epargne}€`).join(" | ")}` : ""}

Réponds avec ce JSON exact :
{
  "resume": "<2 phrases percutantes résumant la situation financière avec des chiffres précis>",
  "alertes": ["<alerte chiffrée 1>", "<alerte chiffrée 2>"],
  "conseils": ["<conseil actionnable et chiffré 1>", "<conseil actionnable et chiffré 2>", "<conseil actionnable et chiffré 3>"],
  "pointsForts": ["<point fort avec chiffre 1>", "<point fort avec chiffre 2>"],
  "economiesPossibles": <montant entier en euros>,
  "objectifAtteint": <true ou false>
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content.map(i => i.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      setAiAnalysis(JSON.parse(clean));
    } catch {
      setAiAnalysis({
        resume: "Analyse indisponible, mais vos données ont bien été enregistrées.",
        alertes: [],
        conseils: ["Consultez votre tableau de bord pour suivre votre progression."],
        pointsForts: [],
        economiesPossibles: 0,
        objectifAtteint: monthData.epargne >= monthData.objectif,
      });
    }
    setAiLoading(false);
  }

  function computeScore(f) {
    const rev = parseFloat(f.revenus) || 1;
    const dep = ["loyer", "courses", "transport", "abonnements", "loisirs", "autres"].reduce((s, k) => s + (parseFloat(f[k]) || 0), 0);
    const ep = parseFloat(f.epargne) || 0;
    let s = 100 - Math.round((dep / rev) * 80);
    if (ep / rev >= 0.1) s += 10;
    if (ep >= parseFloat(f.objectif)) s += 5;
    return Math.max(0, Math.min(100, s));
  }

  async function addMonth() {
    setSaving(true);
    const dep = ["loyer", "courses", "transport", "abonnements", "loisirs", "autres"].reduce((s, k) => s + (parseFloat(form[k]) || 0), 0);
    const rev = parseFloat(form.revenus) || 0;
    const ep = Math.max(0, rev - dep);
    const score = computeScore({ ...form, epargne: ep });
    const { data: { session } } = await supabase.auth.getSession();
    const entry = {
      user_id: session.user.id, month: form.month, revenus: rev,
      loyer: parseFloat(form.loyer)||0, courses: parseFloat(form.courses)||0,
      transport: parseFloat(form.transport)||0, abonnements: parseFloat(form.abonnements)||0,
      loisirs: parseFloat(form.loisirs)||0, autres: parseFloat(form.autres)||0,
      epargne: ep, score, objectif: parseFloat(form.objectif)||300,
    };
    const { data, error } = await supabase.from("budget_entries").insert([entry]).select();
    if (!error && data) {
      const newHistory = [...history, data[0]];
      setHistory(newHistory);
      setAiAnalysis(null);
      setSaving(false);
      setForm({ month: "", revenus: "", loyer: "", courses: "", transport: "", abonnements: "", loisirs: "", autres: "", objectif: "300" });
      setView("analysis");
      generateAIAnalysis(data[0]);
    } else {
      setSaving(false);
    }
  }

  const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

  if (loading) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa", fontSize: 16 }}>
      Chargement de vos données...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#07070d", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        .card{background:#0f0f18;border:1px solid #1a1a28;border-radius:16px}
        .card-hover{transition:all 0.2s;cursor:pointer}.card-hover:hover{border-color:#6366f1;transform:translateY(-2px)}
        .inp{background:#13131e;border:1px solid #1e1e30;border-radius:10px;color:#e2e8f0;padding:9px 13px;font-size:14px;font-family:inherit;outline:none;width:100%;transition:border 0.2s}
        .inp:focus{border-color:#6366f1}
        .btn{border:none;border-radius:10px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s}
        .btn-p{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white}.btn-p:hover{box-shadow:0 6px 20px rgba(99,102,241,0.4);transform:translateY(-1px)}
        .btn-g{background:#13131e;border:1px solid #1e1e30;color:#94a3b8}.btn-g:hover{border-color:#6366f1;color:#a78bfa}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp 0.4s ease forwards}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .shimmer{background:linear-gradient(90deg,#1a1a28 25%,#2a2a3e 50%,#1a1a28 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>

        {/* DASHBOARD VIDE */}
        {view === "dashboard" && history.length === 0 && (
          <div className="fu" style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>💰</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>Bienvenue sur BudgetAI</h2>
            <p style={{ color: "#475569", fontSize: 15, marginBottom: 28 }}>Commencez par ajouter votre premier mois pour voir votre analyse financière.</p>
            <button className="btn btn-p" onClick={() => setView("add")} style={{ padding: "13px 28px", fontSize: 15 }}>✨ Ajouter mon premier mois</button>
          </div>
        )}

        {/* DASHBOARD */}
        {view === "dashboard" && history.length > 0 && (
          <div className="fu">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Score ce mois", value: `${latest.score}/100`, sub: scoreDelta >= 0 ? `↑ +${scoreDelta} pts` : `↓ ${scoreDelta} pts`, subColor: scoreDelta >= 0 ? "#10b981" : "#ef4444", accent: scoreColor(latest.score) },
                { label: "Épargne ce mois", value: `${latest.epargne}€`, sub: epDelta >= 0 ? `↑ +${epDelta}€ vs mois dernier` : `↓ ${epDelta}€ vs mois dernier`, subColor: epDelta >= 0 ? "#10b981" : "#ef4444", accent: "#10b981" },
                { label: "Épargne totale", value: `${totalEpargne}€`, sub: `Sur ${history.length} mois`, subColor: "#64748b", accent: "#f59e0b" },
                { label: "Dépenses ce mois", value: `${totalDep(latest)}€`, sub: `sur ${latest.revenus}€ de revenus`, subColor: "#64748b", accent: "#6366f1" },
              ].map((k, i) => (
                <div key={i} className="card" style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: k.accent, fontFamily: "'Playfair Display', serif" }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: k.subColor, marginTop: 3 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>📈 Évolution du score</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={history}>
                    <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="score" name="Score" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#a78bfa" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>💰 Évolution de l'épargne</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={history} barSize={28}>
                    <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="epargne" name="Épargne" radius={[6, 6, 0, 0]}>
                      {history.map((m, i) => <Cell key={i} fill={m.epargne >= m.objectif ? "#10b981" : "#6366f1"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>🗂️ Répartition ce mois — {latest.month}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(CAT_LABELS).map(([key, label]) => {
                  const amt = latest[key] || 0;
                  const pct = latest.revenus > 0 ? (amt / latest.revenus) * 100 : 0;
                  const prevAmt = prev ? prev[key] || 0 : 0;
                  const delta = amt - prevAmt;
                  return (
                    <div key={key}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "#cbd5e1" }}>{label}</span>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {prev && <span style={{ fontSize: 11, color: delta > 0 ? "#ef4444" : "#10b981" }}>{delta > 0 ? `↑ +${delta}€` : `↓ ${delta}€`}</span>}
                          <span style={{ fontSize: 11, color: "#475569" }}>{pct.toFixed(1)}%</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: CAT_COLORS[key], minWidth: 60, textAlign: "right" }}>{amt}€</span>
                        </div>
                      </div>
                      <div style={{ height: 5, background: "#1a1a28", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(pct * 1.5, 100)}%`, background: CAT_COLORS[key], borderRadius: 3, transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>🏆 Badges</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {BADGES.map(b => {
                    const unlocked = b.condition(history);
                    return (
                      <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, opacity: unlocked ? 1 : 0.3 }}>
                        <span style={{ fontSize: 22, filter: unlocked ? "none" : "grayscale(1)" }}>{b.icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: unlocked ? "#e2e8f0" : "#475569" }}>{b.label}</div>
                          <div style={{ fontSize: 11, color: "#475569" }}>{b.desc}</div>
                        </div>
                        {unlocked && <span style={{ marginLeft: "auto", fontSize: 10, background: "rgba(99,102,241,0.15)", color: "#a78bfa", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>DÉBLOQUÉ</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>📅 Historique mensuel</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...history].reverse().map((m, i) => (
                    <div key={i} className="card-hover" onClick={() => { setSelected(m); setView("detail"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#13131e", borderRadius: 10, border: "1px solid #1a1a28" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <ScoreRing score={m.score} size={38} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{m.month}</div>
                          <div style={{ fontSize: 11, color: "#475569" }}>Épargne : {m.epargne}€</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: scoreColor(m.score), fontWeight: 600 }}>{scoreLabel(m.score)}</div>
                        <div style={{ fontSize: 11, color: "#475569" }}>{totalDep(m)}€ dépensés</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FORMULAIRE NOUVEAU MOIS */}
        {view === "add" && (
          <div className="fu" style={{ maxWidth: 520, margin: "0 auto" }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, marginBottom: 6, background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Nouveau mois</h2>
            <p style={{ color: "#475569", fontSize: 13, marginBottom: 24 }}>Entrez vos données et l'IA analysera votre progression.</p>
            <div className="card" style={{ padding: 24, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Mois</label>
                  <select className="inp" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })}>
                    <option value="">Choisir...</option>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Revenus nets (€)</label>
                  <input className="inp" type="number" placeholder="2500" value={form.revenus} onChange={e => setForm({ ...form, revenus: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: 24, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", marginBottom: 14 }}>Dépenses mensuelles</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(CAT_LABELS).map(([key, label]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16, width: 24 }}>{label.split(" ")[0]}</span>
                    <span style={{ fontSize: 13, color: "#94a3b8", flex: 1 }}>{label.split(" ").slice(1).join(" ")}</span>
                    <div style={{ position: "relative", width: 110 }}>
                      <input className="inp" type="number" placeholder="0" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={{ paddingRight: 28, textAlign: "right" }} />
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#6366f1", fontSize: 12, fontWeight: 700 }}>€</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>🎯 Objectif d'épargne (€)</label>
              <input className="inp" type="number" placeholder="300" value={form.objectif} onChange={e => setForm({ ...form, objectif: e.target.value })} />
            </div>
            {form.revenus && (
              <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600, marginBottom: 6 }}>Aperçu</div>
                <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#94a3b8" }}>
                  <span>Dépenses : <b style={{ color: "#e2e8f0" }}>{Object.keys(CAT_LABELS).reduce((s, k) => s + (parseFloat(form[k]) || 0), 0)}€</b></span>
                  <span>Épargne estimée : <b style={{ color: "#10b981" }}>{Math.max(0, (parseFloat(form.revenus)||0) - Object.keys(CAT_LABELS).reduce((s, k) => s + (parseFloat(form[k])||0), 0))}€</b></span>
                </div>
              </div>
            )}
            <button className="btn btn-p" onClick={addMonth} disabled={!form.month || !form.revenus || saving} style={{ width: "100%", padding: "13px 24px", fontSize: 15 }}>
              {saving ? "Sauvegarde en cours..." : "✨ Analyser ce mois"}
            </button>
          </div>
        )}

        {/* PAGE ANALYSE IA */}
        {view === "analysis" && history.length > 0 && (
          <div className="fu" style={{ maxWidth: 700, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Analyse IA — {latest.month}
                </h2>
                <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>Rapport de votre conseiller financier personnel</p>
              </div>
              <button className="btn btn-g" onClick={() => setView("dashboard")} style={{ padding: "8px 16px", fontSize: 13 }}>
                Voir le tableau de bord →
              </button>
            </div>

            {/* Score + résumé */}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, marginBottom: 16 }}>
              <div className="card" style={{ padding: 24, textAlign: "center", minWidth: 130 }}>
                <ScoreRing score={latest.score} size={90} />
                <div style={{ fontSize: 11, color: "#475569", marginTop: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Score</div>
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: scoreColor(latest.score), background: `${scoreColor(latest.score)}20`, padding: "3px 10px", borderRadius: 20, display: "inline-block" }}>
                  {scoreLabel(latest.score)}
                </div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>🤖 Résumé du conseiller</div>
                {aiLoading ? (
                  <div>
                    <div className="shimmer" style={{ height: 14, borderRadius: 6, marginBottom: 8, width: "100%" }} />
                    <div className="shimmer" style={{ height: 14, borderRadius: 6, width: "80%" }} />
                  </div>
                ) : (
                  <p style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: 14 }}>{aiAnalysis?.resume}</p>
                )}
                <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
                  {[
                    { label: "Revenus", value: `${latest.revenus}€`, color: "#10b981" },
                    { label: "Dépenses", value: `${totalDep(latest)}€`, color: "#ef4444" },
                    { label: "Épargne", value: `${latest.epargne}€`, color: latest.epargne >= latest.objectif ? "#10b981" : "#f59e0b" },
                    { label: "Économies possibles", value: aiLoading ? "..." : `+${aiAnalysis?.economiesPossibles || 0}€`, color: "#f59e0b" },
                  ].map((s, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>{s.label}</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {/* Objectif badge */}
                {!aiLoading && aiAnalysis && (
                  <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: aiAnalysis.objectifAtteint ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)", border: `1px solid ${aiAnalysis.objectifAtteint ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}` }}>
                    <span>{aiAnalysis.objectifAtteint ? "✅" : "🎯"}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: aiAnalysis.objectifAtteint ? "#10b981" : "#f59e0b" }}>
                      {aiAnalysis.objectifAtteint ? `Objectif atteint ! (${latest.objectif}€)` : `Objectif : ${latest.epargne}€ / ${latest.objectif}€`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Alertes & Points forts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>⚠️ Points d'attention</div>
                {aiLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[1, 2].map(i => <div key={i} className="shimmer" style={{ height: 52, borderRadius: 8 }} />)}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {aiAnalysis?.alertes?.length ? aiAnalysis.alertes.map((a, i) => (
                      <div key={i} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }}>{a}</div>
                    )) : <div style={{ color: "#475569", fontSize: 13 }}>Aucune alerte ce mois-ci 🎉</div>}
                  </div>
                )}
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 12, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>✅ Points forts</div>
                {aiLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[1, 2].map(i => <div key={i} className="shimmer" style={{ height: 52, borderRadius: 8 }} />)}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {aiAnalysis?.pointsForts?.length ? aiAnalysis.pointsForts.map((p, i) => (
                      <div key={i} style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#6ee7b7", lineHeight: 1.5 }}>{p}</div>
                    )) : <div style={{ color: "#475569", fontSize: 13 }}>Continuez vos efforts !</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Conseils personnalisés */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>💡 Conseils personnalisés de votre conseiller</div>
              {aiLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ display: "flex", gap: 10 }}>
                      <div className="shimmer" style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="shimmer" style={{ height: 13, borderRadius: 6, marginBottom: 6, width: "100%" }} />
                        <div className="shimmer" style={{ height: 13, borderRadius: 6, width: "70%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {aiAnalysis?.conseils?.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{c}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Répartition dépenses */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>🗂️ Répartition des dépenses — {latest.month}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(CAT_LABELS).map(([key, label]) => {
                  const amt = latest[key] || 0;
                  const pct = latest.revenus > 0 ? (amt / latest.revenus) * 100 : 0;
                  return (
                    <div key={key}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "#cbd5e1" }}>{label}</span>
                        <div style={{ display: "flex", gap: 10 }}>
                          <span style={{ fontSize: 11, color: "#475569" }}>{pct.toFixed(1)}%</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: CAT_COLORS[key], minWidth: 55, textAlign: "right" }}>{amt}€</span>
                        </div>
                      </div>
                      <div style={{ height: 5, background: "#1a1a28", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(pct * 1.5, 100)}%`, background: CAT_COLORS[key], borderRadius: 3, transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* DETAIL MOIS */}
        {view === "detail" && selected && (
          <div className="fu" style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button className="btn btn-g" onClick={() => setView("dashboard")} style={{ padding: "6px 12px", fontSize: 13 }}>← Retour</button>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Rapport — {selected.month}</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
              <ScoreRing score={selected.score} size={100} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(selected.score), fontFamily: "'Playfair Display', serif" }}>{scoreLabel(selected.score)}</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Score : {selected.score}/100</div>
                <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                  <div><div style={{ fontSize: 11, color: "#475569" }}>Revenus</div><div style={{ color: "#10b981", fontWeight: 700 }}>{selected.revenus}€</div></div>
                  <div><div style={{ fontSize: 11, color: "#475569" }}>Dépenses</div><div style={{ color: "#ef4444", fontWeight: 700 }}>{totalDep(selected)}€</div></div>
                  <div><div style={{ fontSize: 11, color: "#475569" }}>Épargne</div><div style={{ color: "#f59e0b", fontWeight: 700 }}>{selected.epargne}€</div></div>
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", marginBottom: 14 }}>Détail des dépenses</div>
              {Object.entries(CAT_LABELS).map(([key, label]) => {
                const amt = selected[key] || 0;
                const pct = selected.revenus > 0 ? (amt / selected.revenus) * 100 : 0;
                return (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "#cbd5e1" }}>{label}</span>
                      <div style={{ display: "flex", gap: 10 }}>
                        <span style={{ fontSize: 11, color: "#475569" }}>{pct.toFixed(1)}%</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: CAT_COLORS[key] }}>{amt}€</span>
                      </div>
                    </div>
                    <div style={{ height: 5, background: "#1a1a28", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct * 1.5, 100)}%`, background: CAT_COLORS[key], borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
