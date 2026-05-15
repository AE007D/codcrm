"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

type UserRole = "admin" | "agent" | "viewer";

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
};

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

const roleBadge: Record<UserRole, { label: string; classes: string }> = {
  admin: { label: "Admin", classes: "bg-blue-100 text-blue-700" },
  agent: { label: "Agent", classes: "bg-emerald-100 text-emerald-700" },
  viewer: { label: "Viewer", classes: "bg-slate-100 text-slate-600" },
};

function UserInitial({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const colors = [
    "bg-blue-500",
    "bg-violet-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center text-white text-sm font-bold shrink-0`}
    >
      {initials}
    </div>
  );
}

export default function EquipePage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("agent");
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/users");
      if (res.status === 401) {
        // Session expirée — redirect to login
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Impossible de charger l'équipe.");
        return;
      }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setError("Erreur réseau.");
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.status === 401) { window.location.href = "/login"; return; }
        if (meRes.ok) setCurrentUser(await meRes.json());
        await fetchUsers();
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [fetchUsers]);

  const isAdmin = currentUser?.role === "admin";

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          password: invitePassword,
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Erreur lors de la création.");
        return;
      }
      setShowInviteModal(false);
      setInviteName("");
      setInviteEmail("");
      setInvitePassword("");
      setInviteRole("agent");
      await fetchUsers();
    } catch {
      setInviteError("Erreur réseau.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    setActionLoading(userId + ":role");
    try {
      await fetch("/api/auth/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role }),
      });
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleActive(user: TeamUser) {
    setActionLoading(user.id + ":active");
    try {
      await fetch("/api/auth/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, active: !user.active }),
      });
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    setActionLoading(userId + ":delete");
    try {
      await fetch("/api/auth/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId }),
      });
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F0F4FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 pl-14 lg:pl-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Équipe</h1>
            <p className="text-sm text-slate-400">
              {users.filter(u => u.active).length} membre(s) actif(s)
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-colors"
            >
              + Inviter
            </button>
          )}
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">
                  Membres de l&apos;équipe
                </h2>
              </div>

              {users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth={2}
                      className="w-6 h-6"
                    >
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-400">
                    Aucun membre
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Membre
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Rôle
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Statut
                        </th>
                        {isAdmin && (
                          <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {users.map(u => {
                        const badge = roleBadge[u.role];
                        const isSelf = u.id === currentUser?.id;
                        return (
                          <tr
                            key={u.id}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <UserInitial name={u.name} />
                                <div>
                                  <p className="font-semibold text-slate-800">
                                    {u.name}
                                    {isSelf && (
                                      <span className="ml-2 text-xs text-slate-400 font-normal">
                                        (vous)
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {u.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {isAdmin && !isSelf ? (
                                <select
                                  value={u.role}
                                  disabled={actionLoading === u.id + ":role"}
                                  onChange={e =>
                                    handleRoleChange(
                                      u.id,
                                      e.target.value as UserRole
                                    )
                                  }
                                  className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-400 cursor-pointer"
                                >
                                  <option value="admin">Admin</option>
                                  <option value="agent">Agent</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                              ) : (
                                <span
                                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.classes}`}
                                >
                                  {badge.label}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  u.active
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {u.active ? "Actif" : "Inactif"}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  {!isSelf && (
                                    <>
                                      <button
                                        onClick={() => handleToggleActive(u)}
                                        disabled={
                                          actionLoading === u.id + ":active"
                                        }
                                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
                                      >
                                        {u.active ? "Désactiver" : "Activer"}
                                      </button>
                                      <button
                                        onClick={() => handleDelete(u.id)}
                                        disabled={
                                          actionLoading === u.id + ":delete"
                                        }
                                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 font-medium transition-colors disabled:opacity-50"
                                      >
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
          )}
        </main>
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">
                Inviter un membre
              </h2>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteError("");
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="w-5 h-5"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {inviteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Prénom Nom"
                  required
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="membre@email.ma"
                  required
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={invitePassword}
                  onChange={e => setInvitePassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Rôle
                </label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as UserRole)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white"
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteError("");
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-blue-200 transition-colors"
                >
                  {inviteLoading ? "Création..." : "Créer le compte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
