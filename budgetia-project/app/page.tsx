"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

const BudgetTracker = dynamic(() => import("../components/budget-tracker"), { ssr: false });
const BudgetAnalyzer = dynamic(() => import("../components/budget-analyzer"), { ssr: false });

export default function Home() {
  const [tab, setTab] = useState<"tracker" | "analyzer">("tracker");

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0f" }}>
      <div style={{
        display: "flex", gap: 8, padding: "16px 24px",
        background: "#111118", borderBottom: "1px solid #1e1e2e"
      }}>
        <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: 18, marginRight: 16 }}>💰 BudgetIA</span>
        {["tracker", "analyzer"].map(t => (
          <button key={t} onClick={() => setTab(t as any)} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            background: tab === t ? "#7c3aed" : "#1e1e2e",
            color: tab === t ? "white" : "#94a3b8", fontWeight: 600, fontSize: 14
          }}>
            {t === "tracker" ? "📊 Tableau de bord" : "🔍 Analyser"}
          </button>
        ))}
      </div>
      {tab === "tracker" ? <BudgetTracker /> : <BudgetAnalyzer />}
    </main>
  );
}
