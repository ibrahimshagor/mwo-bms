import { useState, useEffect, FormEvent } from 'react';
import { User, Program, ProgramType, BeneficiaryCommunity, OfficeWarehouse } from '../types';
import { Layers, Save, Search, Check, FolderPlus, MapPin, Building2, Warehouse, Plus } from 'lucide-react';

interface ProgramCreateProps {
  donorsList: User[];
  facilitiesList?: OfficeWarehouse[];
  onSave: (program: Program) => void;
  onCancel?: () => void;
  editingProgram?: Program | null;
  onOpenCreateFacility?: () => void;
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
  facilitiesList = [],
  onSave,
  onCancel,
  editingProgram,
  onOpenCreateFacility
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

  // Warehouses / Storage management
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [newWarehouseInput, setNewWarehouseInput] = useState('');

  // Distribution Locations / Areas management (বিতরণ এলাকা / অঞ্চল) - starts empty
  const [locations, setLocations] = useState<string[]>([]);
  const [newLocationInput, setNewLocationInput] = useState('');

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
      setWarehouses(editingProgram.warehouses && editingProgram.warehouses.length > 0 ? editingProgram.warehouses : (facilitiesList.length > 0 ? [facilitiesList[0].name] : ['প্রধান গুদাম']));
      setLocations(editingProgram.locations && editingProgram.locations.length > 0 ? [...editingProgram.locations] : []);
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
      setWarehouses(facilitiesList.length > 0 ? [facilitiesList[0].name] : ['প্রধান গুদাম']);
      setLocations([]); // Clean and empty by default
    }
  }, [editingProgram, facilitiesList]);

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
      alert('অন্তত একটি পরিচালনাকারী গুদাম বা অফিস নির্বাচন করা আবশ্যক!');
      return;
    }
    setWarehouses(warehouses.filter(w => w !== whName));
  };

  // Location / Area Helpers
  const addLocation = (locName: string) => {
    const trimmed = locName.trim();
    if (!trimmed) return;
    if (!locations.includes(trimmed)) {
      setLocations([...locations, trimmed]);
    }
    setNewLocationInput('');
  };

  const removeLocation = (locName: string) => {
    setLocations(locations.filter(l => l !== locName));
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
    if (warehouses.length === 0) { setFormError('Please select at least one warehouse or office for this program.'); return; }

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
      warehouses: warehouses.length > 0 ? warehouses : ['প্রধান গুদাম'],
      locations: locations, // User's custom locations only
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
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-0.5 flex items-center gap-1.5">
                <Warehouse className="w-4 h-4 text-amber-600" />
                <span>পরিচালনাকারী অফিস ও গুদাম (Storage Warehouses / Offices) *</span>
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                কোন কোন গুদাম বা শাখা অফিস থেকে এই প্রোগ্রামের ত্রাণসামগ্রী পরিচালিত বা সরবরাহ করা হবে তা নির্বাচন করুন।
              </p>
            </div>

            {onOpenCreateFacility && (
              <button
                type="button"
                onClick={onOpenCreateFacility}
                className="text-[11px] bg-white border border-amber-300 hover:border-amber-400 text-amber-800 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer shrink-0 shadow-2xs hover:bg-amber-50"
              >
                <Plus className="w-3 h-3 text-amber-600" />
                <span>নতুন গুদাম/অফিস তৈরি</span>
              </button>
            )}
          </div>

          {/* Active Warehouses Tags */}
          <div className="flex flex-wrap gap-2">
            {warehouses.map((wh) => (
              <span
                key={wh}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-400 text-amber-900 text-xs font-bold rounded-lg shadow-2xs"
              >
                <span>📍 {wh}</span>
                <button
                  type="button"
                  onClick={() => removeWarehouse(wh)}
                  className="hover:bg-rose-100 text-rose-500 rounded p-0.5 transition cursor-pointer"
                  title="গুদাম বাদ দিন"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          {/* Registered Offices & Warehouses Selector */}
          {facilitiesList.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-slate-200/80">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                নিবন্ধিত অফিস ও গুদাম তালিকা থেকে নির্বাচন করুন:
              </span>
              <div className="flex flex-wrap gap-2">
                {facilitiesList.map((fac) => {
                  const isSelected = warehouses.includes(fac.name);
                  return (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          removeWarehouse(fac.name);
                        } else {
                          addWarehouse(fac.name);
                        }
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>
                        {fac.type === 'Warehouse' ? '🏭' : fac.type === 'Office' ? '🏢' : '🏛️'}
                      </span>
                      <span>{fac.name}</span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">+যুক্ত</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Custom Warehouse Input */}
          <div className="flex gap-2 pt-1 border-t border-slate-200/80">
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
              placeholder="কাস্টম গুদাম বা অফিসের নাম লিখুন (যেমন: বরিশাল ওয়্যারহাউস)..."
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
            <button
              type="button"
              onClick={() => addWarehouse(newWarehouseInput)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
            >
              যোগ করুন
            </button>
          </div>
        </div>

        {/* DISTRIBUTION LOCATIONS / AREAS (সম্পূর্ণ কাস্টমাইজেবল - কোনো হার্ডকোডেড তালিকা নেই) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-0.5 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>বিতরণ এলাকা / অঞ্চল (Distribution Locations / Areas)</span>
            </label>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              আপনার প্রয়োজন অনুযায়ী প্রোগ্রামটির বিতরণ এলাকা বা অঞ্চলের নাম নিচে লিখে যোগ করুন। বিতরণ করার সময় এই নির্দিষ্ট এলাকাগুলো সরাসরি তালিকায় প্রদর্শিত হবে।
            </p>
          </div>

          {/* Active Locations Tags */}
          <div className="flex flex-wrap gap-2">
            {locations.length === 0 ? (
              <span className="text-xs text-slate-500 italic bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                কোনো নির্দিষ্ট এলাকা সেট করা নেই। নিচে আপনার সুবিধামতো এলাকার নাম লিখে যোগ করুন।
              </span>
            ) : (
              locations.map((loc) => (
                <span
                  key={loc}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg shadow-2xs"
                >
                  <span>🎯 {loc}</span>
                  <button
                    type="button"
                    onClick={() => removeLocation(loc)}
                    className="hover:bg-rose-100 text-rose-500 rounded p-0.5 transition cursor-pointer"
                    title="এলাকা মুছে ফেলুন"
                  >
                    &times;
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Add Custom Location Input */}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={newLocationInput}
              onChange={(e) => setNewLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLocation(newLocationInput);
                }
              }}
              placeholder="বিতরণ এলাকা বা অঞ্চলের নাম লিখুন (যেমন: ময়মনসিংহ সদর, ত্রিশাল, ঢাকা মিরপুর ইত্যাদি)..."
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
            <button
              type="button"
              onClick={() => addLocation(newLocationInput)}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
            >
              এলাকা যোগ করুন
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
