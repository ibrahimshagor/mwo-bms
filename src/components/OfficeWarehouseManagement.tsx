import React, { useState } from 'react';
import { OfficeWarehouse, FacilityType, Program, User } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { 
  Building2, Warehouse, MapPin, Phone, User as UserIcon, Plus, 
  Edit3, Trash2, Boxes, Package, ArrowRight, Check, Search, 
  ExternalLink, Layers, ClipboardList, ShieldAlert
} from 'lucide-react';

interface OfficeWarehouseManagementProps {
  facilities: OfficeWarehouse[];
  programs: Program[];
  currentUser: User;
  onSaveFacility: (facility: OfficeWarehouse) => void;
  onDeleteFacility: (facilityId: string) => void;
  onNavigateToInventory: (programId?: string, warehouseName?: string) => void;
  onNavigateToProgramDesk: (programId: string) => void;
}

export default function OfficeWarehouseManagement({
  facilities,
  programs,
  currentUser,
  onSaveFacility,
  onDeleteFacility,
  onNavigateToInventory,
  onNavigateToProgramDesk
}: OfficeWarehouseManagementProps) {
  const { isEn } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | FacilityType>('ALL');
  const [selectedFacilityDetails, setSelectedFacilityDetails] = useState<OfficeWarehouse | null>(null);

  // Modal states for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<OfficeWarehouse | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<FacilityType>('Office & Warehouse');
  const [formAddress, setFormAddress] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = currentUser.role === 'SuperAdmin' || currentUser.role === 'InventoryManager' || currentUser.permissions?.canManageInventory;

  const openCreateModal = () => {
    setEditingFacility(null);
    setFormName('');
    setFormType('Office & Warehouse');
    setFormAddress('');
    setFormContact('');
    setFormPhone('');
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (fac: OfficeWarehouse) => {
    setEditingFacility(fac);
    setFormName(fac.name);
    setFormType(fac.type);
    setFormAddress(fac.address || '');
    setFormContact(fac.contactPerson || '');
    setFormPhone(fac.phone || '');
    setFormNotes(fac.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError(isEn ? 'Please enter a valid office or warehouse name.' : 'অনুগ্রহ করে অফিস বা গুদামের সঠিক নাম দিন।');
      return;
    }

    // Check duplicate name
    const isDup = facilities.some(f => 
      f.name.toLowerCase() === trimmedName.toLowerCase() && 
      (!editingFacility || f.id !== editingFacility.id)
    );
    if (isDup) {
      setFormError(isEn ? `An office/warehouse named "${trimmedName}" already exists!` : `"${trimmedName}" নামে ইতিমধ্যে একটি অফিস বা গুদাম রয়েছে!`);
      return;
    }

    const facilityData: OfficeWarehouse = {
      id: editingFacility ? editingFacility.id : `FAC-${Date.now().toString().slice(-4)}`,
      name: trimmedName,
      type: formType,
      address: formAddress.trim(),
      contactPerson: formContact.trim(),
      phone: formPhone.trim(),
      notes: formNotes.trim(),
      createdAt: editingFacility ? editingFacility.createdAt : new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString()
    };

    onSaveFacility(facilityData);
    setIsModalOpen(false);

    // If active details facility is the one updated, sync it
    if (selectedFacilityDetails && selectedFacilityDetails.id === facilityData.id) {
      setSelectedFacilityDetails(facilityData);
    }
  };

  const handleDelete = (fac: OfficeWarehouse) => {
    // Check if any program uses this facility
    const linkedProgs = programs.filter(p => p.warehouses?.includes(fac.name));
    let warnMsg = isEn ? `Are you sure you want to delete "${fac.name}"?` : `আপনি কি নিশ্চিতভাবে "${fac.name}" মুছে ফেলতে চান?`;
    if (linkedProgs.length > 0) {
      warnMsg = isEn 
        ? `Warning: "${fac.name}" is currently linked to ${linkedProgs.length} programs! Are you sure you want to delete?`
        : `সতর্কতা: "${fac.name}" বর্তমানে ${linkedProgs.length} টি প্রোগ্রামের সাথে যুক্ত রয়েছে! মুছে ফেললে এই গুদাম থেকে প্রোগ্রামগুলোর হিসাব বাদ হয়ে যাবে। আপনি কি নিশ্চিত?`;
    }
    if (window.confirm(warnMsg)) {
      onDeleteFacility(fac.id);
      if (selectedFacilityDetails?.id === fac.id) {
        setSelectedFacilityDetails(null);
      }
    }
  };

  // Filter facilities
  const filteredFacilities = facilities.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.address && f.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.contactPerson && f.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedTypeFilter === 'ALL' || f.type === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  // Calculate stats
  const totalCount = facilities.length;
  const warehouseCount = facilities.filter(f => f.type === 'Warehouse').length;
  const officeCount = facilities.filter(f => f.type === 'Office').length;
  const combinedCount = facilities.filter(f => f.type === 'Office & Warehouse').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-lg border border-slate-700/60 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold font-mono">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>OFFICE &amp; WAREHOUSE CONTROL CENTER</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-display tracking-tight text-white">
              গুদাম ও শাখা অফিস ব্যবস্থাপনা
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">
              আপনার সংস্থার সকল শাখা অফিস, কেন্দ্রীয় গুদাম ও স্টোরেজ ডিপো পরিচালনা করুন। প্রতিটি গুদাম ও অফিসের অধীনে পরিচালিত রিলিফ প্রোগ্রামসমূহ এবং মজুত পণ্য ও প্যাকেজের হিসাব আলাদাভাবে পর্যবেক্ষণ করুন।
            </p>
          </div>

          {canManage && (
            <button
              onClick={openCreateModal}
              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs md:text-sm font-bold px-5 py-3 rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer shadow-md shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন অফিস/গুদাম তৈরি করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">মোট প্রতিষ্ঠান</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{totalCount} টি</div>
          <p className="text-[11px] text-slate-400 mt-0.5">নিবন্ধিত অফিস ও গুদাম</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">শুধু গুদাম / ওয়্যারহাউস</span>
            <Warehouse className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-900 font-mono">{warehouseCount} টি</div>
          <p className="text-[11px] text-amber-700/80 mt-0.5">স্টোরেজ ও বিতরণ ডিপো</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">শাখা ও প্রধান অফিস</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-900 font-mono">{officeCount} টি</div>
          <p className="text-[11px] text-blue-700/80 mt-0.5">প্রশাসনিক কার্যালয়</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">অফিস ও গুদাম (উভয়ই)</span>
            <Layers className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-900 font-mono">{combinedCount} টি</div>
          <p className="text-[11px] text-emerald-700/80 mt-0.5">অফিস ও স্টোরেজ সমন্বিত</p>
        </div>
      </div>

      {/* 3. Search & Type Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="অফিস বা গুদামের নাম, ঠিকানা খুঁজুন..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          {[
            { key: 'ALL' as const, label: 'সকল (All)' },
            { key: 'Warehouse' as const, label: '🏭 শুধু গুদাম' },
            { key: 'Office' as const, label: '🏢 শুধু অফিস' },
            { key: 'Office & Warehouse' as const, label: '🏛️ অফিস ও গুদাম' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTypeFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedTypeFilter === tab.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Main Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredFacilities.map(fac => {
          const linkedPrograms = programs.filter(p => p.warehouses?.includes(fac.name));
          
          // Calculate total inventory items & packages across linked programs for this warehouse
          let totalWarehousePacks = 0;
          linkedPrograms.forEach(p => {
            (p.inventoryPackages || []).forEach(pkg => {
              if (pkg.warehouseAssembled && pkg.warehouseAssembled[fac.name]) {
                totalWarehousePacks += pkg.warehouseAssembled[fac.name];
              }
            });
          });

          return (
            <div 
              key={fac.id}
              className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 shadow-2xs hover:shadow-md transition duration-200 flex flex-col justify-between group"
            >
              <div>
                {/* Header: Type Badge & Actions */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase tracking-wider ${
                    fac.type === 'Warehouse' 
                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : fac.type === 'Office'
                      ? 'bg-blue-100 text-blue-900 border border-blue-200'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  }`}>
                    {fac.type === 'Warehouse' && <Warehouse className="w-3 h-3 text-amber-700" />}
                    {fac.type === 'Office' && <Building2 className="w-3 h-3 text-blue-700" />}
                    {fac.type === 'Office & Warehouse' && <Layers className="w-3 h-3 text-emerald-700" />}
                    <span>{fac.type === 'Warehouse' ? 'গুদাম' : fac.type === 'Office' ? 'অফিস' : 'অফিস ও গুদাম'}</span>
                  </span>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(fac)}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                        title="এডিট করুন"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(fac)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Facility Name */}
                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition leading-snug mb-1">
                  📍 {fac.name}
                </h3>

                {/* Address */}
                {fac.address && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{fac.address}</span>
                  </p>
                )}

                {/* Contact details */}
                {(fac.contactPerson || fac.phone) && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-3 text-[11px] text-slate-600 space-y-1">
                    {fac.contactPerson && (
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>দায়িত্বপ্রাপ্ত: <strong className="text-slate-800">{fac.contactPerson}</strong></span>
                      </div>
                    )}
                    {fac.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono text-slate-700">{fac.phone}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Linked Programs Summary */}
                <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-3 mb-4 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                      <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
                      <span>সংযুক্ত প্রোগ্রাম:</span>
                    </span>
                    <span className="font-mono font-black text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 text-xs">
                      {linkedPrograms.length} টি
                    </span>
                  </div>

                  {linkedPrograms.length > 0 && (
                    <div className="text-[10.5px] text-emerald-800 line-clamp-1 pt-0.5">
                      {linkedPrograms.map(p => p.name).join(' • ')}
                    </div>
                  )}

                  {totalWarehousePacks > 0 && (
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-200/60 font-semibold text-emerald-900">
                      <span>এই গুদামে প্রস্তুতকৃত প্যাকেজ:</span>
                      <strong className="font-mono font-bold text-amber-700">{totalWarehousePacks} টি</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => setSelectedFacilityDetails(fac)}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>হিসাব ও প্রোগ্রাম তালিকা</span>
                </button>
              </div>
            </div>
          );
        })}

        {filteredFacilities.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white border-2 border-dashed border-slate-200 rounded-3xl">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">কোনো অফিস বা গুদাম পাওয়া যায়নি</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              আপনার ফিল্টারের সাথে মিলে এমন কোনো ফলাফল নেই, অথবা এখনও কোনো অফিস/গুদাম যুক্ত করা হয়নি।
            </p>
            {canManage && (
              <button
                onClick={openCreateModal}
                className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>নতুন অফিস বা গুদাম তৈরি করুন</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 5. MODAL: CREATE / EDIT OFFICE & WAREHOUSE                            */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <span>{editingFacility ? 'অফিস / গুদাম তথ্য এডিট করুন' : 'নতুন অফিস / গুদাম তৈরি করুন'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  প্রতিষ্ঠানের নাম, ধরণ এবং যোগাযোগের তথ্য নির্ধারণ করুন
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer transition text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                  <span>&times;</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  অফিস বা গুদামের নাম (Name) *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="যেমন: ময়মনসিংহ প্রধান গুদাম, কক্সবাজার ফিল্ড অফিস..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Facility Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  প্রতিষ্ঠানের ধরণ (Type) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'Warehouse' as FacilityType, label: 'গুদাম', sub: 'স্টোরেজ ও ইনভেন্টরি', icon: '🏭' },
                    { key: 'Office' as FacilityType, label: 'অফিস', sub: 'প্রশাসনিক কার্যালয়', icon: '🏢' },
                    { key: 'Office & Warehouse' as FacilityType, label: 'অফিস ও গুদাম', sub: 'সমন্বিত সেন্টার', icon: '🏛️' }
                  ].map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setFormType(t.key)}
                      className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        formType === t.key
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-xs font-extrabold">{t.label}</span>
                      <span className="text-[9.5px] text-slate-400">{t.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  অবস্থান বা ঠিকানা (Address / Location)
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="যেমন: ময়মনসিংহ সদর, কাঁচিঝুলি রোড..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Contact Person & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    দায়িত্বপ্রাপ্ত ব্যক্তি (Contact Person)
                  </label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="যেমন: মোঃ শাকিল"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মোবাইল নম্বর (Phone)
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="যেমন: 01711-XXXXXX"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  অতিরিক্ত বিবরণ বা নোট (Optional Notes)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="যেমন: কেন্দ্রীয় ত্রাণ ডিপো, সার্বক্ষণিক নিরাপত্তা পাহারা রয়েছে..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
                >
                  {editingFacility ? 'তথ্য আপডেট করুন' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. MODAL / DRAWER: FACILITY INVENTORY & PROGRAMS BREAKDOWN            */}
      {/* ===================================================================== */}
      {selectedFacilityDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    selectedFacilityDetails.type === 'Warehouse' 
                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : selectedFacilityDetails.type === 'Office'
                      ? 'bg-blue-100 text-blue-900 border border-blue-200'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  }`}>
                    {selectedFacilityDetails.type === 'Warehouse' ? '🏭 গুদাম' : selectedFacilityDetails.type === 'Office' ? '🏢 অফিস' : '🏛️ অফিস ও গুদাম'}
                  </span>
                  <span className="text-xs font-mono text-slate-400 font-bold">{selectedFacilityDetails.id}</span>
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  📍 {selectedFacilityDetails.name}
                </h2>
                {selectedFacilityDetails.address && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedFacilityDetails.address}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    onClick={() => {
                      const f = selectedFacilityDetails;
                      setSelectedFacilityDetails(null);
                      openEditModal(f);
                    }}
                    className="p-2 border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>এডিট</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedFacilityDetails(null)}
                  className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Content: Programs operating under this facility */}
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-600" />
                  <span>এই গুদাম / অফিসের অধীনে পরিচালিত রিলিফ প্রোগ্রামসমূহ</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  নিচে এই গুদাম থেকে পরিচালিত প্রোগ্রাম এবং পণ্য সামগ্রী ও প্যাকেজের সুনির্দিষ্ট হিসাব প্রদর্শিত হচ্ছে:
                </p>
              </div>

              {(() => {
                const facilityPrograms = programs.filter(p => p.warehouses?.includes(selectedFacilityDetails.name));

                if (facilityPrograms.length === 0) {
                  return (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                      <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-600">এই গুদামের সাথে এখনও কোনো প্রোগ্রাম সংযুক্ত করা হয়নি</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                        নতুন কোনো রিলিফ প্রোগ্রাম তৈরি করার সময় অথবা বিদ্যমান প্রোগ্রাম এডিট করার সময় গুদাম তালিকায় "{selectedFacilityDetails.name}" নির্বাচন করুন।
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {facilityPrograms.map(p => {
                      // Filter items that have stock for this warehouse
                      const itemsInWarehouse = (p.inventoryItems || []).map(item => {
                        const whStock = item.warehouseStocks?.[selectedFacilityDetails.name] || { totalReceived: 0, allocatedToPackages: 0 };
                        return {
                          ...item,
                          whReceived: whStock.totalReceived,
                          whAllocated: whStock.allocatedToPackages,
                          whAvailable: Math.max(0, whStock.totalReceived - whStock.allocatedToPackages)
                        };
                      });

                      // Packages assembled in this warehouse
                      const packagesInWarehouse = (p.inventoryPackages || []).map(pkg => {
                        const assembledHere = pkg.warehouseAssembled?.[selectedFacilityDetails.name] || 0;
                        return {
                          ...pkg,
                          assembledHere
                        };
                      });

                      return (
                        <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                          {/* Program Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-bold text-slate-400">{p.id}</span>
                                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.2 rounded font-bold">
                                  {p.type}
                                </span>
                              </div>
                              <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">{p.name}</h4>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setSelectedFacilityDetails(null);
                                  onNavigateToInventory(p.id, selectedFacilityDetails.name);
                                }}
                                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <Boxes className="w-3.5 h-3.5" />
                                <span>ইনভেন্টরি ডেস্ক</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedFacilityDetails(null);
                                  onNavigateToProgramDesk(p.id);
                                }}
                                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                                <span>বিতরণ ডেস্ক</span>
                              </button>
                            </div>
                          </div>

                          {/* Inventory Packages Section for this warehouse */}
                          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5">
                            <div className="flex items-center justify-between text-xs font-extrabold text-amber-950 mb-2">
                              <span className="flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-amber-600" />
                                <span>এই গুদামে প্রস্তুতকৃত প্যাকেজ (Assembled Packages)</span>
                              </span>
                            </div>

                            {packagesInWarehouse.length === 0 ? (
                              <p className="text-[11px] text-amber-800 italic">এই প্রোগ্রামে এখনও কোনো প্যাকেজ তৈরি করা হয়নি।</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {packagesInWarehouse.map(pkg => (
                                  <div key={pkg.id} className="bg-white border border-amber-200 rounded-lg p-2.5 text-xs flex justify-between items-center">
                                    <span className="font-bold text-slate-800">{pkg.name}</span>
                                    <span className="font-mono font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      {pkg.assembledHere} টি প্যাক
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Inventory Items Section for this warehouse */}
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Boxes className="w-3.5 h-3.5 text-slate-500" />
                              <span>মালের মজুদ হিসাব ({selectedFacilityDetails.name} গুদাম):</span>
                            </span>

                            {itemsInWarehouse.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">কোনো মালামাল আইটেম এন্ট্রি করা হয়নি।</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                                    <tr>
                                      <th className="p-2.5">পণ্য/আইটেমের নাম</th>
                                      <th className="p-2.5 text-right">মোট প্রাপ্ত (Received)</th>
                                      <th className="p-2.5 text-right">প্যাকেজে বরাদ্দ (Allocated)</th>
                                      <th className="p-2.5 text-right">মজুত অবশিষ্ট (Available)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {itemsInWarehouse.map(item => (
                                      <tr key={item.id} className="hover:bg-slate-50/50">
                                        <td className="p-2.5 font-bold text-slate-800">
                                          {item.name}
                                          {item.category && <span className="text-[10px] text-slate-400 font-normal ml-1">({item.category})</span>}
                                        </td>
                                        <td className="p-2.5 text-right font-mono font-semibold text-slate-700">
                                          {item.whReceived} {item.unit}
                                        </td>
                                        <td className="p-2.5 text-right font-mono font-semibold text-amber-700">
                                          {item.whAllocated} {item.unit}
                                        </td>
                                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                                          {item.whAvailable} {item.unit}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
