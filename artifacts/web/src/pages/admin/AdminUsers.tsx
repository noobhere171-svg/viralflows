import { useState, useEffect } from "react";
import { Search, Edit2, Trash2, X, Lock, Unlock, UserPlus } from "lucide-react";
import api from "../../lib/api";

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: "", password: "", name: "" });
  const [loading, setLoading] = useState(true);

  const fetchUsers = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (planFilter) params.set("plan", planFilter);
    if (roleFilter) params.set("role", roleFilter);
    api.get(`/admin/users?${params}`).then((d) => { setUsers(d.users); setTotal(d.total); }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [page, planFilter, roleFilter]);

  const handleSearch = () => { setPage(1); fetchUsers(); };
  const handleUpdate = async (id: string, data: any) => {
    await api.patch(`/admin/users/${id}`, data);
    setEditing(null);
    fetchUsers();
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    await api.delete(`/admin/users/${id}`);
    fetchUsers();
  };
  const handleLock = async (id: string) => {
    if (!confirm("Lock this user? They won't be able to log in.")) return;
    await api.post(`/admin/users/${id}/lock`);
    fetchUsers();
  };
  const handleUnlock = async (id: string) => {
    await api.post(`/admin/users/${id}/unlock`);
    fetchUsers();
  };

  const handleCreateAdmin = async () => {
    if (!newAdmin.email || !newAdmin.password) { alert("Email and password required"); return; }
    if (newAdmin.password.length < 6) { alert("Password must be at least 6 characters"); return; }
    try {
      await api.post("/admin/create-admin", newAdmin);
      setShowCreateAdmin(false);
      setNewAdmin({ email: "", password: "", name: "" });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || "Failed to create admin");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <button onClick={() => setShowCreateAdmin(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
          <UserPlus size={16} /> Create Admin
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search email or name..." className="w-full pl-9 pr-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm" />
        </div>
        <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm">
          <option value="">All Plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="agency">Agency</option>
        </select>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm">
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={handleSearch} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">Search</button>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#2a2a2a] text-left">
            <th className="px-4 py-3 text-zinc-400 font-medium">Email</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Name</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">WhatsApp</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Plan</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Role</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Status</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Joined</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            : users.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">No users found</td></tr>
            : users.map((u) => (
              <tr key={u.id} className="border-b border-[#2a2a2a] hover:bg-white/5">
                <td className="px-4 py-3 text-white">{u.email}</td>
                <td className="px-4 py-3 text-zinc-300">{u.name || "-"}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{u.whatsappNumber || "-"}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${u.plan === "pro" ? "bg-violet-500/20 text-violet-400" : u.plan === "agency" ? "bg-orange-500/20 text-orange-400" : u.plan === "starter" ? "bg-blue-500/20 text-blue-400" : "bg-zinc-500/20 text-zinc-400"}`}>{u.plan}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${u.role === "admin" ? "bg-green-500/20 text-green-400" : "bg-zinc-500/20 text-zinc-400"}`}>{u.role}</span></td>
                <td className="px-4 py-3">
                  {u.isLocked ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 flex items-center gap-1 w-fit"><Lock size={12} /> Locked</span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => setEditing(u)} className="text-zinc-400 hover:text-white" title="Edit"><Edit2 size={14} /></button>
                  {u.isLocked ? (
                    <button onClick={() => handleUnlock(u.id)} className="text-green-400 hover:text-green-300" title="Unlock"><Unlock size={14} /></button>
                  ) : (
                    <button onClick={() => handleLock(u.id)} className="text-yellow-400 hover:text-yellow-300" title="Lock"><Lock size={14} /></button>
                  )}
                  <button onClick={() => handleDelete(u.id)} className="text-zinc-400 hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-sm text-zinc-400">
        <span>Total: {total} users</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white disabled:opacity-50">Prev</button>
          <span className="px-3 py-1">Page {page}</span>
          <button disabled={users.length < 20} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white disabled:opacity-50">Next</button>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Edit User: {editing.email}</h3>
              <button onClick={() => setEditing(null)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-zinc-400 text-sm">Plan</label>
                <select value={editing.plan} onChange={(e) => setEditing({ ...editing, plan: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm">
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="agency">Agency</option>
                </select>
              </div>
              <div>
                <label className="text-zinc-400 text-sm">Role</label>
                <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-zinc-400 text-sm">Name</label>
                <input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
              </div>
              <button onClick={() => handleUpdate(editing.id, { plan: editing.plan, role: editing.role, name: editing.name })}
                className="w-full py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateAdmin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreateAdmin(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Create Admin Account</h3>
              <button onClick={() => setShowCreateAdmin(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Admin Name" value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
              <input type="email" placeholder="Admin Email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
              <input type="password" placeholder="Admin Password (min 6 chars)" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
              <button onClick={handleCreateAdmin}
                className="w-full py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center justify-center gap-2">
                <UserPlus size={16} /> Create Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
