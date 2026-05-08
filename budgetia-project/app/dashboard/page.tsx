"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const BudgetTracker = dynamic(() => import("../../components/budget-tracker"), { ssr: false });

const STRIPE_LINK = "https://buy.stripe.com/test_cNil4n0aC7dab000Ca9b000";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/auth");
      else { setUser(session.user); setLoading(false); }
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa", fontSize: 18 }}>
      Chargement...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", height: 56, background: "#111118", borderBottom: "1px solid #1e1e2e", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#6366f1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: "white" }}>B</div>
          <span style={{ fontWeight: 700, fontSize: 18, color: "white" }}>BudgetAI</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["dashboard", "add"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "6px 14px", fontSize: 13, borderRadius: 8, border: "1px solid", borderColor: view === v ? "#6366f1" : "#1e1e2e", background: view === v ? "rgba(99,102,241,0.1)" : "#1e1e2e", color: view === v ? "#a78bfa" : "#64748b", cursor: "pointer", fontWeight: 600 }}>
              {v === "dashboard" ? "📊 Tableau de bord" : "+ Nouveau mois"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href={STRIPE_LINK} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 16px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            ⚡ S'abonner — 4,99€/mois
          </a>
          <span style={{ color: "#64748b", fontSize: 13 }}>👤 {user?.user_metadata?.nom || user?.email}</span>
          <button onClick={handleLogout} style={{ padding: "7px 14px", background: "#1e1e2e", border: "1px solid #2a2a3e", borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            Déconnexion
          </button>
        </div>
      </div>
      <BudgetTracker view={view} setView={setView} />
    </div>
  );
}
