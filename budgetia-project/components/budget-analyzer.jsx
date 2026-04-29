import { useState } from "react";

const CATEGORIES = {
  "Logement": ["loyer", "charges", "électricité", "gaz", "eau", "assurance habitation", "internet", "box"],
  "Alimentation": ["supermarché", "courses", "carrefour", "leclerc", "lidl", "aldi", "monoprix", "franprix", "restaurant", "mcdo", "mcdonald", "burger", "pizza", "sushi", "uber eats", "deliveroo", "just eat"],
  "Transport": ["essence", "carburant", "total", "bp", "sncf", "ratp", "navigo", "uber", "taxi", "blablacar", "parking", "péage", "assurance auto"],
  "Abonnements": ["netflix", "spotify", "disney", "amazon prime", "canal", "deezer", "apple", "youtube", "adobe", "microsoft"],
  "Santé": ["pharmacie", "médecin", "dentiste", "ophtalmo", "mutuelle", "cpam"],
  "Loisirs": ["cinema", "concert", "sport", "salle de sport", "fnac", "amazon", "jeux", "livre", "vêtements", "zara", "h&m"],
  "Épargne": ["virement", "épargne", "livret", "assurance vie"],
};

function categorize(label) {
  const l = label.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(k => l.includes(k))) return cat;
  }
  return "Autres";
}

const CAT_COLORS = {
  "Logement": "#6366f1",
  "Alimentation": "#f59e0b",
  "Transport": "#10b981",
  "Abonnements": "#ec4899",
  "Santé": "#3b82f6",
  "Loisirs": "#8b5cf6",
  "Épargne": "#14b8a6",
  "Autres": "#94a3b8",
};

const CAT_ICONS = {
  "Logement": "🏠", "Alimentation": "🍽️", "Transport": "🚗",
  "Abonnements": "📱", "Santé": "💊", "Loisirs": "🎮",
  "Épargne": "💰", "Autres": "📦",
};

