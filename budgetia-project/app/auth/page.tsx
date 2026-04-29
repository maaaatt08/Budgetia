"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nom } }
      });
      if (error) setError(error.message);
      else setSuccess("Compte créé ! Vérifie ton email pour confirmer.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("Email ou mot de passe incorrect.");
      else router.push("/dashboard");
    }
    setLoading(false);
  }

  const s = {
    page: { minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif" },
    card: { background: "#111118", border: "1px solid #1e1e2e", borderRadius: 16, padding: 40, width: "100%", maxWidth: 420 },
    tabs: { display: "flex", background: "#1e1e2e", borderRadius: 10, padding: 4, marginBottom: 28 },
    tab: (active: boolean) => ({ flex: 1, padding: "10px 0", border: "none", cursor: "pointer", borderRadius: 8, fontWeight: 600, fontSize: 14, background: active ? "#7c3aed" : "transparent", color: active ? "white" : "#64748b" }),
    label: { display: "block", color: "#94a3b8", fontSize: 13, marginBottom: 6, fontWeight: 500 },
    input: { width: "100%", padding: "12px 16px", background: "#1e1e2e", border: "1px solid #2a2a3e", borderRadius: 10, color: "white", fontSize: 15, marginBottom: 16, boxSizing: "border-box" as const, outline: "none" },
    btn: { width: "100%", padding: "14px", background: "linear-gradient(135deg, #7c3aed, #6366f1)", border: "none", borderRadius: 10, color: "white", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 8 },
    error: { background: "#2d1515", border: "1px solid #ef4444", borderRadius: 8, padding: "12px 16px", color: "#ef4444", fontSize: 14, marginBottom: 16 },
    success: { background: "#0d2d1a", border: "1px solid #10b981", borderRadius: 8, padding: "12px 16px", color: "#10b981", fontSize: 14, marginBottom: 16 },
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, background: "#6366f1", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 700, color: "white" }}>B</div>
          <span style={{ fontWeight: 700, fontSize: 24, color: "white" }}>BudgetAI</span>
        </div>
        <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, marginBottom: 32 }}>Ton coach financier personnel powered by IA</p>

        <div style={s.tabs}>
          <button style={s.tab(mode === "login")} onClick={() => setMode("login")}>Connexion</button>
          <button style={s.tab(mode === "signup")} onClick={() => setMode("signup")}>Inscription</button>
        </div>

        {error && <div style={s.error}>⚠️ {error}</div>}
        {success && <div style={s.success}>✅ {success}</div>}

        {mode === "signup" && (
          <>
            <label style={s.label}>Prénom</label>
            <input style={s.input} placeholder="Matt" value={nom} onChange={e => setNom(e.target.value)} />
          </>
        )}

        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="matt@email.com" value={email} onChange={e => setEmail(e.target.value)} />

        <label style={s.label}>Mot de passe</label>
        <input style={s.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />

        <button style={s.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? "Chargement..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
      </div>
    </div>
  );
}
