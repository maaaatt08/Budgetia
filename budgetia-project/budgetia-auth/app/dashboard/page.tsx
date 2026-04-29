"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const BudgetTracker = dynamic(() => import("../../components/budget-tracker"), { ssr: false });

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", background: "#111118", borderBottom: "1px solid #1e1e2e" }}>
        <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: 18 }}>💰 BudgetAI</span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#64748b", fontSize: 14 }}>👤 {user?.user_metadata?.nom || user?.email}</span>
          <button onClick={handleLogout} style={{ padding: "8px 16px", background: "#1e1e2e", border: "1px solid #2a2a3e", borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
            Déconnexion
          </button>
        </div>
      </div>
      <BudgetTracker />
    </div>
  );
}
