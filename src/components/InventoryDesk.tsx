import React, { useState, useMemo, useEffect, FormEvent } from 'react';
import { Program, InventoryItem, InventoryPackage, User, ServiceRecord, PackageItemRequirement } from '../types';
import * as XLSX from 'xlsx';
import { 
  Boxes, PackagePlus, Plus, Minus, Layers, CheckCircle, AlertTriangle, 
  Trash2, Edit3, ArrowRight, ArrowLeft, RefreshCw, ShoppingBag, 
  Sparkles, Check, X, ShieldAlert, FileSpreadsheet, Eye, Info,
  Search, Filter, ClipboardList, Download, ArrowUpRight, SlidersHorizontal
} from 'lucide-react';

interface InventoryDeskProps {
  programs: Program[];
  currentUser: User;
  serviceRecords: ServiceRecord[];
  initialProgramId?: string | null;
  onSelectProgramId?: (programId: string | null) => void;
  onUpdateProgramInventory: (
    programId: string, 
    inventoryItems: InventoryItem[], 
    inventoryPackages: InventoryPackage[]
  ) => void;
  onNavigateToProgramDirectory?: (programId?: string) => void;
}

export default function InventoryDesk({
  programs,
  currentUser,
  serviceRecords,
  initialProgramId,
  onSelectProgramId,
  onUpdateProgramInventory,
  onNavigateToProgramDirectory
}: InventoryDeskProps) {
  // Select active program for inventory operations (null means viewing directory of all programs)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(() => {
    return initialProgramId || null;
  });

  // Sync if initialProgramId prop updates from parent
  useEffect(() => {
    if (initialProgramId !== undefined) {
      setSelectedProgramId(initialProgramId);
    }
  }, [initialProgramId]);

  const handleSelectProgram = (pId: string | null) => {
    setSelectedProgramId(pId);
    if (onSelectProgramId) {
      onSelectProgramId(pId);
    }
  };

  const activeProgram = useMemo(() => {
    if (!selectedProgramId) return null;
    return programs.find(p => p.id === selectedProgramId) || null;
  }, [programs, selectedProgramId]);

  // Directory View States (when selectedProgramId is null)
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  const [directoryCategoryFilter, setDirectoryCategoryFilter] = useState('ALL');
  const [previewProgram, setPreviewProgram] = useState<Program | null>(null);

  // Global Inventory Metrics across all programs
  const globalMetrics = useMemo(() => {
    let totalItemsCount = 0;
    let totalAssembledPackages = 0;
    let totalDistributed = 0;
    let totalRemainingStock = 0;

    programs.forEach(p => {
      totalItemsCount += (p.inventoryItems || []).length;
      const pAssembled = (p.inventoryPackages || []).reduce((sum, pkg) => sum + (pkg.assembledQuantity || 0), 0);
      totalAssembledPackages += pAssembled;
      const pDistributed = serviceRecords
        .filter(sr => sr.programId === p.id)
        .reduce((sum, sr) => sum + sr.packageCount, 0);
      totalDistributed += pDistributed;
      const pRemaining = pAssembled > 0 ? Math.max(0, pAssembled - pDistributed) : p.remainingStock;
      totalRemainingStock += pRemaining;
    });

    return {
      totalItemsCount,
      totalAssembledPackages,
      totalDistributed,
      totalRemainingStock
    };
  }, [programs, serviceRecords]);

  // Filtered Programs for Directory View
  const filteredDirectoryPrograms = useMemo(() => {
    return programs.filter(p => {
      const q = directorySearchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.beneficiaryCommunity.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q);
      
      const matchesCategory = 
        directoryCategoryFilter === 'ALL' || 
        p.type === directoryCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [programs, directorySearchQuery, directoryCategoryFilter]);

  // Navigation tab inside Inventory Desk
  const [activeTab, setActiveTab] = useState<'packages' | 'items' | 'audit'>('packages');

  // Permission checks
  const isSuperAdmin = currentUser.role === 'SuperAdmin';
  const canManageInventory = isSuperAdmin || currentUser.role === 'InventoryManager' || Boolean(currentUser.permissions?.canManageInventory);
  const canAddItems = isSuperAdmin || currentUser.role === 'InventoryManager' || Boolean(currentUser.permissions?.canAddInventoryItems);
  const canCreatePackages = isSuperAdmin || currentUser.role === 'InventoryManager' || Boolean(currentUser.permissions?.canCreatePackages);
  const canAssemble = isSuperAdmin || currentUser.role === 'InventoryManager' || Boolean(currentUser.permissions?.canAssemblePackages);
  const canDisassemble = isSuperAdmin || currentUser.role === 'InventoryManager' || Boolean(currentUser.permissions?.canDisassemblePackages);

  // Modal / Form States
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [selectedItemForStockIn, setSelectedItemForStockIn] = useState<InventoryItem | null>(null);
  const [stockInQuantity, setStockInQuantity] = useState<number>(100);

  // Custom Stock Add/Deduct Modal States
  const [isCustomStockModalOpen, setIsCustomStockModalOpen] = useState(false);
  const [selectedItemForAdjustment, setSelectedItemForAdjustment] = useState<InventoryItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'deduct'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number>(500);
  const [adjustmentNote, setAdjustmentNote] = useState<string>('');

  // Edit Item Modal States
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<InventoryItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('শীতবস্ত্র');
  const [editItemUnit, setEditItemUnit] = useState('পিস (Pcs)');
  const [editItemReceived, setEditItemReceived] = useState<number>(0);
  const [editItemNotes, setEditItemNotes] = useState('');

  // New Item Form
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('শীতবস্ত্র');
  const [newItemUnit, setNewItemUnit] = useState('পিস (Pcs)');
  const [newItemReceived, setNewItemReceived] = useState<number>(500);
  const [newItemNotes, setNewItemNotes] = useState('');

  // Package Assembly Modal
  const [isAssembleModalOpen, setIsAssembleModalOpen] = useState(false);
  const [selectedPackageForAssembly, setSelectedPackageForAssembly] = useState<InventoryPackage | null>(null);
  const [assembleCount, setAssembleCount] = useState<number>(10);

  // Package Disassemble Modal
  const [isDisassembleModalOpen, setIsDisassembleModalOpen] = useState(false);
  const [selectedPackageForDisassemble, setSelectedPackageForDisassemble] = useState<InventoryPackage | null>(null);
  const [disassembleCount, setDisassembleCount] = useState<number>(5);

  // Create Package Recipe Modal
  const [isCreatePackageModalOpen, setIsCreatePackageModalOpen] = useState(false);
  const [newPackageName, setNewPackageName] = useState('');
  const [newPackageDescription, setNewPackageDescription] = useState('');
  const [selectedRecipeItems, setSelectedRecipeItems] = useState<{ itemId: string; quantity: number }[]>([]);

  // Alert / Feedback
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showAlert = (type: 'success' | 'error' | 'info', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => {
      setAlertMsg(prev => prev?.text === text ? null : prev);
    }, 5500);
  };

  // Helper getters for active program
  const currentItems = useMemo(() => activeProgram?.inventoryItems || [], [activeProgram]);
  const currentPackages = useMemo(() => activeProgram?.inventoryPackages || [], [activeProgram]);

  // Total served packages for active program from serviceRecords
  const distributedCount = useMemo(() => {
    if (!activeProgram) return 0;
    return serviceRecords
      .filter(sr => sr.programId === activeProgram.id)
      .reduce((sum, sr) => sum + sr.packageCount, 0);
  }, [activeProgram, serviceRecords]);

  // Total assembled packages across all packages for active program
  const totalAssembled = useMemo(() => {
    return currentPackages.reduce((sum, p) => sum + p.assembledQuantity, 0);
  }, [currentPackages]);

  // Available packages in stock
  const remainingPackages = useMemo(() => {
    return Math.max(0, totalAssembled - distributedCount);
  }, [totalAssembled, distributedCount]);

  // Helper to calculate maximum possible packages that CAN be assembled for a specific package bundle
  const calculateMaxAssembleCapacity = (pkg: InventoryPackage): { maxUnits: number; bottleneckItem: string | null } => {
    if (!pkg.items || pkg.items.length === 0) return { maxUnits: 0, bottleneckItem: null };

    let minUnits = Infinity;
    let bottleneck: string | null = null;

    for (const req of pkg.items) {
      const rawItem = currentItems.find(i => i.id === req.itemId);
      if (!rawItem || req.quantityPerPackage <= 0) {
        minUnits = 0;
        bottleneck = req.itemName;
        break;
      }
      const availableRaw = Math.max(0, rawItem.totalReceived - rawItem.allocatedToPackages);
      const possibleWithThisItem = Math.floor(availableRaw / req.quantityPerPackage);

      if (possibleWithThisItem < minUnits) {
        minUnits = possibleWithThisItem;
        bottleneck = `${rawItem.name} (${availableRaw} ${rawItem.unit} অবশিষ্ট)`;
      }
    }

    return {
      maxUnits: minUnits === Infinity ? 0 : minUnits,
      bottleneckItem: bottleneck
    };
  };

  // 1. ADD NEW RAW ITEM
  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProgram) return;
    if (!newItemName.trim()) {
      showAlert('error', 'পণ্যের নাম দেওয়া আবশ্যক!');
      return;
    }
    if (newItemReceived < 0) {
      showAlert('error', 'প্রাপ্ত সংখ্যা ০ বা তার বেশি হতে হবে!');
      return;
    }

    const newItemId = `ITEM-${Date.now().toString().slice(-4)}`;
    const newItem: InventoryItem = {
      id: newItemId,
      programId: activeProgram.id,
      name: newItemName.trim(),
      category: newItemCategory,
      unit: newItemUnit,
      totalReceived: Number(newItemReceived),
      allocatedToPackages: 0,
      notes: newItemNotes.trim(),
      createdAt: new Date().toISOString()
    };

    const updatedItems = [...currentItems, newItem];
    onUpdateProgramInventory(activeProgram.id, updatedItems, currentPackages);

    showAlert('success', `"${newItem.name}" (${newItem.totalReceived} ${newItem.unit}) সফলভাবে ইনভেন্টরিতে যুক্ত হয়েছে!`);
    setIsAddItemModalOpen(false);
    setNewItemName('');
    setNewItemReceived(500);
    setNewItemNotes('');
  };

  // 2. QUICK 1-CLICK INCREMENT (+1)
  const handleQuickIncrement = (itemId: string) => {
    if (!activeProgram) return;
    const item = currentItems.find(i => i.id === itemId);
    if (!item) return;

    const updatedItems = currentItems.map(i => {
      if (i.id === itemId) {
        return {
          ...i,
          totalReceived: i.totalReceived + 1,
          updatedAt: new Date().toISOString()
        };
      }
      return i;
    });

    onUpdateProgramInventory(activeProgram.id, updatedItems, currentPackages);
    showAlert('success', `"${item.name}": +১ যোগ করা হয়েছে (মোট: ${item.totalReceived + 1} ${item.unit})`);
  };

  // 2.1 QUICK 1-CLICK DECREMENT (-1)
  const handleQuickDecrement = (itemId: string) => {
    if (!activeProgram) return;
    const item = currentItems.find(i => i.id === itemId);
    if (!item) return;

    const remainingInStore = Math.max(0, item.totalReceived - item.allocatedToPackages);
    if (remainingInStore <= 0) {
      showAlert('error', `"${item.name}" থেকে আর কমানো যাবে না! গুদামে অবশিষ্ট স্টক নেই (${item.allocatedToPackages} ${item.unit} প্যাকেজে বরাদ্দ আছে)।`);
      return;
    }

    if (item.totalReceived <= 0) {
      showAlert('error', 'স্টক ০ এর নিচে নামানো সম্ভব নয়!');
      return;
    }

    const updatedItems = currentItems.map(i => {
      if (i.id === itemId) {
        return {
          ...i,
          totalReceived: Math.max(i.allocatedToPackages, i.totalReceived - 1),
          updatedAt: new Date().toISOString()
        };
      }
      return i;
    });

    onUpdateProgramInventory(activeProgram.id, updatedItems, currentPackages);
    showAlert('info', `"${item.name}": -১ কমানো হয়েছে (মোট: ${item.totalReceived - 1} ${item.unit})`);
  };

  // 2.2 OPEN CUSTOM STOCK ADJUSTMENT MODAL (+/- 500, 600, etc.)
  const handleOpenCustomStockModal = (item: InventoryItem, defaultType: 'add' | 'deduct' = 'add') => {
    setSelectedItemForAdjustment(item);
    setAdjustmentType(defaultType);
    setAdjustmentQuantity(500);
    setAdjustmentNote('');
    setIsCustomStockModalOpen(true);
  };

  // 2.3 CONFIRM CUSTOM STOCK ADJUSTMENT
  const handleCustomStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProgram || !selectedItemForAdjustment || adjustmentQuantity <= 0) return;

    const item = selectedItemForAdjustment;
    const qty = Number(adjustmentQuantity);

    if (adjustmentType === 'deduct') {
      const available = Math.max(0, item.totalReceived - item.allocatedToPackages);
      if (qty > available) {
        showAlert('error', `সর্বোচ্চ ${available} ${item.unit} বাদ দেওয়া যাবে! কারণ ${item.allocatedToPackages} ${item.unit} মালামাল ইতোমধ্যে প্রস্তুতকৃত প্যাকেজে বরাদ্দ রয়েছে।`);
        return;
      }
    }

    const newTotalReceived = adjustmentType === 'add'
      ? item.totalReceived + qty
      : Math.max(item.allocatedToPackages, item.totalReceived - qty);

    const updatedItems = currentItems.map(i => {
      if (i.id === item.id) {
        return {
          ...i,
          totalReceived: newTotalReceived,
          notes: adjustmentNote.trim() 
            ? `${i.notes ? i.notes + ' | ' : ''}${adjustmentType === 'add' ? '+' : '-'}${qty} (${adjustmentNote.trim()})` 
            : i.notes,
          updatedAt: new Date().toISOString()
        };
      }
      return i;
    });

    onUpdateProgramInventory(activeProgram.id, updatedItems, currentPackages);

    if (adjustmentType === 'add') {
      showAlert('success', `"${item.name}" এ কাস্টম +${qty} ${item.unit} সফলভাবে যোগ করা হয়েছে! নতুন মোট: ${newTotalReceived} ${item.unit}`);
    } else {
      showAlert('info', `"${item.name}" থেকে কাস্টম -${qty} ${item.unit} সফলভাবে বাদ দেওয়া হয়েছে। নতুন মোট: ${newTotalReceived} ${item.unit}`);
    }

    setIsCustomStockModalOpen(false);
    setSelectedItemForAdjustment(null);
    setAdjustmentQuantity(500);
    setAdjustmentNote('');
  };

  // 2.4 OPEN EDIT ITEM MODAL
  const handleOpenEditItemModal = (item: InventoryItem) => {
    setSelectedItemForEdit(item);
    setEditItemName(item.name);
    setEditItemCategory(item.category || 'শীতবস্ত্র');
    setEditItemUnit(item.unit || 'পিস (Pcs)');
    setEditItemReceived(item.totalReceived);
    setEditItemNotes(item.notes || '');
    setIsEditItemModalOpen(true);
  };

  // 2.5 SAVE EDIT ITEM
  const handleSaveEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProgram || !selectedItemForEdit) return;

    if (!editItemName.trim()) {
      showAlert('error', 'পণ্যের নাম প্রদান করা আবশ্যক!');
      return;
    }

    if (editItemReceived < selectedItemForEdit.allocatedToPackages) {
      showAlert('error', `মোট প্রাপ্ত সংখ্যা প্যাকেজে বরাদ্দকৃত (${selectedItemForEdit.allocatedToPackages} ${selectedItemForEdit.unit}) এর চেয়ে কম হতে পারে না!`);
      return;
    }

    const updatedItems = currentItems.map(item => {
      if (item.id === selectedItemForEdit.id) {
        return {
          ...item,
          name: editItemName.trim(),
          category: editItemCategory,
          unit: editItemUnit,
          totalReceived: Number(editItemReceived),
          notes: editItemNotes.trim(),
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    });

    // Also sync the item name/unit in package recipes if changed
    const updatedPackages = currentPackages.map(pkg => ({
      ...pkg,
      items: pkg.items.map(req => {
        if (req.itemId === selectedItemForEdit.id) {
          return {
            ...req,
            itemName: editItemName.trim(),
            unit: editItemUnit
          };
        }
        return req;
      })
    }));

    onUpdateProgramInventory(activeProgram.id, updatedItems, updatedPackages);
    showAlert('success', `"${editItemName}" এর তথ্য সফলভাবে আপডেট ও সংরক্ষিত হয়েছে!`);
    setIsEditItemModalOpen(false);
    setSelectedItemForEdit(null);
  };

  // 2.6 LEGACY QUICK STOCK IN
  const handleStockIn = () => {
    if (!activeProgram || !selectedItemForStockIn || stockInQuantity <= 0) return;

    const updatedItems = currentItems.map(item => {
      if (item.id === selectedItemForStockIn.id) {
        return {
          ...item,
          totalReceived: item.totalReceived + Number(stockInQuantity),
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    });

    onUpdateProgramInventory(activeProgram.id, updatedItems, currentPackages);
    showAlert('success', `"${selectedItemForStockIn.name}" এ আরও ${stockInQuantity} ${selectedItemForStockIn.unit} যোগ করা হয়েছে!`);
    setIsStockInModalOpen(false);
    setSelectedItemForStockIn(null);
  };

  // 3. DELETE RAW ITEM
  const handleDeleteItem = (itemId: string) => {
    if (!activeProgram) return;
    const itemToDelete = currentItems.find(i => i.id === itemId);
    if (!itemToDelete) return;

    // Check if item is used in any package recipe
    const usedInPackage = currentPackages.some(pkg => 
      pkg.items.some(req => req.itemId === itemId)
    );
    if (usedInPackage) {
      showAlert('error', `আইটেম "${itemToDelete.name}" প্যাকেজ রেসিপিতে ব্যবহৃত আছে! প্যাকেজ থেকে আগে বাদ দিন অথবা প্যাকেজ ডিলিট করুন।`);
      return;
    }

    if (itemToDelete.allocatedToPackages > 0) {
      showAlert('error', `এই আইটেমের ${itemToDelete.allocatedToPackages} টি তৈরি করা প্যাকেজে বরাদ্দ আছে!`);
      return;
    }

    if (!window.confirm(`আপনি কি নিশ্চিতভাবে "${itemToDelete.name}" ইনভেন্টরি থেকে ডিলিট করতে চান?`)) {
      return;
    }

    const updatedItems = currentItems.filter(i => i.id !== itemId);
    onUpdateProgramInventory(activeProgram.id, updatedItems, currentPackages);
    showAlert('info', `"${itemToDelete.name}" ইনভেন্টরি থেকে অপসারিত হয়েছে।`);
  };

  // 4. CREATE PACKAGE BUNDLE RECIPE
  const handleCreatePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProgram) return;
    if (!newPackageName.trim()) {
      showAlert('error', 'প্যাকেজের নাম দেওয়া আবশ্যক!');
      return;
    }
    if (selectedRecipeItems.length === 0) {
      showAlert('error', 'অন্তত ১টি পণ্য নির্বাচন করুন যা দিয়ে প্যাকেজ তৈরি হবে!');
      return;
    }

    // Build package requirements
    const packageItems: PackageItemRequirement[] = selectedRecipeItems.map(sel => {
      const raw = currentItems.find(i => i.id === sel.itemId);
      return {
        itemId: sel.itemId,
        itemName: raw ? raw.name : 'Unknown Item',
        quantityPerPackage: Number(sel.quantity) || 1,
        unit: raw ? raw.unit : 'Pcs'
      };
    });

    const newPkgId = `PKG-${Date.now().toString().slice(-4)}`;
    const newPackage: InventoryPackage = {
      id: newPkgId,
      programId: activeProgram.id,
      name: newPackageName.trim(),
      description: newPackageDescription.trim(),
      items: packageItems,
      assembledQuantity: 0,
      createdAt: new Date().toISOString()
    };

    const updatedPackages = [...currentPackages, newPackage];
    onUpdateProgramInventory(activeProgram.id, currentItems, updatedPackages);

    showAlert('success', `নতুন প্যাকেজ রেসিপি "${newPackage.name}" প্রস্তুত হয়েছে! এবার মালামাল দিয়ে প্যাকেজ অ্যাসেম্বল করুন।`);
    setIsCreatePackageModalOpen(false);
    setNewPackageName('');
    setNewPackageDescription('');
    setSelectedRecipeItems([]);
  };

  // 5. ASSEMBLE PACKAGES (Convert Raw Items -> Assembled Packages)
  const handleAssemblePackages = () => {
    if (!activeProgram || !selectedPackageForAssembly || assembleCount <= 0) return;

    const count = Number(assembleCount);
    const { maxUnits, bottleneckItem } = calculateMaxAssembleCapacity(selectedPackageForAssembly);

    if (count > maxUnits) {
      showAlert('error', `পর্যাপ্ত মালামাল নেই! সর্বোচ্চ ${maxUnits} টি প্যাকেজ বানানো সম্ভব (${bottleneckItem})।`);
      return;
    }

    // Deduct raw materials by increasing allocatedToPackages
    const updatedItems = currentItems.map(item => {
      const req = selectedPackageForAssembly.items.find(r => r.itemId === item.id);
      if (req) {
        return {
          ...item,
          allocatedToPackages: item.allocatedToPackages + (req.quantityPerPackage * count),
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    });

    // Increase package assembledQuantity
    const updatedPackages = currentPackages.map(pkg => {
      if (pkg.id === selectedPackageForAssembly.id) {
        return {
          ...pkg,
          assembledQuantity: pkg.assembledQuantity + count,
          updatedAt: new Date().toISOString()
        };
      }
      return pkg;
    });

    onUpdateProgramInventory(activeProgram.id, updatedItems, updatedPackages);

    showAlert('success', `অভিনন্দন! সফলভাবে ${count} টি "${selectedPackageForAssembly.name}" প্যাকেজ প্রস্তুত ও প্যাক করা হয়েছে! প্রোগ্রাম ডিরেক্টরিতে বিতরণযোগ্য স্টক স্বয়ংক্রিয়ভাবে বৃদ্ধি পেয়েছে।`);
    setIsAssembleModalOpen(false);
    setSelectedPackageForAssembly(null);
  };

  // 6. DISASSEMBLE / UNPACK (Return unserved packages back to raw stock)
  const handleDisassemblePackages = () => {
    if (!activeProgram || !selectedPackageForDisassemble || disassembleCount <= 0) return;

    const count = Number(disassembleCount);

    if (count > selectedPackageForDisassemble.assembledQuantity) {
      showAlert('error', `সর্বোচ্চ ${selectedPackageForDisassemble.assembledQuantity} টি প্যাকেজ আনপ্যাক করা যাবে!`);
      return;
    }

    // Verify unserved packages availability
    const totalRemainingPacks = Math.max(0, totalAssembled - distributedCount);
    if (count > totalRemainingPacks) {
      showAlert('error', `ইতোমধ্যে ${distributedCount} টি প্যাক সুবিধাভোগীদের মাঝে বিতরণ হয়ে গেছে! অবশিষ্ট অ-বিতরণকৃত ${totalRemainingPacks} টির বেশি আনপ্যাক করা যাবে না।`);
      return;
    }

    // Return raw materials back to store by decreasing allocatedToPackages
    const updatedItems = currentItems.map(item => {
      const req = selectedPackageForDisassemble.items.find(r => r.itemId === item.id);
      if (req) {
        return {
          ...item,
          allocatedToPackages: Math.max(0, item.allocatedToPackages - (req.quantityPerPackage * count)),
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    });

    // Decrease package assembledQuantity
    const updatedPackages = currentPackages.map(pkg => {
      if (pkg.id === selectedPackageForDisassemble.id) {
        return {
          ...pkg,
          assembledQuantity: Math.max(0, pkg.assembledQuantity - count),
          updatedAt: new Date().toISOString()
        };
      }
      return pkg;
    });

    onUpdateProgramInventory(activeProgram.id, updatedItems, updatedPackages);

    showAlert('info', `${count} টি প্যাকেজ আনপ্যাক করে সমপরিমাণ কাঁচামাল স্টোর গুদামে ফেরত নেওয়া হয়েছে।`);
    setIsDisassembleModalOpen(false);
    setSelectedPackageForDisassemble(null);
  };

  // 7. DELETE PACKAGE RECIPE
  const handleDeletePackage = (pkgId: string) => {
    if (!activeProgram) return;
    const pkg = currentPackages.find(p => p.id === pkgId);
    if (!pkg) return;

    if (pkg.assembledQuantity > 0) {
      showAlert('error', `এই প্যাকেজে ${pkg.assembledQuantity} টি তৈরি করা প্যাক আছে! প্যাকেজ ডিলিট করার আগে সেগুলো আনপ্যাক (Disassemble) করুন।`);
      return;
    }

    if (!window.confirm(`আপনি কি "${pkg.name}" প্যাকেজ রেসিপি মুছে ফেলতে চান?`)) return;

    const updatedPackages = currentPackages.filter(p => p.id !== pkgId);
    onUpdateProgramInventory(activeProgram.id, currentItems, updatedPackages);
    showAlert('info', `প্যাকেজ "${pkg.name}" মুছে ফেলা হয়েছে।`);
  };

  // Export Inventory Excel for active program
  const handleExportProgramInventory = () => {
    if (!activeProgram) return;
    try {
      const wb = XLSX.utils.book_new();

      // Raw items sheet
      const itemsData = currentItems.map(i => ({
        "আইটেম আইডি": i.id,
        "পণ্যের নাম": i.name,
        "ক্যাটাগরি": i.category || 'সাধারণ',
        "একক": i.unit,
        "মোট প্রাপ্ত মালামাল": i.totalReceived,
        "প্যাকেজে বরাদ্দকৃত": i.allocatedToPackages,
        "গুদামে অবশিষ্ট স্টক": Math.max(0, i.totalReceived - i.allocatedToPackages),
        "মন্তব্য": i.notes || ''
      }));
      const wsItems = XLSX.utils.json_to_sheet(itemsData);
      XLSX.utils.book_append_sheet(wb, wsItems, "কাঁচামাল স্টক");

      // Packages sheet
      const packagesData = currentPackages.map(p => ({
        "প্যাকেজ আইডি": p.id,
        "প্যাকেজের নাম": p.name,
        "উপাদান তালিকা": p.items.map(r => `${r.itemName} (${r.quantityPerPackage} ${r.unit})`).join(', '),
        "প্রস্তুতকৃত প্যাকেজ": p.assembledQuantity,
        "প্রোগ্রামে বিতরণকৃত": distributedCount,
        "অবশিষ্ট বিতরণযোগ্য স্টক": Math.max(0, p.assembledQuantity - distributedCount)
      }));
      const wsPackages = XLSX.utils.json_to_sheet(packagesData);
      XLSX.utils.book_append_sheet(wb, wsPackages, "প্যাকেজ বান্ডেল");

      XLSX.writeFile(wb, `MWO_Inventory_${activeProgram.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showAlert('success', 'ইনভেন্টরি এক্সেল শিট ডাউনলোড সম্পন্ন হয়েছে!');
    } catch (e: any) {
      showAlert('error', `এক্সেল তৈরিতে ত্রুটি: ${e.message || e}`);
    }
  };

  // Export All Programs Inventory to Excel
  const handleExportAllProgramsInventory = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = programs.map(p => {
        const itemsCount = (p.inventoryItems || []).length;
        const assembledCount = (p.inventoryPackages || []).reduce((sum, pkg) => sum + (pkg.assembledQuantity || 0), 0);
        const dist = serviceRecords.filter(sr => sr.programId === p.id).reduce((sum, sr) => sum + sr.packageCount, 0);
        const remain = assembledCount > 0 ? Math.max(0, assembledCount - dist) : p.remainingStock;

        return {
          "প্রোগ্রাম আইডি": p.id,
          "প্রোগ্রামের নাম": p.name,
          "ক্যাটাগরি": p.type,
          "সুবিধাভোগী কমিউনিটি": p.beneficiaryCommunity,
          "উপাদান আইটেম ভ্যারাইটি": itemsCount,
          "প্যাকেজ রেসিপি সংখ্যা": (p.inventoryPackages || []).length,
          "মোট প্রস্তুতকৃত প্যাকেজ": assembledCount,
          "বিতরণকৃত প্যাকেজ": dist,
          "অবশিষ্ট বিতরণযোগ্য স্টক": remain,
          "মূল টার্গেট স্টক": p.targetStockSize
        };
      });
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "সকল প্রোগ্রাম ইনভেন্টরি");

      // All Items Sheet
      const allItems: any[] = [];
      programs.forEach(p => {
        (p.inventoryItems || []).forEach(item => {
          allItems.push({
            "প্রোগ্রাম": p.name,
            "আইটেম আইডি": item.id,
            "পণ্যের নাম": item.name,
            "ক্যাটাগরি": item.category,
            "একক": item.unit,
            "মোট প্রাপ্ত স্টক": item.totalReceived,
            "প্যাকেজিং-এ বরাদ্দকৃত": item.allocatedToPackages,
            "গুদামে অবশিষ্ট": Math.max(0, item.totalReceived - item.allocatedToPackages),
            "মন্তব্য": item.notes || ''
          });
        });
      });
      if (allItems.length > 0) {
        const wsItems = XLSX.utils.json_to_sheet(allItems);
        XLSX.utils.book_append_sheet(wb, wsItems, "সকল মালামাল স্টক");
      }

      // All Packages Sheet
      const allPackages: any[] = [];
      programs.forEach(p => {
        (p.inventoryPackages || []).forEach(pkg => {
          allPackages.push({
            "প্রোগ্রাম": p.name,
            "প্যাকেজ আইডি": pkg.id,
            "প্যাকেজের নাম": pkg.name,
            "উপাদান রেসিপি": pkg.items.map(i => `${i.itemName} (${i.quantityPerPackage} ${i.unit})`).join(', '),
            "প্রস্তুতকৃত সংখ্যা": pkg.assembledQuantity
          });
        });
      });
      if (allPackages.length > 0) {
        const wsPackages = XLSX.utils.json_to_sheet(allPackages);
        XLSX.utils.book_append_sheet(wb, wsPackages, "সকল প্যাকেজ রেসিপি");
      }

      XLSX.writeFile(wb, `MWO_Global_Inventory_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showAlert('success', 'সকল প্রোগ্রামের ইনভেন্টরি ডিরেক্টরি এক্সেল শিট সফলভাবে ডাউনলোড হয়েছে!');
    } catch (e: any) {
      showAlert('error', `এক্সেল এক্সপোর্টে ত্রুটি: ${e.message || e}`);
    }
  };

  if (!canManageInventory) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-rose-200 rounded-3xl text-center shadow-lg">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">ইনভেন্টরি অ্যাক্সেস সংরক্ষিত</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          আপনার অ্যাকাউন্টে ({currentUser.name} - {currentUser.role}) ইনভেন্টরি ও গুদাম স্টক ব্যবস্থাপনার অনুমতি প্রদান করা হয়নি। অনুগ্রহ করে সুপার এডমিনের সাথে যোগাযোগ করুন।
        </p>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-3xl text-center shadow-lg">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Boxes className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">কোনো সক্রিয় প্রোগ্রাম পাওয়া যায়নি</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          ইনভেন্টরি ও প্যাকেজ পরিচালনার জন্য প্রথমে প্রোগ্রাম ডিরেক্টরি থেকে একটি প্রোগ্রাম তৈরি করুন।
        </p>
        {onNavigateToProgramDirectory && (
          <button
            onClick={() => onNavigateToProgramDirectory()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 cursor-pointer"
          >
            প্রোগ্রাম তৈরি করতে যান &rarr;
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Alert Notification */}
      {alertMsg && (
        <div className={`p-4 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-md animate-fade-in ${
          alertMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' :
          alertMsg.type === 'error' ? 'bg-rose-50 text-rose-900 border border-rose-300' :
          'bg-sky-50 text-sky-900 border border-sky-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {alertMsg.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> :
             alertMsg.type === 'error' ? <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" /> :
             <Info className="w-5 h-5 text-sky-600 shrink-0" />}
            <span className="font-semibold leading-relaxed">{alertMsg.text}</span>
          </div>
          <button onClick={() => setAlertMsg(null)} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DIRECTORY VIEW: SHOWN WHEN NO SINGLE PROGRAM IS OPENED                 */}
      {/* ========================================================================= */}
      {!activeProgram ? (
        <div className="space-y-6 animate-fade-in">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-amber-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden border border-amber-900/30">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="p-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl">
                    <Boxes className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-amber-300 font-mono">
                    Program Inventory & Dynamic Packaging Directory
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  রিলিফ প্রোগ্রাম মালামাল ও প্যাকেজ ইনভেন্টরি ডিরেক্টরি
                </h1>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  প্রোগ্রাম ডিরেক্টরিতে তৈরি সকল প্রকল্পের তালিকা নিচে দেখুন। যেকোনো প্রোগ্রামের কার্ডে ক্লিক করে ভেতরে ঢুকে আলাদা পণ্যের তালিকা ও হিসাব রাখুন। সেখানে একাধিক পণ্য মিলিয়ে যতগুলো প্যাকেজ তৈরি করা হবে, তা সরাসরি মূল প্রোগ্রাম ডিরেক্টরিতে প্রদর্শিত হবে।
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                <button
                  onClick={handleExportAllProgramsInventory}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition shadow-md hover:scale-102"
                >
                  <Download className="w-4 h-4" />
                  <span>সকল ইনভেন্টরি এক্সেল ডাউনলোড</span>
                </button>
                {onNavigateToProgramDirectory && (
                  <button
                    onClick={() => onNavigateToProgramDirectory()}
                    className="bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <ArrowRight className="w-4 h-4 text-emerald-400" />
                    <span>মূল প্রোগ্রাম ডিরেক্টরি &rarr;</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Global KPI Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">মোট প্রোগ্রাম</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-800 font-mono">{programs.length}</span>
                <span className="text-xs text-slate-400 font-semibold">প্রকল্প</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">সক্রিয় বিতরণ ক্যাম্পেইন</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">মোট পণ্য উপাদান</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-indigo-700 font-mono">{globalMetrics.totalItemsCount}</span>
                <span className="text-xs text-slate-400 font-semibold">আইটেম</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">গুদামে প্রাপ্ত পণ্যের ধরন</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">মোট প্রস্তুতকৃত প্যাকেজ</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-600 font-mono">{globalMetrics.totalAssembledPackages}</span>
                <span className="text-xs text-slate-400 font-semibold">প্যাক</span>
              </div>
              <span className="text-[10px] text-amber-600 font-semibold block mt-1">প্যাকেজিং সম্পন্ন</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">বিতরণকৃত প্যাকেজ</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-blue-600 font-mono">{globalMetrics.totalDistributed}</span>
                <span className="text-xs text-slate-400 font-semibold">প্যাক</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">সুবিধাভোগীদের দেওয়া হয়েছে</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-xs col-span-2 md:col-span-1">
              <span className="text-[10px] font-bold text-emerald-800 block uppercase tracking-wider mb-1">বিতরণযোগ্য অবশিষ্ট প্যাক</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-700 font-mono">{globalMetrics.totalRemainingStock}</span>
                <span className="text-xs text-emerald-600 font-bold">প্যাক</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold block mt-1">গুদামে প্রস্তুত মজুদ</span>
            </div>
          </div>

          {/* Search, Filter & Quick Stats Bar */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="প্রোগ্রামের নাম, আইডি বা লোকেশন দিয়ে ইনভেন্টরি খুঁজুন..."
                value={directorySearchQuery}
                onChange={(e) => setDirectorySearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={directoryCategoryFilter}
                onChange={(e) => setDirectoryCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="ALL">সকল ক্যাটাগরি (All Programs)</option>
                <option value="Winter Relief">Winter Relief (শীতবস্ত্র)</option>
                <option value="Food Pack Drive">Food Pack Drive (খাদ্য সহায়তা)</option>
                <option value="Seasonal Program">Seasonal / Ramadan</option>
                <option value="Emergency Program">Emergency Flood Relief</option>
                <option value="Rohingya Program">Rohingya Humanitarian</option>
                <option value="Orphan Program">Orphan Core Care</option>
              </select>

              <span className="text-[11px] font-mono text-slate-400 px-2">
                {filteredDirectoryPrograms.length} টি প্রোগ্রাম
              </span>
            </div>
          </div>

          {/* Program Cards Grid (Exact matching ProgramDirectory layout) */}
          {filteredDirectoryPrograms.length === 0 ? (
            <div className="text-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-3xl">
              <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">কোনো প্রোগ্রাম মেলেনি</h4>
              <p className="text-xs text-slate-400 mt-1">অনুসন্ধান বা ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
              {filteredDirectoryPrograms.map(p => {
                const pItemsCount = (p.inventoryItems || []).length;
                const pAssembled = (p.inventoryPackages || []).reduce((sum, pkg) => sum + (pkg.assembledQuantity || 0), 0);
                const pDistributed = serviceRecords
                  .filter(sr => sr.programId === p.id)
                  .reduce((sum, sr) => sum + sr.packageCount, 0);
                const pTarget = pAssembled > 0 ? pAssembled : p.targetStockSize;
                const pRemaining = pAssembled > 0 ? Math.max(0, pAssembled - pDistributed) : p.remainingStock;
                const pPercent = pTarget > 0 ? Math.min(100, Math.round(((pTarget - pRemaining) / pTarget) * 100)) : 0;

                return (
                  <div
                    key={p.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4.5 flex flex-col hover:shadow-lg transition duration-200 relative overflow-hidden group hover:border-amber-300"
                  >
                    {/* Left Accent indicator */}
                    <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-amber-500"></div>

                    {/* Top Header: ID & Badge */}
                    <div className="flex justify-between items-start gap-2 mb-2 leading-tight">
                      <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider select-all">{p.id}</span>
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 font-bold px-2 py-0.5 rounded text-[8.5px] uppercase">
                        {p.type}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xs font-bold text-slate-850 group-hover:text-amber-700 transition leading-snug line-clamp-2 h-9 mb-1.5 font-display">
                      {p.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 mb-2 truncate">
                      👥 {p.beneficiaryCommunity}
                    </p>

                    {/* Dynamic Inventory & Packaging Status Box */}
                    <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 my-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-amber-950 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="text-[11px] font-bold">ইনভেন্টরি প্যাকেজ হিসাব:</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10.5px] font-mono font-black ${
                          pAssembled > 0 ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {pAssembled} টি প্যাক প্রস্তুত
                        </span>
                      </div>

                      {p.inventoryPackages && p.inventoryPackages.length > 0 ? (
                        <div className="space-y-1.5 mt-2 pt-2 border-t border-amber-200/60 text-[10.5px]">
                          <div className="flex flex-wrap gap-1">
                            {p.inventoryPackages.map((pkg, idx) => (
                              <span key={idx} className="bg-white border border-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[9.5px] font-semibold flex items-center gap-1">
                                <span>{pkg.name}:</span>
                                <strong className="text-amber-700 font-mono font-bold">{pkg.assembledQuantity} টি</strong>
                              </span>
                            ))}
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-amber-900 font-medium pt-0.5">
                            <span>অবশিষ্ট বিতরণযোগ্য: <strong className="text-emerald-700 font-bold">{pRemaining} টি</strong></span>
                            <span>উপাদান পণ্য: <strong className="text-slate-700">{pItemsCount} টি</strong></span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-800 pt-0.5 flex justify-between items-center">
                          <span>{pItemsCount > 0 ? `${pItemsCount} টি পণ্য স্টকে আছে (প্যাকেজ বানান)` : 'পণ্য ও প্যাকেজ খালি আছে'}</span>
                          <span className="font-bold text-amber-700">খুলুন &rarr;</span>
                        </div>
                      )}
                    </div>

                    {/* Progress Slider */}
                    <div className="mt-auto space-y-2 pt-2">
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                        <span>Target / মোট প্যাকেজ:</span>
                        <span className="text-slate-800 font-bold font-mono">
                          {pTarget} packs {pAssembled > 0 ? '(ইনভেন্টরি)' : ''}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                        <span>Distributed Served:</span>
                        <span className="text-amber-700 font-extrabold font-mono">{pTarget - pRemaining} packs</span>
                      </div>

                      <div>
                        <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          <span>বিতরণ অগ্রগতি (Progress)</span>
                          <span>{pPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${pPercent}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-[0.5px] bg-slate-100 w-full" />

                      {/* Action Buttons: Enter Program Inventory & Preview */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={() => handleSelectProgram(p.id)}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs hover:scale-101"
                          title="এই প্রোগ্রামের ভেতরে ঢুকে পণ্যের তালিকা ও প্যাকেজ তৈরি করুন"
                        >
                          <Boxes className="w-3.5 h-3.5" />
                          <span>ইনভেন্টরি খুলুন ও পরিচালনা করুন</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setPreviewProgram(p)}
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition shrink-0"
                          title="দ্রুত সারসংক্ষেপ প্রিভিউ"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>সারসংক্ষেপ</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. SELECTED PROGRAM INVENTORY WORKSPACE                                   */
        /* ========================================================================= */
        <div className="space-y-6 animate-fade-in">
          {/* Top Banner & Program Switcher */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-amber-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden border border-amber-900/30">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <button
                    onClick={() => handleSelectProgram(null)}
                    className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                    title="সকল প্রোগ্রামের ইনভেন্টরি ডিরেক্টরি তালিকায় ফিরে যান"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>← সব প্রোগ্রাম ইনভেন্টরি ডিরেক্টরি</span>
                  </button>

                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                    / {activeProgram.id}
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {activeProgram.name}
                </h1>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  এই প্রোগ্রামের আগত পণ্যের তালিকা ও হিসাব রাখুন, পণ্যগুলো মিলিয়ে প্যাকেজ তৈরি করুন। এখানে প্রস্তুতকৃত প্যাকেজ মূল প্রোগ্রাম ডিরেক্টরিতে স্বয়ংক্রিয়ভাবে দেখাবে।
                </p>
              </div>

              {/* Program Switcher Dropdown */}
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shrink-0 min-w-[280px] sm:min-w-[340px]">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                    অন্য প্রোগ্রাম নির্বাচন করুন:
                  </label>
                  <button
                    onClick={() => handleSelectProgram(null)}
                    className="text-[10px] text-amber-300 hover:underline font-bold cursor-pointer"
                  >
                    সব দেখুন &rarr;
                  </button>
                </div>
                <select
                  value={selectedProgramId || ''}
                  onChange={(e) => handleSelectProgram(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner"
                >
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))}
                </select>
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-300 font-mono border-t border-slate-700/60 pt-2">
                  <span>আইডি: <strong className="text-white">{activeProgram.id}</strong></span>
                  <span className="bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
                    {activeProgram.type}
                  </span>
                </div>
              </div>
            </div>
          </div>

      {/* Program Summary KPI Bar */}
      {activeProgram && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {/* Total Raw Item Varieties */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">মোট মালামাল ভ্যারাইটি</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-800 font-mono">{currentItems.length}</span>
              <span className="text-xs text-slate-400 font-semibold">আইটেম</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">গুদামে প্রাপ্ত পণ্যের ধরন</span>
          </div>

          {/* Configured Package Bundles */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">প্যাকেজ রেসিপি</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-indigo-700 font-mono">{currentPackages.length}</span>
              <span className="text-xs text-slate-400 font-semibold">বান্ডেল</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">কম্বাইন্ড প্যাক কনফিগারেশন</span>
          </div>

          {/* Total Assembled Packages */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">মোট প্রস্তুতকৃত প্যাকেজ</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-600 font-mono">{totalAssembled}</span>
              <span className="text-xs text-slate-400 font-semibold">প্যাক</span>
            </div>
            <span className="text-[10px] text-amber-600 font-semibold block mt-1">প্যাকিং সম্পন্ন হয়েছে</span>
          </div>

          {/* Distributed Packages */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">বিতরণকৃত প্যাকেজ</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-600 font-mono">{distributedCount}</span>
              <span className="text-xs text-slate-400 font-semibold">প্যাক</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">লাইভ বিতরণ ডেস্কে দেওয়া হয়েছে</span>
          </div>

          {/* Remaining Available Packages */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-xs col-span-2 md:col-span-4 lg:col-span-1">
            <span className="text-[10px] font-bold text-emerald-800 block uppercase tracking-wider mb-1">বিতরণযোগ্য অবশিষ্ট প্যাক</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-700 font-mono">{remainingPackages}</span>
              <span className="text-xs text-emerald-600 font-bold">প্যাক</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-bold block mt-1">
              {remainingPackages > 0 ? '✓ বিতরণের জন্য প্রস্তুত' : '⚠️ স্টক শেষ, অ্যাসেম্বল করুন'}
            </span>
          </div>
        </div>
      )}

      {/* Tabs Control & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('packages')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'packages'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>প্যাকেজ ব্যবস্থাপনা ও অ্যাসেম্বলি ({currentPackages.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'items'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>কাঁচামাল ও পণ্য স্টক ({currentItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>স্টক অডিট ও বিতরণ সারাংশ</span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'packages' && canCreatePackages && (
            <button
              onClick={() => setIsCreatePackageModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition"
            >
              <PackagePlus className="w-4 h-4" />
              <span>নতুন প্যাকেজ রেসিপি তৈরি</span>
            </button>
          )}

          {activeTab === 'items' && canAddItems && (
            <button
              onClick={() => setIsAddItemModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন মালামাল/পণ্য যোগ</span>
            </button>
          )}

          <button
            onClick={handleExportProgramInventory}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
            title="Export Excel report of this program inventory"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>এক্সেল এক্সপোর্ট</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PACKAGES & ASSEMBLY */}
      {activeTab === 'packages' && (
        <div className="space-y-4">
          {currentPackages.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-10 text-center">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Boxes className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">কোনো প্যাকেজ এখনো তৈরি করা হয়নি</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
                আপনার আগত মালামাল (যেমন: ব্লাঙ্কেট, জ্যাকেট, তেল, আটা ইত্যাদি) একাধিক আইটেম মিলিয়ে একটি কম্বাইন্ড প্যাকেজ রেসিপি তৈরি করুন।
              </p>
              {canCreatePackages ? (
                <button
                  onClick={() => setIsCreatePackageModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>প্রথম প্যাকেজ রেসিপি তৈরি করুন</span>
                </button>
              ) : (
                <span className="text-xs text-slate-400">আপনার প্যাকেজ তৈরির অনুমতি নেই।</span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {currentPackages.map(pkg => {
                const { maxUnits, bottleneckItem } = calculateMaxAssembleCapacity(pkg);
                const pkgServed = distributedCount; // In MWO, distributed portions track to program
                const pkgAvailable = Math.max(0, pkg.assembledQuantity - pkgServed);

                return (
                  <div key={pkg.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {pkg.id}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 font-mono">
                            {pkg.items.length} টি উপাদান
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 leading-snug">
                          {pkg.name}
                        </h3>
                        {pkg.description && (
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {pkg.description}
                          </p>
                        )}
                      </div>

                      {/* Delete Recipe Button */}
                      {canCreatePackages && pkg.assembledQuantity === 0 && (
                        <button
                          onClick={() => handleDeletePackage(pkg.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Constituent Items List */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 mb-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        প্রতি ১টি প্যাকেজের উপাদান তালিকা (Items per 1 Pack):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {pkg.items.map((item, idx) => {
                          const raw = currentItems.find(i => i.id === item.itemId);
                          const rawAvail = raw ? Math.max(0, raw.totalReceived - raw.allocatedToPackages) : 0;
                          return (
                            <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-slate-200/80">
                              <span className="font-semibold text-slate-700 truncate mr-2">
                                • {item.itemName}
                              </span>
                              <div className="text-right shrink-0">
                                <span className="font-bold text-indigo-600 font-mono">
                                  {item.quantityPerPackage} {item.unit}
                                </span>
                                <span className="text-[9.5px] text-slate-400 block font-mono">
                                  স্টকে: {rawAvail} {item.unit}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Assembly Stock Metrics */}
                    <div className="grid grid-cols-3 gap-2.5 mb-4 text-center">
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5">
                        <span className="text-[9.5px] font-bold text-amber-800 uppercase block tracking-wider">প্রস্তুতকৃত প্যাক</span>
                        <span className="text-lg font-black text-amber-700 font-mono">{pkg.assembledQuantity}</span>
                      </div>
                      <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2.5">
                        <span className="text-[9.5px] font-bold text-blue-800 uppercase block tracking-wider">বিতরণকৃত</span>
                        <span className="text-lg font-black text-blue-700 font-mono">{pkgServed}</span>
                      </div>
                      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5">
                        <span className="text-[9.5px] font-bold text-emerald-800 uppercase block tracking-wider">অবশিষ্ট বিতরণযোগ্য</span>
                        <span className="text-lg font-black text-emerald-700 font-mono">{pkgAvailable}</span>
                      </div>
                    </div>

                    {/* Smart Forecast Alert */}
                    <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 mb-4 flex items-start gap-2.5 text-xs text-amber-950">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span>গুদামে অবশিষ্ট মালামাল দিয়ে সর্বোচ্চ আরও </span>
                        <strong className="text-amber-700 font-mono text-sm">{maxUnits}</strong>
                        <span> টি প্যাকেজ প্রস্তুত করা সম্ভব।</span>
                        {bottleneckItem && (
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            (সীমাবদ্ধকারী উপাদান: {bottleneckItem})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: Assemble & Disassemble */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      {canAssemble && (
                        <button
                          onClick={() => {
                            setSelectedPackageForAssembly(pkg);
                            setAssembleCount(maxUnits > 0 ? Math.min(10, maxUnits) : 0);
                            setIsAssembleModalOpen(true);
                          }}
                          disabled={maxUnits === 0}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer disabled:cursor-not-allowed shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>প্যাকেজ অ্যাসেম্বল করুন</span>
                        </button>
                      )}

                      {canDisassemble && pkg.assembledQuantity > 0 && (
                        <button
                          onClick={() => {
                            setSelectedPackageForDisassemble(pkg);
                            setDisassembleCount(Math.min(5, pkgAvailable));
                            setIsDisassembleModalOpen(true);
                          }}
                          disabled={pkgAvailable === 0}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                          title="অ-বিতরণকৃত প্যাকেজ ভেঙে আবার স্টোরে মালামাল ফেরত নিন"
                        >
                          <Minus className="w-3.5 h-3.5" />
                          <span>আনপ্যাক</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RAW ITEMS STOCK TABLE */}
      {activeTab === 'items' && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                গুদামে প্রাপ্ত কাঁচামাল ও সামগ্রীর ইনভেন্টরি
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                কোন পণ্য কত পরিমাণ এসেছে, প্যাকেজে কতটুকু বরাদ্দ হয়েছে এবং অবশিষ্ট পরিমাণ।
              </p>
            </div>
            {canAddItems && (
              <button
                onClick={() => setIsAddItemModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>নতুন আইটেম যোগ</span>
              </button>
            )}
          </div>

          {currentItems.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-xs text-slate-400 mb-3">এই প্রোগ্রামে এখনো কোনো পণ্য এন্ট্রি করা হয়নি।</p>
              {canAddItems && (
                <button
                  onClick={() => setIsAddItemModalOpen(true)}
                  className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
                >
                  পণ্য এন্ট্রি করুন
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* MOBILE & TABLET RESPONSIVE CARDS (ZERO HORIZONTAL SCROLL) */}
              <div className="block lg:hidden divide-y divide-slate-100">
                {currentItems.map(item => {
                  const remainingInStore = Math.max(0, item.totalReceived - item.allocatedToPackages);
                  const isFullyAllocated = remainingInStore === 0;
                  const isLowStock = remainingInStore > 0 && remainingInStore < 50;

                  return (
                    <div key={item.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
                      {/* Top Row: Title, Category & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.id}
                            </span>
                            {item.category && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                                {item.category}
                              </span>
                            )}
                            <span className="text-[10px] bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                              একক: {item.unit}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isFullyAllocated ? (
                            <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2 py-1 rounded-full">
                              ১০০% বরাদ্দ
                            </span>
                          ) : isLowStock ? (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-1 rounded-full">
                              সীমিত স্টক
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-1 rounded-full">
                              পর্যাপ্ত স্টক
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes if available */}
                      {item.notes && (
                        <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                          💬 {item.notes}
                        </p>
                      )}

                      {/* 3 Metric Summary Boxes */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase block">মোট প্রাপ্ত</span>
                          <span className="text-base font-black text-slate-800 font-mono">{item.totalReceived}</span>
                          <span className="text-[9px] text-slate-400 block font-mono">{item.unit}</span>
                        </div>
                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2">
                          <span className="text-[9.5px] font-bold text-amber-700 uppercase block">প্যাকেজে বরাদ্দ</span>
                          <span className="text-base font-black text-amber-700 font-mono">{item.allocatedToPackages}</span>
                          <span className="text-[9px] text-amber-600/70 block font-mono">{item.unit}</span>
                        </div>
                        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2">
                          <span className="text-[9.5px] font-bold text-emerald-800 uppercase block">গুদামে অবশিষ্ট</span>
                          <span className="text-base font-black text-emerald-700 font-mono">{remainingInStore}</span>
                          <span className="text-[9px] text-emerald-600/70 block font-mono">{item.unit}</span>
                        </div>
                      </div>

                      {/* Control Buttons (1-Click Increments & Custom Adjustment) */}
                      {canAddItems && (
                        <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                          {/* Quick 1-click counter */}
                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                              onClick={() => handleQuickDecrement(item.id)}
                              disabled={remainingInStore <= 0}
                              className="w-8 h-8 rounded-lg bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-sm shadow-xs cursor-pointer transition active:scale-95"
                              title="১ টি কমান (-১)"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <div className="px-2.5 text-center">
                              <span className="text-xs font-black font-mono text-slate-800 block leading-tight">
                                {item.totalReceived}
                              </span>
                              <span className="text-[8.5px] text-slate-400 uppercase font-mono block">
                                পরিমাণ
                              </span>
                            </div>
                            <button
                              onClick={() => handleQuickIncrement(item.id)}
                              className="w-8 h-8 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 flex items-center justify-center font-bold text-sm shadow-xs cursor-pointer transition active:scale-95"
                              title="১ টি বাড়ান (+১)"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Custom Button (+/- Bulk like 500 pcs) */}
                          <button
                            onClick={() => handleOpenCustomStockModal(item, 'add')}
                            className="flex-1 min-w-[120px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition active:scale-95"
                            title="কাস্টম সংখ্যা যোগ বা বাদ দিন (যেমন ৫০০ বা ৬০০ পিস)"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>কাস্টম সমন্বয় (+/-)</span>
                          </button>

                          {/* Edit Item Button */}
                          <button
                            onClick={() => handleOpenEditItemModal(item)}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition cursor-pointer"
                            title="আইটেমের তথ্য এডিট করুন"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete Item Button */}
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW (CLEAN FULL-WIDTH, NO OVERFLOW) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">আইটেমের নাম ও ক্যাটাগরি</th>
                      <th className="py-3 px-4 text-center">একক (Unit)</th>
                      <th className="py-3 px-4 text-right">মোট প্রাপ্ত</th>
                      <th className="py-3 px-4 text-right">প্যাকেজে বরাদ্দকৃত</th>
                      <th className="py-3 px-4 text-right">গুদামে অবশিষ্ট</th>
                      <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                      <th className="py-3 px-4 text-center">স্টক সমন্বয় ও অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-xs">
                    {currentItems.map(item => {
                      const remainingInStore = Math.max(0, item.totalReceived - item.allocatedToPackages);
                      const isFullyAllocated = remainingInStore === 0;
                      const isLowStock = remainingInStore > 0 && remainingInStore < 50;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">{item.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-mono">{item.id}</span>
                              {item.category && (
                                <span className="text-[9.5px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                  {item.category}
                                </span>
                              )}
                              {item.notes && (
                                <span className="text-[10px] text-slate-400 italic">
                                  ({item.notes})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-600 font-mono">
                            {item.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-800 font-mono text-sm">
                            {item.totalReceived}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-amber-700 font-mono">
                            {item.allocatedToPackages}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-700 font-mono text-sm">
                            {remainingInStore}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isFullyAllocated ? (
                              <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                ১০০% বরাদ্দ
                              </span>
                            ) : isLowStock ? (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                সীমিত অবশিষ্ট
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                পর্যাপ্ত স্টক
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {canAddItems && (
                                <>
                                  {/* Quick 1-click counter box [-] count [+] */}
                                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 shadow-2xs">
                                    <button
                                      onClick={() => handleQuickDecrement(item.id)}
                                      disabled={remainingInStore <= 0}
                                      className="w-6 h-6 rounded bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-700 flex items-center justify-center text-xs font-bold transition active:scale-95 cursor-pointer"
                                      title="১ টি কমান (-১)"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="px-2 font-mono font-bold text-xs text-slate-800" title="বর্তমান স্টক">
                                      {item.totalReceived}
                                    </span>
                                    <button
                                      onClick={() => handleQuickIncrement(item.id)}
                                      className="w-6 h-6 rounded bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 flex items-center justify-center text-xs font-bold transition active:scale-95 cursor-pointer"
                                      title="১ টি বাড়ান (+১)"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Custom stock adjustment button */}
                                  <button
                                    onClick={() => handleOpenCustomStockModal(item, 'add')}
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition active:scale-95 shadow-2xs"
                                    title="কাস্টম স্টক যোগ বা বাদ দিন (যেমন ৫০০ বা ৬০০ পিস)"
                                  >
                                    <SlidersHorizontal className="w-3 h-3" />
                                    <span>কাস্টম</span>
                                  </button>

                                  {/* Edit item details button */}
                                  <button
                                    onClick={() => handleOpenEditItemModal(item)}
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 bg-indigo-50/40 rounded-lg transition cursor-pointer"
                                    title="তথ্য এডিট করুন"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {/* Delete raw item button */}
                              {canAddItems && (
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="মুছে ফেলুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STOCK AUDIT & DISTRIBUTION LEDGER */}
      {activeTab === 'audit' && activeProgram && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              {activeProgram.name} — সম্পূর্ণ স্টক অডিট ও লেজার
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              কাঁচামাল প্রাপ্তি, প্যাকেজ তৈরি এবং বিতরণ কার্যক্রমের লাইভ ডায়নামিক হিসাব।
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ধাপ ১: কাঁচামাল এন্ট্রি</span>
                <span className="text-xl font-black text-slate-800 font-mono">{currentItems.length} টি প্রোডাক্ট</span>
                <p className="text-[11px] text-slate-500 mt-1">গুদামে সংগৃহীত মালামাল ও চালান হিসাব।</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ধাপ ২: প্যাকেজিং রূপান্তর</span>
                <span className="text-xl font-black text-amber-700 font-mono">{totalAssembled} টি প্যাক প্রস্তুত</span>
                <p className="text-[11px] text-slate-500 mt-1">কাঁচামাল থেকে প্রস্তুতকৃত মোট প্যাকেজ সংখ্যা।</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ধাপ ৩: বিতরণ ও বর্তমান স্টক</span>
                <span className="text-xl font-black text-emerald-700 font-mono">{remainingPackages} টি প্যাক অবশিষ্ট</span>
                <p className="text-[11px] text-slate-500 mt-1">সুবিধাভোগীদের {distributedCount} টি প্রদানের পর অবশিষ্ট।</p>
              </div>
            </div>

            {/* Quick shortcut to Program Directory */}
            {onNavigateToProgramDirectory && (
              <div className="flex items-center justify-between p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">
                      প্রোগ্রাম ডিরেক্টরিতে এই স্টক বিতরণ করবেন?
                    </h4>
                    <p className="text-[11px] text-emerald-800">
                      প্রোগ্রাম ডিরেক্টরিতে গেলে স্বয়ংক্রিয়ভাবে {remainingPackages} টি প্যাকেজ হস্তান্তরের জন্য পাওয়া যাবে।
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onNavigateToProgramDirectory(activeProgram.id)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition"
                >
                  <span>প্রোগ্রাম ডেস্কে যান</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      )}

      {/* MODAL 1: ADD NEW RAW ITEM */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">নতুন পণ্য/মালামাল যোগ করুন</h3>
              </div>
              <button onClick={() => setIsAddItemModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewItem} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">পণ্যের নাম (Item Name) *</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="যেমন: উইন্টার ব্লাঙ্কেট, জ্যাকেট, চাল, চিনি, সয়াবিন তেল..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ক্যাটাগরি</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="শীতবস্ত্র">শীতবস্ত্র</option>
                    <option value="খাদ্যপণ্য">খাদ্যপণ্য</option>
                    <option value="শিশুপণ্য">শিশুপণ্য</option>
                    <option value="হাইজিন সামগ্রী">হাইজিন সামগ্রী</option>
                    <option value="মেডিকেল সামগ্রী">মেডিকেল সামগ্রী</option>
                    <option value="সাধারণ সামগ্রী">সাধারণ সামগ্রী</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">পরিমাপের একক (Unit)</label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="পিস (Pcs)">পিস (Pcs)</option>
                    <option value="কেজি (Kg)">কেজি (Kg)</option>
                    <option value="লিটার (Liter)">লিটার (Liter)</option>
                    <option value="প্যাকেট (Pkt)">প্যাকেট (Pkt)</option>
                    <option value="জোড়া (Pair)">জোড়া (Pair)</option>
                    <option value="সেট (Set)">সেট (Set)</option>
                    <option value="বস্তা (Bag)">বস্তা (Bag)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">মোট প্রাপ্ত মালামাল (Total Received Quantity) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newItemReceived}
                  onChange={(e) => setNewItemReceived(Number(e.target.value))}
                  placeholder="যেমন: 500"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">অতিরিক্ত বিবরণ বা নোট</label>
                <input
                  type="text"
                  value={newItemNotes}
                  onChange={(e) => setNewItemNotes(e.target.value)}
                  placeholder="যেমন: তুর্কি ফ্লিস, কোয়ালিটি গ্রেড ১..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer shadow-sm"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CUSTOM STOCK ADJUSTMENT (+ / - BULK 500, 600 PCS) */}
      {isCustomStockModalOpen && selectedItemForAdjustment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block font-mono">
                  CUSTOM STOCK CONTROLLER
                </span>
                <h3 className="text-sm font-bold text-slate-800">
                  কাস্টম স্টক সমন্বয়: {selectedItemForAdjustment.name}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsCustomStockModalOpen(false);
                  setSelectedItemForAdjustment(null);
                }} 
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCustomStockAdjustment} className="space-y-4 text-xs">
              {/* Current Status Card */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                <div>
                  <span className="text-[9.5px] text-slate-400 font-bold block uppercase">বর্তমান মোট</span>
                  <span className="text-sm font-black text-slate-800 font-mono">{selectedItemForAdjustment.totalReceived}</span>
                  <span className="text-[9px] text-slate-400 block font-mono">{selectedItemForAdjustment.unit}</span>
                </div>
                <div>
                  <span className="text-[9.5px] text-amber-700 font-bold block uppercase">প্যাকেজে বরাদ্দ</span>
                  <span className="text-sm font-black text-amber-700 font-mono">{selectedItemForAdjustment.allocatedToPackages}</span>
                  <span className="text-[9px] text-amber-600 block font-mono">{selectedItemForAdjustment.unit}</span>
                </div>
                <div>
                  <span className="text-[9.5px] text-emerald-700 font-bold block uppercase">গুদামে অবশিষ্ট</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">
                    {Math.max(0, selectedItemForAdjustment.totalReceived - selectedItemForAdjustment.allocatedToPackages)}
                  </span>
                  <span className="text-[9px] text-emerald-600 block font-mono">{selectedItemForAdjustment.unit}</span>
                </div>
              </div>

              {/* Mode Toggle: Add (+) vs Deduct (-) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  অ্যাকশন নির্বাচন করুন:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('add')}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                      adjustmentType === 'add'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>স্টক যোগ করুন (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentType('deduct')}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                      adjustmentType === 'deduct'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                    <span>স্টক বাদ দিন (-)</span>
                  </button>
                </div>
              </div>

              {/* Quick Presets Buttons */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                  দ্রুত সংখ্যা নির্বাচন (Quick Presets):
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[50, 100, 250, 500, 600, 1000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAdjustmentQuantity(val)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                        adjustmentQuantity === val
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {adjustmentType === 'add' ? `+${val}` : `-${val}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exact Quantity Input */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  কাস্টম সংখ্যা ({selectedItemForAdjustment.unit}) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={adjustmentType === 'deduct' ? Math.max(0, selectedItemForAdjustment.totalReceived - selectedItemForAdjustment.allocatedToPackages) : undefined}
                  value={adjustmentQuantity}
                  onChange={(e) => setAdjustmentQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-lg font-black font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                  placeholder="যেমন: 500"
                />
              </div>

              {/* Optional Reason / Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  কারণ বা মন্তব্য (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={adjustmentNote}
                  onChange={(e) => setAdjustmentNote(e.target.value)}
                  placeholder="যেমন: নতুন অনুদান চালান, ত্রুটি সংশোধন, বা ক্ষতিপূরণ..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Live Preview Calculation */}
              {(() => {
                const qty = Number(adjustmentQuantity) || 0;
                const newTotal = adjustmentType === 'add'
                  ? selectedItemForAdjustment.totalReceived + qty
                  : Math.max(selectedItemForAdjustment.allocatedToPackages, selectedItemForAdjustment.totalReceived - qty);
                const newRemaining = Math.max(0, newTotal - selectedItemForAdjustment.allocatedToPackages);

                return (
                  <div className={`p-3 rounded-2xl border text-xs font-mono ${
                    adjustmentType === 'add' ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-rose-50/70 border-rose-200 text-rose-950'
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span>পরিবর্তনের প্রভাব:</span>
                      <strong className="text-sm">
                        {adjustmentType === 'add' ? `+${qty}` : `-${qty}`} {selectedItemForAdjustment.unit}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-600">
                      <span>সমন্বয় পরবর্তী নতুন মোট স্টক:</span>
                      <strong className="font-bold text-slate-800">{newTotal} {selectedItemForAdjustment.unit}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-600 mt-0.5">
                      <span>গুদামে নতুন অবশিষ্ট থাকবে:</span>
                      <strong className="font-bold text-emerald-700">{newRemaining} {selectedItemForAdjustment.unit}</strong>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomStockModalOpen(false);
                    setSelectedItemForAdjustment(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white rounded-xl font-bold cursor-pointer shadow-sm transition ${
                    adjustmentType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {adjustmentType === 'add' ? 'স্টক যোগ নিশ্চিত করুন' : 'স্টক বাদ দিন নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2.5: EDIT RAW ITEM */}
      {isEditItemModalOpen && selectedItemForEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block font-mono">
                  EDIT INVENTORY ITEM
                </span>
                <h3 className="text-sm font-bold text-slate-800">
                  আইটেমের তথ্য এডিট করুন: {selectedItemForEdit.name}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsEditItemModalOpen(false);
                  setSelectedItemForEdit(null);
                }} 
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditItem} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">পণ্যের নাম *</label>
                <input
                  type="text"
                  required
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  placeholder="যেমন: কম্বল, চাল, তেল..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ক্যাটাগরি</label>
                  <select
                    value={editItemCategory}
                    onChange={(e) => setEditItemCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="শীতবস্ত্র">শীতবস্ত্র</option>
                    <option value="খাদ্যপণ্য">খাদ্যপণ্য</option>
                    <option value="শিশুপণ্য">শিশুপণ্য</option>
                    <option value="হাইজিন সামগ্রী">হাইজিন সামগ্রী</option>
                    <option value="মেডিকেল সামগ্রী">মেডিকেল সামগ্রী</option>
                    <option value="সাধারণ সামগ্রী">সাধারণ সামগ্রী</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">পরিমাপের একক</label>
                  <select
                    value={editItemUnit}
                    onChange={(e) => setEditItemUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="পিস (Pcs)">পিস (Pcs)</option>
                    <option value="কেজি (Kg)">কেজি (Kg)</option>
                    <option value="লিটার (Liter)">লিটার (Liter)</option>
                    <option value="প্যাকেট (Pkt)">প্যাকেট (Pkt)</option>
                    <option value="জোড়া (Pair)">জোড়া (Pair)</option>
                    <option value="সেট (Set)">সেট (Set)</option>
                    <option value="বস্তা (Bag)">বস্তা (Bag)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  মোট প্রাপ্ত স্টক (Total Received) *
                </label>
                <input
                  type="number"
                  required
                  min={selectedItemForEdit.allocatedToPackages}
                  value={editItemReceived}
                  onChange={(e) => setEditItemReceived(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                />
                {selectedItemForEdit.allocatedToPackages > 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    ⚠️ দ্রষ্টব্য: ইতোমধ্যে {selectedItemForEdit.allocatedToPackages} {selectedItemForEdit.unit} প্যাকেজে বরাদ্দ আছে। মোট প্রাপ্ত এর কম করা যাবে না।
                  </p>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">বিবরণ বা নোট</label>
                <input
                  type="text"
                  value={editItemNotes}
                  onChange={(e) => setEditItemNotes(e.target.value)}
                  placeholder="যেমন: কোয়ালিটি গ্রেড, বিশেষ নির্দেশনা..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditItemModalOpen(false);
                    setSelectedItemForEdit(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition"
                >
                  পরিবর্তন সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2.8: QUICK STOCK IN */}
      {isStockInModalOpen && selectedItemForStockIn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                স্টক ইন: {selectedItemForStockIn.name}
              </h3>
              <button onClick={() => setIsStockInModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 space-y-1 font-mono">
                <div>বর্তমান মোট প্রাপ্ত: <strong>{selectedItemForStockIn.totalReceived} {selectedItemForStockIn.unit}</strong></div>
                <div>প্যাকেজে ব্যবহৃত: <strong>{selectedItemForStockIn.allocatedToPackages} {selectedItemForStockIn.unit}</strong></div>
                <div className="text-emerald-700 font-bold">গুদামে অবশিষ্ট: <strong>{Math.max(0, selectedItemForStockIn.totalReceived - selectedItemForStockIn.allocatedToPackages)} {selectedItemForStockIn.unit}</strong></div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  নতুন চালানে কতটুকু মালামাল এসেছে? ({selectedItemForStockIn.unit}) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={stockInQuantity}
                  onChange={(e) => setStockInQuantity(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base font-bold font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStockInModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleStockIn}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer shadow-sm"
                >
                  স্টক যোগ নিশ্চিত করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ASSEMBLE PACKAGES */}
      {isAssembleModalOpen && selectedPackageForAssembly && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Package Assembly Desk</span>
                <h3 className="text-sm font-bold text-slate-800">
                  প্যাকেজ প্রস্তুত করুন: {selectedPackageForAssembly.name}
                </h3>
              </div>
              <button onClick={() => setIsAssembleModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const { maxUnits, bottleneckItem } = calculateMaxAssembleCapacity(selectedPackageForAssembly);
              return (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 leading-relaxed">
                    গুদামে বিদ্যমান কাঁচামাল দিয়ে আপনি সর্বোচ্চ <strong className="font-mono text-sm text-amber-800">{maxUnits}</strong> টি প্যাকেজ তৈরি করতে পারবেন।
                    {bottleneckItem && <div className="text-[11px] text-slate-500 mt-0.5 font-medium">সীমাবদ্ধকারী আইটেম: {bottleneckItem}</div>}
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      আপনি কয়টি প্যাকেজ প্রস্তুত করতে চান? (Number of Packages to Assemble) *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={maxUnits}
                        value={assembleCount}
                        onChange={(e) => setAssembleCount(Math.max(1, Number(e.target.value)))}
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-3 text-lg font-bold font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setAssembleCount(maxUnits)}
                        className="px-3 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold font-mono text-xs cursor-pointer"
                      >
                        সর্বোচ্চ ({maxUnits})
                      </button>
                    </div>
                  </div>

                  {/* Deduction Preview */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      এই অ্যাসেম্বলির ফলে গুদাম থেকে যে মালামাল কাটা যাবে:
                    </span>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      {selectedPackageForAssembly.items.map((req, idx) => {
                        const needed = req.quantityPerPackage * assembleCount;
                        const raw = currentItems.find(i => i.id === req.itemId);
                        const available = raw ? Math.max(0, raw.totalReceived - raw.allocatedToPackages) : 0;
                        return (
                          <div key={idx} className="flex justify-between items-center text-slate-700">
                            <span>• {req.itemName}:</span>
                            <span className="font-bold text-emerald-700">
                              -{needed} {req.unit} (অবশিষ্ট থাকবে: {available - needed} {req.unit})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAssembleModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="button"
                      disabled={assembleCount <= 0 || assembleCount > maxUnits}
                      onClick={handleAssemblePackages}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold cursor-pointer shadow-sm transition"
                    >
                      অ্যাসেম্বল নিশ্চিত করুন
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL 4: DISASSEMBLE / UNPACK */}
      {isDisassembleModalOpen && selectedPackageForDisassemble && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Disassemble Packages</span>
                <h3 className="text-sm font-bold text-slate-800">
                  প্যাকেজ ভেঙে মালামাল গুদামে ফেরত
                </h3>
              </div>
              <button onClick={() => setIsDisassembleModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                তৈরিকৃত কিন্তু এখনও অ-বিতরণকৃত প্যাকেজ ভেঙে এর ভেতরে থাকা সমস্ত পণ্য পুনরায় গুদামের কাঁচামাল স্টকে ফিরিয়ে আনা হবে।
              </p>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  কয়টি প্যাকেজ আনপ্যাক করবেন? *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedPackageForDisassemble.assembledQuantity}
                  value={disassembleCount}
                  onChange={(e) => setDisassembleCount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-lg font-bold font-mono text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDisassembleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleDisassemblePackages}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer shadow-sm transition"
                >
                  আনপ্যাক নিশ্চিত করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CREATE NEW PACKAGE RECIPE */}
      {isCreatePackageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">নতুন প্যাকেজ বান্ডেল রেসিপি তৈরি</h3>
                  <span className="text-[10px] text-slate-400 font-mono">{activeProgram?.name}</span>
                </div>
              </div>
              <button onClick={() => setIsCreatePackageModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">প্যাকেজের নাম (Package Name) *</label>
                <input
                  type="text"
                  required
                  value={newPackageName}
                  onChange={(e) => setNewPackageName(e.target.value)}
                  placeholder="যেমন: উইন্টার ফ্যামিলি প্যাক, স্পেশাল চাইল্ড কিট, জরুরি ফুড প্যাক..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">প্যাকেজের বিবরণ (Description)</label>
                <input
                  type="text"
                  value={newPackageDescription}
                  onChange={(e) => setNewPackageDescription(e.target.value)}
                  placeholder="যেমন: ১টি ব্লাঙ্কেট, ১টি জ্যাকেট, ১টি শাল এবং ১ জোড়া গ্লাভস..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Select Items to include in 1 package */}
              <div>
                <label className="font-bold text-slate-700 block mb-2">
                  ১টি প্যাকেজে কোন কোন পণ্য কতটুকু থাকবে? (Select Items & Quantity per 1 Pack) *
                </label>

                {currentItems.length === 0 ? (
                  <p className="text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                    আগে গুদামে কাঁচামাল/পণ্য যোগ করুন, তারপর সেগুলো দিয়ে প্যাকেজ তৈরি করা যাবে।
                  </p>
                ) : (
                  <div className="space-y-2 border border-slate-200 rounded-2xl p-3 bg-slate-50/50 max-h-56 overflow-y-auto">
                    {currentItems.map(item => {
                      const isSelected = selectedRecipeItems.some(r => r.itemId === item.id);
                      const currentQty = selectedRecipeItems.find(r => r.itemId === item.id)?.quantity || 1;
                      const remainingInStore = Math.max(0, item.totalReceived - item.allocatedToPackages);

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                            isSelected 
                              ? 'bg-white border-indigo-300 shadow-2xs' 
                              : 'bg-white/60 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer select-none flex-1 truncate mr-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecipeItems([...selectedRecipeItems, { itemId: item.id, quantity: 1 }]);
                                } else {
                                  setSelectedRecipeItems(selectedRecipeItems.filter(r => r.itemId !== item.id));
                                }
                              }}
                              className="w-4 h-4 text-indigo-600 rounded cursor-pointer accent-indigo-600"
                            />
                            <span className="font-bold text-slate-800 truncate">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({remainingInStore} {item.unit} স্টকে)</span>
                          </label>

                          {isSelected && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-slate-400">প্রতি প্যাকেজে:</span>
                              <input
                                type="number"
                                min="1"
                                value={currentQty}
                                onChange={(e) => {
                                  const val = Math.max(1, Number(e.target.value));
                                  setSelectedRecipeItems(selectedRecipeItems.map(r => 
                                    r.itemId === item.id ? { ...r, quantity: val } : r
                                  ));
                                }}
                                className="w-16 bg-slate-50 border border-indigo-300 rounded-lg py-1 px-2 text-xs font-bold font-mono text-center text-indigo-700 focus:outline-none"
                              />
                              <span className="text-[10px] text-slate-500 font-bold">{item.unit}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatePackageModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={selectedRecipeItems.length === 0}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-bold cursor-pointer shadow-sm transition"
                >
                  প্যাকেজ রেসিপি সংরক্ষণ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK PREVIEW MODAL IN DIRECTORY VIEW */}
      {previewProgram && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
              <div>
                <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase font-mono">
                  {previewProgram.type} • {previewProgram.id}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{previewProgram.name}</h3>
                <p className="text-[11px] text-slate-400">👥 {previewProgram.beneficiaryCommunity}</p>
              </div>
              <button 
                onClick={() => setPreviewProgram(null)} 
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content summary */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto text-xs pr-1">
              {/* Packages */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <h5 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-amber-600" />
                  <span>প্যাকেজ রেসিপি ও প্রস্তুত সংখ্যা ({previewProgram.inventoryPackages?.length || 0})</span>
                </h5>
                {(!previewProgram.inventoryPackages || previewProgram.inventoryPackages.length === 0) ? (
                  <p className="text-slate-400 text-[11px]">কোনো প্যাকেজ এখনো তৈরি করা হয়নি।</p>
                ) : (
                  <div className="space-y-2">
                    {previewProgram.inventoryPackages.map(pkg => (
                      <div key={pkg.id} className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <div className="flex justify-between font-bold text-slate-800 mb-1">
                          <span>{pkg.name}</span>
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono text-[10px]">
                            {pkg.assembledQuantity} টি প্রস্তুত
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {pkg.items.map(i => `${i.itemName} (${i.quantityPerPackage} ${i.unit})`).join(' + ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Raw Items */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <h5 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>গুদামে প্রাপ্ত কাঁচামাল ও মালামাল তালিকা ({previewProgram.inventoryItems?.length || 0})</span>
                </h5>
                {(!previewProgram.inventoryItems || previewProgram.inventoryItems.length === 0) ? (
                  <p className="text-slate-400 text-[11px]">কোনো মালামাল তালিকাভুক্ত হয়নি।</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {previewProgram.inventoryItems.map(item => {
                      const avail = Math.max(0, item.totalReceived - item.allocatedToPackages);
                      return (
                        <div key={item.id} className="bg-white p-2 rounded-xl border border-slate-200 flex justify-between items-center text-[11px]">
                          <span className="font-medium text-slate-700 truncate mr-1">{item.name}</span>
                          <span className="font-mono font-bold text-emerald-700 shrink-0">{avail} {item.unit} বাকি</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setPreviewProgram(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer text-xs"
              >
                বন্ধ করুন
              </button>
              <button
                onClick={() => {
                  const id = previewProgram.id;
                  setPreviewProgram(null);
                  handleSelectProgram(id);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer text-xs flex items-center gap-1.5 shadow-sm"
              >
                <span>এই প্রোগ্রামের ইনভেন্টরি খুলুন</span> &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
