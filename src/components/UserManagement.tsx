import { useState, FormEvent, useEffect } from 'react';
import { User, UserRole, UserPermissions } from '../types';
import * as XLSX from 'xlsx';
import { Users, UserPlus, ShieldAlert, KeyRound, Edit2, Trash2, CheckCircle, Download, Boxes, Check } from 'lucide-react';

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

  // Granular Permissions
  const [permissions, setPermissions] = useState<UserPermissions>({
    canManageInventory: false,
    canAddInventoryItems: false,
    canCreatePackages: false,
    canAssemblePackages: false,
    canDisassemblePackages: false,
    canDistributePackages: true,
    canManagePrograms: false,
    canManageBeneficiaries: true,
  });

  // Auto-set recommended permissions when role changes in create mode
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (!editingUser) {
      if (newRole === 'SuperAdmin') {
        setPermissions({
          canManageInventory: true,
          canAddInventoryItems: true,
          canCreatePackages: true,
          canAssemblePackages: true,
          canDisassemblePackages: true,
          canDistributePackages: true,
          canManagePrograms: true,
          canManageBeneficiaries: true,
        });
      } else if (newRole === 'InventoryManager') {
        setPermissions({
          canManageInventory: true,
          canAddInventoryItems: true,
          canCreatePackages: true,
          canAssemblePackages: true,
          canDisassemblePackages: true,
          canDistributePackages: false,
          canManagePrograms: false,
          canManageBeneficiaries: false,
        });
      } else if (newRole === 'FieldAdmin') {
        setPermissions({
          canManageInventory: true,
          canAddInventoryItems: true,
          canCreatePackages: false,
          canAssemblePackages: true,
          canDisassemblePackages: false,
          canDistributePackages: true,
          canManagePrograms: false,
          canManageBeneficiaries: true,
        });
      } else {
        setPermissions({
          canManageInventory: false,
          canAddInventoryItems: false,
          canCreatePackages: false,
          canAssemblePackages: false,
          canDisassemblePackages: false,
          canDistributePackages: false,
          canManagePrograms: false,
          canManageBeneficiaries: false,
        });
      }
    }
  };

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
        "Access Level Privileges": u.role === 'SuperAdmin' ? 'Level 1 - Universal Control' : u.role === 'InventoryManager' ? 'Level 2 - Inventory & Store Control' : u.role === 'FieldAdmin' ? 'Level 2 - Biometric Registrar' : 'Level 3 - Donor View',
        "Inventory Access": u.permissions?.canManageInventory ? 'Yes' : 'No',
        "Can Assemble Packages": u.permissions?.canAssemblePackages ? 'Yes' : 'No'
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
    setPermissions({
      canManageInventory: true,
      canAddInventoryItems: true,
      canCreatePackages: false,
      canAssemblePackages: true,
      canDisassemblePackages: false,
      canDistributePackages: true,
      canManagePrograms: false,
      canManageBeneficiaries: true,
    });
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setUserId(user.id);
    setName(user.name);
    setRole(user.role);
    setPassword(''); // don't expose current password
    setPermissions(user.permissions || {
      canManageInventory: user.role === 'SuperAdmin' || user.role === 'InventoryManager',
      canAddInventoryItems: user.role === 'SuperAdmin' || user.role === 'InventoryManager',
      canCreatePackages: user.role === 'SuperAdmin' || user.role === 'InventoryManager',
      canAssemblePackages: user.role === 'SuperAdmin' || user.role === 'InventoryManager',
      canDisassemblePackages: user.role === 'SuperAdmin' || user.role === 'InventoryManager',
      canDistributePackages: user.role !== 'Donor',
      canManagePrograms: user.role === 'SuperAdmin',
      canManageBeneficiaries: user.role !== 'Donor',
    });
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
      password: password ? password : undefined,
      permissions
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User Registration Form Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm h-fit">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-150 mb-4 uppercase tracking-wider">
            <UserPlus className="w-4.5 h-4.5 text-emerald-600 animate-pulse" />
            {editingUser ? 'Update Account & Permissions' : 'Register New System Account'}
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
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none bg-slate-50 cursor-pointer"
              >
                <option value="SuperAdmin">Super Admin (সার্বিক ক্ষমতা)</option>
                <option value="InventoryManager">Inventory Manager (ইনভেন্টরি ও স্টোর কিপার)</option>
                <option value="FieldAdmin">Field Admin / Field Staff (মাঠ কর্মকর্তা)</option>
                <option value="Donor">Donor (দাতা পোর্টাল)</option>
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
                placeholder="যেমন: store_tareq"
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-mono disabled:bg-slate-100"
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
                placeholder="যেমন: Tareq Rahman"
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
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
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            )}

            {/* Granular Permission Assignment for this user */}
            <div className="pt-2 border-t border-slate-200">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block mb-2 flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5" />
                ইনভেন্টরি ও কার্যক্ষমতা অনুমোদন (Permissions):
              </span>

              <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={permissions.canManageInventory ?? false}
                    onChange={(e) => setPermissions({ ...permissions, canManageInventory: e.target.checked })}
                    className="w-3.5 h-3.5 text-amber-600 rounded accent-amber-600 cursor-pointer"
                  />
                  <span className="font-bold text-slate-800">ইনভেন্টরি মেনু অ্যাক্সেস</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={permissions.canAddInventoryItems ?? false}
                    onChange={(e) => setPermissions({ ...permissions, canAddInventoryItems: e.target.checked })}
                    className="w-3.5 h-3.5 text-amber-600 rounded accent-amber-600 cursor-pointer"
                  />
                  <span className="text-slate-700">মালামাল এন্ট্রি ও স্টক ইন</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={permissions.canCreatePackages ?? false}
                    onChange={(e) => setPermissions({ ...permissions, canCreatePackages: e.target.checked })}
                    className="w-3.5 h-3.5 text-amber-600 rounded accent-amber-600 cursor-pointer"
                  />
                  <span className="text-slate-700">প্যাকেজ রেসিপি ও বান্ডেল ডিজাইন</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={permissions.canAssemblePackages ?? false}
                    onChange={(e) => setPermissions({ ...permissions, canAssemblePackages: e.target.checked })}
                    className="w-3.5 h-3.5 text-amber-600 rounded accent-amber-600 cursor-pointer"
                  />
                  <span className="text-slate-700">প্যাকেজ প্রস্তুত ও অ্যাসেম্বল (Packing)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={permissions.canDisassemblePackages ?? false}
                    onChange={(e) => setPermissions({ ...permissions, canDisassemblePackages: e.target.checked })}
                    className="w-3.5 h-3.5 text-amber-600 rounded accent-amber-600 cursor-pointer"
                  />
                  <span className="text-slate-700">প্যাকেজ আনপ্যাক করে স্টোরে ফেরত</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none pt-1 border-t border-slate-200">
                  <input
                    type="checkbox"
                    checked={permissions.canDistributePackages ?? false}
                    onChange={(e) => setPermissions({ ...permissions, canDistributePackages: e.target.checked })}
                    className="w-3.5 h-3.5 text-emerald-600 rounded accent-emerald-600 cursor-pointer"
                  />
                  <span className="text-slate-700">বিতরণ ডেস্কে প্যাক হস্তান্তর</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              {editingUser && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-1/2 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className={`flex-grow bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm`}
              >
                {editingUser ? 'Save Account Changes' : 'Create System Account'}
              </button>
            </div>
          </form>
        </div>

        {/* User Directory Table Grid */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center pb-3 border-b border-slate-150 mb-4 w-full gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
              <Users className="w-4.5 h-4.5 text-slate-500" />
              System Accounts & Permissions Registry ({users.length})
            </h3>
            <button
              onClick={handleExportUsers}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-205 font-bold text-[11px] py-1.5 px-3 rounded-xl flex items-center gap-1 cursor-pointer transition shadow-xs"
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
                  <th className="p-3">ইনভেন্টরি ক্ষমতা</th>
                  <th className="p-3 text-right">Management</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const hasInv = u.role === 'SuperAdmin' || u.role === 'InventoryManager' || u.permissions?.canManageInventory;
                  const canPack = u.role === 'SuperAdmin' || u.permissions?.canAssemblePackages;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-bold text-slate-800 select-all">{u.id}</td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-800">{u.name}</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          u.role === 'SuperAdmin'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : u.role === 'InventoryManager'
                            ? 'bg-amber-50 text-amber-800 border border-amber-300 font-black'
                            : u.role === 'FieldAdmin'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {u.role === 'SuperAdmin' ? 'Super Admin' : u.role === 'InventoryManager' ? '📦 ইনভেন্টরি ম্যানেজার' : u.role === 'FieldAdmin' ? 'Field Staff' : 'Guest Donor'}
                        </span>
                      </td>
                      <td className="p-3">
                        {hasInv ? (
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                              ✓ ইনভেন্টরি অ্যাক্সেস
                            </span>
                            {canPack && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                                + প্যাকিং
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">সীমাবদ্ধ</span>
                        )}
                      </td>
                      <td className="p-3 text-right flex justify-end gap-1.5">
                        <button
                          onClick={() => handleEdit(u)}
                          className="text-slate-500 hover:text-emerald-600 border border-slate-200 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                          title="Edit profile & permissions"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setResettingUserId(u.id); setNewPasswordValue(''); }}
                          className="text-slate-500 hover:text-amber-600 border border-slate-200 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
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
                            className="text-slate-500 hover:text-red-600 border border-slate-200 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                            title="Delete Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Password Reset Modal Overlay */}
      {resettingUserId && (
        <div className="bg-slate-900/40 backdrop-blur-sm fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-xs w-full p-6 relative">
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
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
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

