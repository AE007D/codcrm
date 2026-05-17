"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

type UserRole = "admin" | "agent" | "viewer";
type TeamUser = { id: string; name: string; email: string; role: UserRole; active: boolean; createdAt: string };
type CurrentUser = { id: string; name: string; email: string; role: UserRole; workspaceId: string };
type Product = { id: string; name: string; agentId?: string; agentName?: string; boutiqueNom?: string; commissionAmount?: number };

const roleBadge: Record<UserRole, { label: string; classes: string }> = {
  admin: { label: "Admin", classes: "bg-blue-100 text-blue-700" },
  agent: { label: "Agent", classes: "bg-emerald-100 text-emerald-700" },
  viewer: { label: "Viewer", classes: "bg-slate-100 text-slate-600" },
};

function UserInitial({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
  return (
    <div className={`w-9 h-9 rounded-xl ${colors[name.charCodeAt(0) % colors.length]} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
      {initials}
    </div>
  );
}

export default function EquipePage() {
  const [tab, setTab] = useState<"equipe" | "boutiques">("equipe");
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("agent");
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Products (shared)
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Agent → product assignment
  const [assignAgent, setAssignAgent] = useState<TeamUser | null>(null);
  const [agentAssignForm, setAgentAssignForm] = useState<Record<string, { checked: boolean; commissionAmount: string; boutiqueNom: string }>>({});
  const [agentAssignLoading, setAgentAssignLoading] = useState(false);
  const [agentAssignSaving, setAgentAssignSaving] = useState(false);

  // Boutiques
  const [boutiques, setBoutiques] = useState<string[]>([]);
  const [boutiquesLoading, setBoutiquesLoading] = useState(false);
  const [newBoutique, setNewBoutique] = useState("");
  const [addingBoutique, setAddingBoutique] = useState(false);
  const [boutiquesError, setBoutiquesError] = useState("");

  // Boutique → product assignment
  const [assignBoutique, setAssignBoutique] = useState<string | null>(null);
  const [boutiqueAssignForm, setBoutiqueAssignForm] = useState<Record<string, boolean>>({});
  const [boutiqueAssignLoading, setBoutiqueAssignLoading] = useState(false);
  const [boutiqueAssignSaving, setBoutiqueAssignSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/users");
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Impossible de charger l'équipe."); return; }
      setUsers((await res.json()).users ?? []);
    } catch { setError("Erreur réseau."); }
  }, []);

  const fetchBoutiques = useCallback(async () => {
    setBoutiquesLoading(true);
    try {
      const res = await fetch("/api/boutiques");
      if (res.ok) setBoutiques((await res.json()).boutiques ?? []);
    } finally { setBoutiquesLoading(false); }
  }, []);

  const fetchProducts = useCallback(async () => {
    const res = await fetch("/api/products");
    if (res.ok) setAllProducts((await res.json()).products ?? []);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.status === 401) { window.location.href = "/login"; return; }
        if (meRes.ok) setCurrentUser(await meRes.json());
        await Promise.all([fetchUsers(), fetchBoutiques(), fetchProducts()]);
      } finally { setLoading(false); }
    }
    init();
  }, [fetchUsers, fetchBoutiques, fetchProducts]);

  const isAdmin = currentUser?.role === "admin";

  // --- Agent product assignment ---
  async function openAgentAssign(agent: TeamUser) {
    setAssignAgent(agent);
    setAgentAssignLoading(true);
    try {
      const res = await fetch("/api/products");
      const products: Product[] = res.ok ? (await res.json()).products ?? [] : [];
      setAllProducts(products);
      const form: Record<string, { checked: boolean; commissionAmount: string; boutiqueNom: string }> = {};
      for (const p of products) {
        form[p.id] = {
          checked: p.agentId === agent.id,
          commissionAmount: p.commissionAmount ? String(p.commissionAmount) : "",
          boutiqueNom: p.boutiqueNom ?? "",
        };
      }
      setAgentAssignForm(form);
    } finally { setAgentAssignLoading(false); }
  }

  async function saveAgentAssign() {
    if (!assignAgent) return;
    setAgentAssignSaving(true);
    try {
      await Promise.all(allProducts.map(p => {
        const f = agentAssignForm[p.id];
        const wasAssigned = p.agentId === assignAgent.id;
        if (!f?.checked && !wasAssigned) return Promise.resolve();
        return fetch("/api/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: p.id,
            agentId: f?.checked ? assignAgent.id : "",
            agentName: f?.checked ? assignAgent.name : "",
            commissionAmount: f?.checked ? parseFloat(f.commissionAmount || "0") || 0 : 0,
            boutiqueNom: f?.boutiqueNom ?? p.boutiqueNom ?? "",
          }),
        });
      }));
      await fetchProducts();
      setAssignAgent(null);
    } finally { setAgentAssignSaving(false); }
  }

  // --- Boutique management ---
  async function addBoutique() {
    if (!newBoutique.trim()) return;
    setAddingBoutique(true);
    setBoutiquesError("");
    try {
      const res = await fetch("/api/boutiques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBoutique.trim() }),
      });
      if (res.ok) { setBoutiques((await res.json()).boutiques); setNewBoutique(""); }
    } catch { setBoutiquesError("Erreur réseau."); }
    finally { setAddingBoutique(false); }
  }

  async function deleteBoutique(name: string) {
    if (!confirm(`Supprimer la boutique "${name}" ?`)) return;
    const res = await fetch("/api/boutiques", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) setBoutiques((await res.json()).boutiques);
  }

  // --- Boutique → product assignment ---
  async function openBoutiqueAssign(boutique: string) {
    setAssignBoutique(boutique);
    setBoutiqueAssignLoading(true);
    try {
      const res = await fetch("/api/products");
      const products: Product[] = res.ok ? (await res.json()).products ?? [] : [];
      setAllProducts(products);
      const form: Record<string, boolean> = {};
      for (const p of products) form[p.id] = p.boutiqueNom === boutique;
      setBoutiqueAssignForm(form);
    } finally { setBoutiqueAssignLoading(false); }
  }

  async function saveBoutiqueAssign() {
    if (!assignBoutique) return;
    setBoutiqueAssignSaving(true);
    try {
      await Promise.all(allProducts.map(p => {
        const shouldBelong = boutiqueAssignForm[p.id];
        const belongsNow = p.boutiqueNom === assignBoutique;
        if (shouldBelong === belongsNow) return Promise.resolve();
        return fetch("/api/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: p.id, boutiqueNom: shouldBelong ? assignBoutique : "" }),
        });
      }));
      await fetchProducts();
      setAssignBoutique(null);
    } finally { setBoutiqueAssignSaving(false); }
  }

  // --- Team actions ---
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(""); setInviteLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: inviteName, email: inviteEmail, password: invitePassword, role: inviteRole, workspaceId: currentUser?.workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.error || "Erreur lors de la création."); return; }
      setShowInviteModal(false); setInviteName(""); setInviteEmail(""); setInvitePassword(""); setInviteRole("agent");
      await fetchUsers();
    } catch { setInviteError("Erreur réseau."); }
    finally { setInviteLoading(false); }
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    setActionLoading(userId + ":role");
    try { await fetch("/api/auth/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: userId, role }) }); await fetchUsers(); }
    finally { setActionLoading(null); }
  }

  async function handleToggleActive(user: TeamUser) {
    setActionLoading(user.id + ":active");
    try { await fetch("/api/auth/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, active: !user.active }) }); await fetchUsers(); }
    finally { setActionLoading(null); }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    setActionLoading(userId + ":delete");
    try { await fetch("/api/auth/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: userId }) }); await fetchUsers(); }
    finally { setActionLoading(null); }
  }

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Équipe & Boutiques</h1>
            <p className="text-sm text-slate-400">{users.filter(u => u.active).length} membre(s) · {boutiques.length} boutique(s)</p>
          </div>
          {isAdmin && tab === "equipe" && (
            <button onClick={() => setShowInviteModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors">
              + Inviter
            </button>
          )}
        </header>

        {/* Tabs */}
        <div className="bg-white border-b border-slate-100 px-4 lg:px-8 pl-14 lg:pl-8 flex gap-1">
          {(["equipe", "boutiques"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
              {t === "equipe" ? "Équipe" : "Boutiques"}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
          ) : tab === "equipe" ? (
            /* ── ÉQUIPE TAB ── */
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Membres de l&apos;équipe</h2>
              </div>
              {users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} className="w-6 h-6"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-400">Aucun membre</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Membre</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rôle</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                        {isAdmin && <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {users.map(u => {
                        const badge = roleBadge[u.role];
                        const isSelf = u.id === currentUser?.id;
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <UserInitial name={u.name} />
                                <div>
                                  <p className="font-semibold text-slate-800">{u.name}{isSelf && <span className="ml-2 text-xs text-slate-400 font-normal">(vous)</span>}</p>
                                  <p className="text-xs text-slate-400">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {isAdmin && !isSelf ? (
                                <select value={u.role} disabled={actionLoading === u.id + ":role"}
                                  onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                                  className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-400 cursor-pointer">
                                  <option value="admin">Admin</option>
                                  <option value="agent">Agent</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                              ) : (
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.classes}`}>{badge.label}</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                                {u.active ? "Actif" : "Inactif"}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  {(u.role === "agent" || u.role === "admin") && (
                                    <button onClick={() => openAgentAssign(u)}
                                      className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-medium transition-colors">
                                      Produits
                                    </button>
                                  )}
                                  {!isSelf && (
                                    <>
                                      <button onClick={() => handleToggleActive(u)} disabled={actionLoading === u.id + ":active"}
                                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 font-medium transition-colors disabled:opacity-50">
                                        {u.active ? "Désactiver" : "Activer"}
                                      </button>
                                      <button onClick={() => handleDelete(u.id)} disabled={actionLoading === u.id + ":delete"}
                                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 font-medium transition-colors disabled:opacity-50">
                                        Supprimer
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* ── BOUTIQUES TAB ── */
            <div className="flex flex-col gap-4">
              {/* Add boutique */}
              {isAdmin && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <p className="text-sm font-bold text-slate-900 mb-3">Ajouter une boutique</p>
                  {boutiquesError && <p className="text-xs text-red-500 mb-2">{boutiquesError}</p>}
                  <div className="flex gap-2">
                    <input type="text" placeholder="Ex: Layanpromo, Atlas Store…" value={newBoutique}
                      onChange={e => setNewBoutique(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addBoutique()}
                      className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                    <button onClick={addBoutique} disabled={addingBoutique || !newBoutique.trim()}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200 transition-colors">
                      {addingBoutique ? "…" : "+ Ajouter"}
                    </button>
                  </div>
                </div>
              )}

              {/* Boutiques list */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-base font-bold text-slate-900">Boutiques ({boutiques.length})</h2>
                </div>
                {boutiquesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : boutiques.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3 text-2xl">🏪</div>
                    <p className="text-sm font-semibold text-slate-400">Aucune boutique</p>
                    <p className="text-xs text-slate-400 mt-1">Ajoutez votre première boutique ci-dessus</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {boutiques.map(b => {
                      const productCount = allProducts.filter(p => p.boutiqueNom === b).length;
                      return (
                        <div key={b} className="px-6 py-4 flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                            {b.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{b}</p>
                            <p className="text-xs text-slate-400">{productCount} produit{productCount !== 1 ? "s" : ""}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => openBoutiqueAssign(b)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-medium transition-colors">
                              Produits
                            </button>
                            {isAdmin && (
                              <button onClick={() => deleteBoutique(b)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 font-medium transition-colors">
                                Supprimer
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Inviter un membre</h2>
              <button onClick={() => { setShowInviteModal(false); setInviteError(""); }} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {inviteError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{inviteError}</div>}
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              {[
                { label: "Nom complet", value: inviteName, set: setInviteName, type: "text", placeholder: "Prénom Nom" },
                { label: "Email", value: inviteEmail, set: setInviteEmail, type: "email", placeholder: "membre@email.ma" },
                { label: "Mot de passe", value: invitePassword, set: setInvitePassword, type: "password", placeholder: "••••••••" },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{f.label}</label>
                  <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} required minLength={f.type === "password" ? 6 : undefined}
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Rôle</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as UserRole)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 bg-white">
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex gap-3 mt-1">
                <button type="button" onClick={() => { setShowInviteModal(false); setInviteError(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
                <button type="submit" disabled={inviteLoading}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-blue-200">
                  {inviteLoading ? "Création..." : "Créer le compte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent → product panel */}
      {assignAgent && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Produits de {assignAgent.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Cochez les produits assignés à cet agent</p>
              </div>
              <button onClick={() => setAssignAgent(null)} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {agentAssignLoading ? (
                <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : allProducts.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-12">Aucun produit dans le catalogue.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {allProducts.map(p => {
                    const f = agentAssignForm[p.id] ?? { checked: false, commissionAmount: "", boutiqueNom: "" };
                    return (
                      <div key={p.id} className={`rounded-2xl border p-4 transition-colors ${f.checked ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-white"}`}>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={f.checked}
                            onChange={e => setAgentAssignForm(prev => ({ ...prev, [p.id]: { ...f, checked: e.target.checked } }))}
                            className="w-4 h-4 rounded accent-emerald-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 text-sm truncate">{p.name}</p>
                            {p.boutiqueNom && <p className="text-xs text-slate-400">{p.boutiqueNom}</p>}
                          </div>
                        </div>
                        {f.checked && (
                          <div className="mt-3 grid grid-cols-2 gap-2 pl-7">
                            <div>
                              <label className="text-xs font-semibold text-slate-500 mb-1 block">Boutique</label>
                              <select value={f.boutiqueNom}
                                onChange={e => setAgentAssignForm(prev => ({ ...prev, [p.id]: { ...f, boutiqueNom: e.target.value } }))}
                                className="w-full text-xs border border-emerald-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-400 bg-white">
                                <option value="">— Aucune —</option>
                                {boutiques.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-500 mb-1 block">Commission (MAD)</label>
                              <input type="number" placeholder="15" min="0" value={f.commissionAmount}
                                onChange={e => setAgentAssignForm(prev => ({ ...prev, [p.id]: { ...f, commissionAmount: e.target.value } }))}
                                className="w-full text-xs border border-emerald-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-400 bg-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setAssignAgent(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={saveAgentAssign} disabled={agentAssignSaving || agentAssignLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-emerald-200">
                {agentAssignSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Boutique → product panel */}
      {assignBoutique && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Produits — {assignBoutique}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Cochez les produits appartenant à cette boutique</p>
              </div>
              <button onClick={() => setAssignBoutique(null)} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {boutiqueAssignLoading ? (
                <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : allProducts.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-12">Aucun produit dans le catalogue.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {allProducts.map(p => (
                    <label key={p.id} className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${boutiqueAssignForm[p.id] ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-white hover:bg-slate-50/50"}`}>
                      <input type="checkbox" checked={!!boutiqueAssignForm[p.id]}
                        onChange={e => setBoutiqueAssignForm(prev => ({ ...prev, [p.id]: e.target.checked }))}
                        className="w-4 h-4 rounded accent-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{p.name}</p>
                        {p.agentName && <p className="text-xs text-slate-400">Agent: {p.agentName}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setAssignBoutique(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={saveBoutiqueAssign} disabled={boutiqueAssignSaving || boutiqueAssignLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-emerald-200">
                {boutiqueAssignSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
