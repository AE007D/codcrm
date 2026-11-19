"use client";

import { useState } from "react";

type Agent = { id: string; name: string; active: boolean; role: string };

export default function ManualOrderAssignment({ orderIds, onAssigned }: {
  orderIds: string[]; onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function show() {
    setOpen(true);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/users", { cache: "no-store" });
      if (!response.ok) throw new Error("Impossible de charger l’équipe.");
      const data = await response.json();
      setAgents((data.users ?? []).filter((agent: Agent) => agent.active && agent.role !== "viewer"));
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function assign() {
    if (!agentId || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/orders/assign", { method: "PATCH",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderIds, agentId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Affectation impossible.");
      setMessage(`${data.count} commandes MAN affectées à ${data.assignment.agentName}.`);
      onAssigned();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
    <button type="button" onClick={() => open ? setOpen(false) : void show()} aria-expanded={open} className="font-semibold">Affecter les commandes MAN ({orderIds.length})</button>
    {open && <div className="mt-3 flex flex-wrap items-center gap-3">
      <label>Agent <select aria-label="Agent pour les commandes MAN" value={agentId} onChange={event => setAgentId(event.target.value)} disabled={busy} className="ml-2 rounded-lg border p-2">
        <option value="">Choisir un agent</option>
        {agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
      </select></label>
      <button type="button" onClick={() => void assign()} disabled={busy || !agentId || !orderIds.length} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Chargement…" : `Affecter ${orderIds.length} commandes MAN`}</button>
      <p className="w-full text-xs">Seules les commandes MAN actuellement listées seront réaffectées.</p>
    </div>}
    {message && <p role="status" className="mt-2">{message}</p>}
  </div>;
}
