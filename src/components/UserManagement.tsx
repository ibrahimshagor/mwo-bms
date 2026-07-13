import { useState, FormEvent } from 'react';
import { User, UserRole } from '../types';
import * as XLSX from 'xlsx';
import { Users, UserPlus, ShieldAlert, KeyRound, Edit2, Trash2, CheckCircle, Download } from 'lucide-react';

interface UserManagementProps {
  users: User[];
  onSaveUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onResetPassword: (userId: string, newPass: string) => void;
}

export default function UserManagement({
  users,
  onSaveUser,
  onDeleteUser,
  onResetPassword
}: UserManagementProps) {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form states
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('FieldAdmin');
  const [password, setPassword] = useState('');

  // Password reset modal helper
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [passChangeSuccess, setPassChangeSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleExportUsers = () => {
    try {
      const dataToExport = users.map(u => ({
        "Security Login Username ID": u.id,
        "Profile Display Name": u.name,
        "Assigned Security Access Role": u.role,
        "Access Level Privileges": u.role === 'SuperAdmin' ? 'Level 1 - Universal Control' : u.role === 'FieldAdmin' ? 'Level 2 - Biometric Registrar' : 'Level 3 - Donor View'
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "System Users");
      XLSX.writeFile(workbook, `MWO_Users_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      alert("Failed to export users registry: " + err.message);
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setUserId('');
    setName('');
    setRole('FieldAdmin');
    setPassword('');
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setUserId(user.id);
    setName(user.name);
    setRole(user.role);
    setPassword(''); // don't expose current password
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!userId.trim()) { setFormError('Unique User ID is required.'); return; }
    if (!name.trim()) { setFormError('Profile username is required.'); return; }

    // Save
    onSaveUser({
      id: userId.trim(),
      name: name.trim(),
      role,
      password: password ? password : undefined 
    });

    resetForm();
  };

  const triggerPasswordChange = (e: FormEvent) => {
    e.preventDefault();
    if (!resettingUserId || !newPasswordValue.trim()) return;

    onResetPassword(resettingUserId, newPasswordValue.trim());
    setPassChangeSuccess(true);
    setNewPasswordValue('');
    setTimeout(() => {
      setResettingUserId(null);
      setPassChangeSuccess(false);
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User Registration Form Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-fit">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-150 mb-4 uppercase tracking-wider">
            <UserPlus className="w-4.5 h-4.5 text-emerald-600 animate-pulse" />
            {editingUser ? 'Update Account details' : 'Register New System Account'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold p-2.5 rounded-xl flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-250">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-[9px] shrink-0">&times;</span>
                <span className="flex-1">{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1 tracking-wider uppercase">
                Account Type / Security Role <span className="text-red-500">*</span>
              </label>
              <select
                disabled={!!editingUser}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
              >
                <option value="SuperAdmin">Super Admin (Universal rights)</option>
                <option value="FieldAdmin">Field Admin / Field Staff</option>
                <option value="Donor">Donor (Viewer Portal)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1 tracking-wider uppercase">
                Unique Login User ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!!editingUser}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. shagor_admin"
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-mono disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1 tracking-wider uppercase">
                Profile Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Md. Ibrahim Hossain"
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            {!editingUser && (
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1 tracking-wider uppercase">
                  Login Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {editingUser && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-1/2 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className={`flex-grow bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer`}
              >
                {editingUser ? 'Save Account Changes' : 'Create System Account'}
              </button>
            </div>
          </form>
        </div>

        {/* User Directory Table Grid */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center pb-3 border-b border-slate-150 mb-4 w-full gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
              <Users className="w-4.5 h-4.5 text-slate-500" />
              System Accounts Records Directory ({users.length})
            </h3>
            <button
              onClick={handleExportUsers}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-205 font-bold text-[11px] py-1 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-xs"
              title="Export all system users to Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              Export Excel (.xlsx)
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                  <th className="p-3">User ID</th>
                  <th className="p-3">Display Name</th>
                  <th className="p-3">System Role</th>
                  <th className="p-3 text-right">Management</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-slate-800 select-all">{u.id}</td>
                    <td className="p-3 font-semibold text-slate-700">{u.name}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] ${
                        u.role === 'SuperAdmin'
                          ? 'bg-red-50 text-red-700 border border-red-150'
                          : u.role === 'FieldAdmin'
                          ? 'bg-sky-50 text-sky-700 border border-sky-150'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                      }`}>
                        {u.role === 'SuperAdmin' ? 'Super Admin' : u.role === 'FieldAdmin' ? 'Field Staff' : 'Guest Donor'}
                      </span>
                    </td>
                    <td className="p-3 text-right flex justify-end gap-1.5">
                      <button
                        onClick={() => handleEdit(u)}
                        className="text-slate-500 hover:text-emerald-600 border border-slate-200 p-1.5 rounded hover:bg-slate-50 cursor-pointer"
                        title="Edit profile"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setResettingUserId(u.id); setNewPasswordValue(''); }}
                        className="text-slate-500 hover:text-amber-600 border border-slate-200 p-1.5 rounded hover:bg-slate-50 cursor-pointer"
                        title="Override Password"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      {/* Prevent self delete */}
                      {u.id !== 'admin' && (
                        <button
                          onClick={() => {
                            if (confirm(`Are you absolutely sure you want to completely delete account ID "${u.id}"?`)) {
                              onDeleteUser(u.id);
                            }
                          }}
                          className="text-slate-500 hover:text-red-600 border border-slate-200 p-1.5 rounded hover:bg-slate-50 cursor-pointer"
                          title="Delete Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Password Reset Modal Overlay */}
      {resettingUserId && (
        <div className="bg-slate-900/40 backdrop-blur-sm fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xs w-full p-6 relative">
            <button
              onClick={() => setResettingUserId(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold border border-slate-200 rounded-full w-6 h-6 flex items-center justify-center cursor-pointer"
            >
              &times;
            </button>

            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1 mb-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Administrative Overrides
            </h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Reset login security password for user account ID: <code className="font-mono font-bold text-slate-900 bg-slate-100 px-1 rounded text-[10px]">{resettingUserId}</code>
            </p>

            {passChangeSuccess ? (
              <div className="border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-1.5 justify-center py-5">
                <CheckCircle className="w-4 h-4 text-emerald-600 animate-bounce" />
                Password override saved!
              </div>
            ) : (
              <form onSubmit={triggerPasswordChange} className="space-y-3">
                <input
                  type="password"
                  required
                  placeholder="Enter override password"
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Confirm Password Override
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
