import { useState, useEffect, FormEvent } from 'react';
import { User, Program, ProgramType, BeneficiaryCommunity } from '../types';
import { Layers, Save, Search, Check, FolderPlus } from 'lucide-react';

interface ProgramCreateProps {
  donorsList: User[];
  onSave: (program: Program) => void;
  onCancel?: () => void;
  editingProgram?: Program | null;
}

const PROGRAM_TYPES: ProgramType[] = [
  'Food Program',
  'Winter Program',
  'Wash Program',
  'Seasonal Program',
  'Emergency Program',
  'Rohingya Program',
  'Humanitarian Program',
  'Health Program',
  'Shelter Program',
  'Orphan Program',
  'Other Program'
];

export default function ProgramCreate({
  donorsList,
  onSave,
  onCancel,
  editingProgram
}: ProgramCreateProps) {
  const generateNewId = () => {
    const rNum = Math.floor(1000 + Math.random() * 9000);
    return `MWO-PRG-${rNum}`;
  };

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<ProgramType>('Food Program');
  const [beneficiaryCommunity, setBeneficiaryCommunity] = useState<BeneficiaryCommunity>('Local Community');
  const [programDate, setProgramDate] = useState('');
  const [programDuration, setProgramDuration] = useState('');
  const [targetStockSize, setTargetStockSize] = useState<number>(100);

  // Warehouses / Location management
  const [warehouses, setWarehouses] = useState<string[]>(['ময়মনসিংহ', 'কক্সবাজার', 'খুলনা']);
  const [newWarehouseInput, setNewWarehouseInput] = useState('');

  // Search & Multiple Donors variables
  const [selectedDonors, setSelectedDonors] = useState<string[]>([]);
  const [donorSearch, setDonorSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (editingProgram) {
      setId(editingProgram.id);
      setName(editingProgram.name);
      setType(editingProgram.type);
      setBeneficiaryCommunity(editingProgram.beneficiaryCommunity);
      setProgramDate(editingProgram.programDate);
      setProgramDuration(editingProgram.programDuration);
      setTargetStockSize(editingProgram.targetStockSize);
      setSelectedDonors(editingProgram.donors || []);
      setWarehouses(editingProgram.warehouses && editingProgram.warehouses.length > 0 ? editingProgram.warehouses : ['ময়মনসিংহ', 'কক্সবাজার', 'খুলনা']);
    } else {
      setId(generateNewId());
      setName('');
      setType('Food Program');
      setBeneficiaryCommunity('Local Community');
      
      const today = new Date().toISOString().split('T')[0];
      setProgramDate(today);
      setProgramDuration('1 Month');
      setTargetStockSize(250);
      setSelectedDonors([]);
      setWarehouses(['ময়মনসিংহ', 'কক্সবাজার', 'খুলনা']);
    }
  }, [editingProgram]);

  // Warehouse Helpers
  const addWarehouse = (whName: string) => {
    const trimmed = whName.trim();
    if (!trimmed) return;
    if (!warehouses.includes(trimmed)) {
      setWarehouses([...warehouses, trimmed]);
    }
    setNewWarehouseInput('');
  };

  const removeWarehouse = (whName: string) => {
    if (warehouses.length <= 1) {
      alert('অন্তত একটি গুদাম/লোকেশন থাকা আবশ্যক!');
      return;
    }
    setWarehouses(warehouses.filter(w => w !== whName));
  };

  // Filter donor selections with live search
  const filteredDonors = donorsList.filter((d) =>
    d.name.toLowerCase().includes(donorSearch.toLowerCase()) ||
    d.id.toLowerCase().includes(donorSearch.toLowerCase())
  );

  const toggleDonor = (donorId: string) => {
    if (selectedDonors.includes(donorId)) {
      setSelectedDonors(selectedDonors.filter((id) => id !== donorId));
    } else {
      setSelectedDonors([...selectedDonors, donorId]);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) { setFormError('Program name is required.'); return; }
    if (selectedDonors.length === 0) { setFormError('Please select at least one donor for this program.'); return; }
    if (targetStockSize <= 0) { setFormError('Target distribution stock size must be greater than zero.'); return; }

    onSave({
      id: id.trim(),
      name: name.trim(),
      type,
      donors: selectedDonors,
      beneficiaryCommunity,
      programDate,
      programDuration: programDuration.trim() || '1 Day',
      targetStockSize,
      remainingStock: editingProgram 
        ? editingProgram.remainingStock + (targetStockSize - editingProgram.targetStockSize)
        : targetStockSize,
      warehouses: warehouses.length > 0 ? warehouses : ['ময়মনসিংহ', 'কক্সবাজার', 'খুলনা'],
      inventoryItems: editingProgram?.inventoryItems,
      inventoryPackages: editingProgram?.inventoryPackages
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm max-w-2xl mx-auto">
      <div className="flex justify-between items-center pb-4 mb-5 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            {editingProgram ? 'Edit Distribution Program' : 'Create Distribution Program'}
          </h2>
          <p className="text-xs text-slate-500">
            Define distribution types, schedule timelines, set quantities, and link multiple donor funding resources.
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            Cancel Form
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-250">
            <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">&times;</span>
            <span className="flex-1">{formError}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            PROGRAM UNIQUE TRACKING ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            PROGRAM NAME <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Winter Blanket Distribution Rohingya Camp 12"
            className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              PROGRAM TYPE <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProgramType)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              {PROGRAM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              BENEFICIARY COMMUNITY CARRIER <span className="text-red-500">*</span>
            </label>
            <select
              value={beneficiaryCommunity}
              onChange={(e) => setBeneficiaryCommunity(e.target.value as BeneficiaryCommunity)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              <option value="Local Community">Local Community Only</option>
              <option value="Rohingya Community">Rohingya Community Only</option>
              <option value="Both">Both (Local &amp; Rohingya)</option>
              <option value="Other Community">Other Community</option>
            </select>
          </div>
        </div>

        {/* Search & Select Multiple Donors */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Assign Funding Donors <span className="text-red-500">*</span>
            </label>
            {selectedDonors.length > 0 && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                {selectedDonors.length} Selected
              </span>
            )}
          </div>

          {/* Quick search input filter */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={donorSearch}
              onChange={(e) => setDonorSearch(e.target.value)}
              placeholder="Search donor database list..."
              className="w-full border border-slate-300 bg-white rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-200 bg-white rounded-lg p-2.5">
            {filteredDonors.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">
                No matching donors found. Record donors in user panels first.
              </div>
            ) : (
              filteredDonors.map((donor) => {
                const isSelected = selectedDonors.includes(donor.id);
                return (
                  <button
                    type="button"
                    key={donor.id}
                    onClick={() => toggleDonor(donor.id)}
                    className={`w-full flex items-center justify-between text-left p-2 rounded-lg text-xs font-medium cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-sm'
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">{donor.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">User ID: {donor.id}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">PROGRAM INCEPTION DATE</label>
            <input
              type="date"
              value={programDate}
              onChange={(e) => setProgramDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">PROGRAM RUNTIME DURATION</label>
            <input
              type="text"
              value={programDuration}
              onChange={(e) => setProgramDuration(e.target.value)}
              placeholder="e.g. 1 Year, 3 Months"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              TARGET STOCK LIMIT <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min={1}
              value={targetStockSize}
              onChange={(e) => setTargetStockSize(parseInt(e.target.value) || 0)}
              placeholder="Total count of distribution items"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* WAREHOUSE / STORAGE LOCATIONS */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-0.5">
              গুদাম ও ওয়্যারহাউস লোকেশন (Storage Warehouses)
            </label>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              এই প্রোগ্রামের পণ্য ও প্যাকেজ কোন কোন গুদামে আলাদা আলাদা হিসাবে থাকবে তা নির্বাচন বা যুক্ত করুন।
            </p>
          </div>

          {/* Active Warehouses Tags */}
          <div className="flex flex-wrap gap-2">
            {warehouses.map((wh) => (
              <span
                key={wh}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg shadow-2xs"
              >
                <span>📍 {wh}</span>
                <button
                  type="button"
                  onClick={() => removeWarehouse(wh)}
                  className="hover:bg-rose-100 text-rose-500 rounded p-0.5 transition cursor-pointer"
                  title="গুদাম মুছে ফেলুন"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          {/* Common Presets */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">প্রস্তাবিত লোকেশন:</span>
            {['ময়মনসিংহ', 'কক্সবাজার', 'খুলনা', 'ঢাকা', 'চট্টগ্রাম', 'সিলেট', 'রংপুর', 'রাজশাহী'].map((loc) => {
              const isAdded = warehouses.includes(loc);
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => addWarehouse(loc)}
                  disabled={isAdded}
                  className={`text-[11px] px-2 py-0.5 rounded border transition cursor-pointer ${
                    isAdded
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200'
                  }`}
                >
                  +{loc}
                </button>
              );
            })}
          </div>

          {/* Add Custom Warehouse Input */}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={newWarehouseInput}
              onChange={(e) => setNewWarehouseInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addWarehouse(newWarehouseInput);
                }
              }}
              placeholder="কাস্টম গুদামের নাম লিখুন (যেমন: বরিশাল ওয়্যারহাউস)..."
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
            <button
              type="button"
              onClick={() => addWarehouse(newWarehouseInput)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
            >
              যোগ করুন
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 hover:bg-slate-50 border border-slate-300 rounded-xl text-slate-600 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 px-5 rounded-xl flex items-center gap-1 shadow-sm cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            {editingProgram ? 'Update Program Details' : 'Launch New Program'}
          </button>
        </div>
      </form>
    </div>
  );
}