export default function BudgetAnalyzer() {
  const [step, setStep] = useState("input"); // input | result
  const [revenus, setRevenus] = useState("");
  const [inputMode, setInputMode] = useState("manual"); // manual | text
  const [manualExpenses, setManualExpenses] = useState([{ label: "", amount: "" }]);
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const addExpense = () => setManualExpenses([...manualExpenses, { label: "", amount: "" }]);
  const removeExpense = (i) => setManualExpenses(manualExpenses.filter((_, idx) => idx !== i));
  const updateExpense = (i, field, val) => {
    const updated = [...manualExpenses];
    updated[i][field] = val;
    setManualExpenses(updated);
  };

  function parseTextExpenses(text) {
    const lines = text.split("\n").filter(l => l.trim());
    const expenses = [];
    for (const line of lines) {
      const match = line.match(/(.+?)\s+(\d+([.,]\d+)?)\s*€?/);
      if (match) {
        expenses.push({ label: match[1].trim(), amount: match[2].replace(",", ".") });
      }
    }
    return expenses;
  }

  async function analyze() {
    setLoading(true);
    let expenses = inputMode === "manual"
      ? manualExpenses.filter(e => e.label && e.amount)
      : parseTextExpenses(rawText);

    const categorized = expenses.map(e => ({
      ...e,
      category: categorize(e.label),
      amount: parseFloat(e.amount),
    }));

    const totalDep = categorized.reduce((s, e) => s + e.amount, 0);
    const rev = parseFloat(revenus) || 0;

    const byCategory = {};
    for (const e of categorized) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    }

    const prompt = `Tu es un conseiller financier bienveillant et direct. Voici le budget mensuel d'un utilisateur :

Revenus : ${rev}€
Dépenses totales : ${totalDep.toFixed(2)}€
Solde restant : ${(rev - totalDep).toFixed(2)}€

Détail par catégorie :
${Object.entries(byCategory).map(([cat, amt]) => `- ${cat}: ${amt.toFixed(2)}€ (${((amt/rev)*100).toFixed(1)}% des revenus)`).join("\n")}

Dépenses détaillées :
${categorized.map(e => `- ${e.label}: ${e.amount}€`).join("\n")}

Génère une analyse complète en JSON avec cette structure exacte (sans backticks, juste du JSON pur) :
{
  "score": <nombre entre 0 et 100>,
  "scoreLabel": "<Excellent|Bien|Correct|À améliorer|Critique>",
  "resume": "<2-3 phrases résumant la situation financière>",
  "alertes": ["<alerte 1>", "<alerte 2>"],
  "conseils": ["<conseil actionnable 1>", "<conseil actionnable 2>", "<conseil actionnable 3>"],
  "economiesPossibles": <montant en euros qu'il pourrait économiser>,
  "pointsForts": ["<point fort 1>", "<point fort 2>"]
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
      const parsed = JSON.parse(clean);
      setAnalysis({ ...parsed, byCategory, categorized, totalDep, rev });
      setChatMessages([{ role: "assistant", content: `Bonjour ! J'ai analysé votre budget. Vous avez un score de **${parsed.score}/100** (${parsed.scoreLabel}). ${parsed.resume} Posez-moi vos questions !` }]);
      setStep("result");
    } catch (e) {
      alert("Erreur lors de l'analyse. Réessayez.");
    }
    setLoading(false);
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user", content: userMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    const context = `Budget analysé : revenus ${analysis.rev}€, dépenses ${analysis.totalDep.toFixed(2)}€, score ${analysis.score}/100. Catégories : ${Object.entries(analysis.byCategory).map(([k,v]) => `${k}: ${v.toFixed(2)}€`).join(", ")}.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `Tu es un conseiller financier personnel bienveillant. Contexte du budget de l'utilisateur : ${context} Réponds en français, de façon concise et actionnable.`,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.content.map(i => i.text || "").join("");
      setChatMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setChatMessages([...newMessages, { role: "assistant", content: "Désolé, une erreur s'est produite." }]);
    }
    setChatLoading(false);
  }

  const scoreColor = analysis ? (analysis.score >= 70 ? "#10b981" : analysis.score >= 40 ? "#f59e0b" : "#ef4444") : "#6366f1";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif", padding: "0" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #1a1a2e; } ::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 2px; }
        .card { background: #111118; border: 1px solid #1e1e2e; border-radius: 16px; }
        .btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 10px; padding: 12px 24px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(99,102,241,0.4); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .input { background: #1a1a2a; border: 1px solid #2a2a3e; border-radius: 10px; color: #e2e8f0; padding: 10px 14px; font-size: 14px; font-family: inherit; outline: none; transition: border 0.2s; width: 100%; }
        .input:focus { border-color: #6366f1; }
        .tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>

      {step === "input" && (
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "48px 20px" }} className="fade-up">
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, background: "linear-gradient(135deg, #6366f1, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>
              Budget IA
            </h1>
            <p style={{ color: "#64748b", fontSize: 15 }}>Analysez vos finances en 30 secondes grâce à l'intelligence artificielle</p>
          </div>

          {/* Revenus */}
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>💰 Revenus mensuels nets</label>
            <div style={{ position: "relative" }}>
              <input className="input" type="number" placeholder="2 500" value={revenus} onChange={e => setRevenus(e.target.value)} style={{ paddingRight: 36, fontSize: 18, fontWeight: 600 }} />
              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#6366f1", fontWeight: 700 }}>€</span>
            </div>
          </div>

          {/* Mode input */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["manual", "text"].map(mode => (
                <button key={mode} onClick={() => setInputMode(mode)} style={{ flex: 1, padding: "8px 16px", borderRadius: 8, border: `1px solid ${inputMode === mode ? "#6366f1" : "#2a2a3e"}`, background: inputMode === mode ? "rgba(99,102,241,0.15)" : "transparent", color: inputMode === mode ? "#a78bfa" : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all 0.2s" }}>
                  {mode === "manual" ? "✏️ Saisie manuelle" : "📋 Coller un relevé"}
                </button>
              ))}
            </div>

            {inputMode === "manual" ? (
              <div>
                <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 12 }}>📋 Mes dépenses</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {manualExpenses.map((exp, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input className="input" placeholder="Ex: Loyer, Netflix, Courses..." value={exp.label} onChange={e => updateExpense(i, "label", e.target.value)} style={{ flex: 2 }} />
                      <div style={{ position: "relative", flex: 1 }}>
                        <input className="input" type="number" placeholder="0" value={exp.amount} onChange={e => updateExpense(i, "amount", e.target.value)} style={{ paddingRight: 28 }} />
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#6366f1", fontSize: 13, fontWeight: 700 }}>€</span>
                      </div>
                      {manualExpenses.length > 1 && (
                        <button onClick={() => removeExpense(i)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: 8, width: 34, height: 34, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addExpense} style={{ background: "rgba(99,102,241,0.1)", border: "1px dashed #6366f1", color: "#a78bfa", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", width: "100%" }}>
                  + Ajouter une dépense
                </button>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>📄 Collez votre relevé (format: "Loyer 800€")</label>
                <textarea className="input" rows={8} placeholder={"Loyer 800\nNetflix 15.99\nCourses 250\nEssence 80\nRestaurants 120"} value={rawText} onChange={e => setRawText(e.target.value)} style={{ resize: "vertical" }} />
              </div>
            )}
          </div>

          <button className="btn-primary" onClick={analyze} disabled={loading || !revenus || (inputMode === "manual" ? !manualExpenses.some(e => e.label && e.amount) : !rawText.trim())} style={{ width: "100%", marginTop: 16, padding: "14px 24px", fontSize: 16 }}>
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block" }} className="spin" />
                Analyse en cours...
              </span>
            ) : "🔍 Analyser mon budget"}
          </button>
        </div>
      )}

      {step === "result" && analysis && (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }} className="fade-up">
          {/* Header result */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, background: "linear-gradient(135deg, #6366f1, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Votre rapport financier</h1>
              <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>Analysé par IA • {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <button onClick={() => setStep("input")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2a2a3e", color: "#94a3b8", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
              ← Nouvelle analyse
            </button>
          </div>

          {/* Score + résumé */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, marginBottom: 16 }}>
            <div className="card" style={{ padding: 24, textAlign: "center", minWidth: 140 }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: scoreColor, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>{analysis.score}</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>Score / 100</div>
              <div className="tag" style={{ marginTop: 10, background: `${scoreColor}20`, color: scoreColor }}>{analysis.scoreLabel}</div>
            </div>
            <div className="card" style={{ padding: 24 }}>
              <p style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: 14 }}>{analysis.resume}</p>
              <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
                <div><div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Revenus</div><div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{analysis.rev.toLocaleString("fr-FR")}€</div></div>
                <div><div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dépenses</div><div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{analysis.totalDep.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}€</div></div>
                <div><div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Solde</div><div style={{ fontSize: 18, fontWeight: 700, color: analysis.rev - analysis.totalDep >= 0 ? "#10b981" : "#ef4444" }}>{(analysis.rev - analysis.totalDep).toFixed(0)}€</div></div>
                <div><div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Économies possibles</div><div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>+{analysis.economiesPossibles}€</div></div>
              </div>
            </div>
          </div>

          {/* Catégories */}
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Répartition des dépenses</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(analysis.byCategory).sort(([,a],[,b]) => b-a).map(([cat, amt]) => {
                const pct = analysis.rev > 0 ? (amt / analysis.rev) * 100 : 0;
                const color = CAT_COLORS[cat] || "#94a3b8";
                return (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#cbd5e1" }}>{CAT_ICONS[cat]} {cat}</span>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#475569" }}>{pct.toFixed(1)}%</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color }}>{amt.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}€</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: "#1e1e2e", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct * 2, 100)}%`, background: color, borderRadius: 3, transition: "width 1s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alertes & Conseils */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>⚠️ Alertes</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analysis.alertes.map((a, i) => (
                  <div key={i} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }}>{a}</div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 13, color: "#10b981", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>✅ Points forts</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analysis.pointsForts.map((p, i) => (
                  <div key={i} style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#6ee7b7", lineHeight: 1.5 }}>{p}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, color: "#f59e0b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>💡 Conseils personnalisés</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {analysis.conseils.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i+1}</span>
                  <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>💬 Posez vos questions à votre conseiller IA</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14, maxHeight: 280, overflowY: "auto" }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "80%", background: m.role === "user" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#1a1a2a", border: m.role === "assistant" ? "1px solid #2a2a3e" : "none", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 14px", fontSize: 13, color: m.role === "user" ? "white" : "#cbd5e1", lineHeight: 1.6 }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", gap: 4, padding: "10px 14px", background: "#1a1a2a", borderRadius: "14px 14px 14px 4px", width: "fit-content", border: "1px solid #2a2a3e" }}>
                  {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, background: "#6366f1", borderRadius: "50%", animation: `pulse 1.2s ease ${i*0.2}s infinite` }} />)}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="Ex: Comment économiser 200€ par mois ?" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !chatLoading && sendChat()} style={{ flex: 1 }} />
              <button className="btn-primary" onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>Envoyer →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
