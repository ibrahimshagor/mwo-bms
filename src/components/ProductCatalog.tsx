import React, { useState, useMemo } from 'react';
import { CatalogProduct, OfficeWarehouse, Program, User, WarehouseProductStock } from '../types';
import { useLanguage } from '../context/LanguageContext';
import * as XLSX from 'xlsx';
import { 
  Package, Boxes, Search, Plus, Edit3, Trash2, Download, 
  Building2, Warehouse, AlertTriangle, CheckCircle, ArrowRight, 
  Layers, Filter, ChevronRight, Eye, RefreshCw, X, TrendingUp,
  Tag, Info, PlusCircle, MinusCircle, ShoppingCart
} from 'lucide-react';

interface ProductCatalogProps {
  products: CatalogProduct[];
  facilities: OfficeWarehouse[];
  programs: Program[];
  currentUser: User;
  onUpdateProducts: (updatedProducts: CatalogProduct[]) => void;
  onNavigateToWarehouse?: (warehouseId?: string) => void;
  onNavigateToInventory?: (programId?: string) => void;
}

export default function ProductCatalog({
  products,
  facilities,
  programs,
  currentUser,
  onUpdateProducts,
  onNavigateToWarehouse,
  onNavigateToInventory
}: ProductCatalogProps) {
  const { isEn, isBn } = useLanguage();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modal states
  const [selectedProductForBreakdown, setSelectedProductForBreakdown] = useState<CatalogProduct | null>(null);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);

  // Quick Warehouse Stock Adjust state within Breakdown modal
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [adjustWarehouseName, setAdjustWarehouseName] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'deduct' | 'set'>('add');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(100);
  const [adjustNote, setAdjustNote] = useState('');

  // Add/Edit Product form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('খাদ্যপণ্য');
  const [formUnit, setFormUnit] = useState('কেজি (Kg)');
  const [formSku, setFormSku] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMinStockAlert, setFormMinStockAlert] = useState<number>(100);
  const [formNotes, setFormNotes] = useState('');
  const [formWarehouseStocks, setFormWarehouseStocks] = useState<{ [wh: string]: number }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<CatalogProduct | null>(null);

  // Available warehouses list from facilities database and programs
  const availableWarehouses = useMemo(() => {
    const list: string[] = [];
    facilities.forEach(f => {
      if (f.name && !list.includes(f.name)) {
        list.push(f.name);
      }
    });
    // Add default fallbacks if empty
    if (list.length === 0) {
      list.push('ময়মনসিংহ', 'কক্সবাজার', 'খুলনা', 'মিরপুর গুদাম', 'মোহাম্মদপুর গুদাম');
    }
    return list;
  }, [facilities]);

  // Categories list
  const categories = [
    { id: 'খাদ্যপণ্য', en: 'Food Supplies', bn: 'খাদ্যপণ্য' },
    { id: 'শীতবস্ত্র', en: 'Winter Clothing', bn: 'শীতবস্ত্র' },
    { id: 'স্যানিটেশন সামগ্রী', en: 'Sanitation & Hygiene', bn: 'স্যানিটেশন ও হাইজিন' },
    { id: 'শিশুপণ্য', en: 'Baby & Child Care', bn: 'শিশুপণ্য' },
    { id: 'মেডিকেল সামগ্রী', en: 'Medical & First Aid', bn: 'মেডিকেল ও প্রাথমিক চিকিৎসা' },
    { id: 'অন্যান্য', en: 'General Logistics', bn: 'অন্যান্য সামগ্রী' }
  ];

  // Helper to calculate total stock of a product across all warehouses
  const getProductTotalStock = (p: CatalogProduct): number => {
    if (!p.warehouseStocks) return 0;
    return Object.values(p.warehouseStocks).reduce((sum, wh) => sum + (wh.currentStock || 0), 0);
  };

  // Helper to calculate stock in a specific warehouse
  const getProductWarehouseStock = (p: CatalogProduct, whName: string): number => {
    return p.warehouseStocks?.[whName]?.currentStock || 0;
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.warehouseStocks && Object.keys(p.warehouseStocks).some(wh => wh.toLowerCase().includes(q)));

      const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;

      const matchesWarehouse = warehouseFilter === 'ALL' || 
        (p.warehouseStocks && (p.warehouseStocks[warehouseFilter]?.currentStock || 0) > 0);

      const totalStock = getProductTotalStock(p);
      const isLow = p.minStockAlert ? totalStock <= p.minStockAlert : totalStock <= 50;
      const matchesLowStock = !onlyLowStock || isLow;

      return matchesSearch && matchesCategory && matchesWarehouse && matchesLowStock;
    });
  }, [products, searchQuery, categoryFilter, warehouseFilter, onlyLowStock]);

  // Aggregated summary metrics
  const summaryMetrics = useMemo(() => {
    const totalItems = products.length;
    let totalStockUnits = 0;
    let lowStockCount = 0;
    const warehousesSet = new Set<string>();

    products.forEach(p => {
      const tStock = getProductTotalStock(p);
      totalStockUnits += tStock;
      const alertThreshold = p.minStockAlert || 50;
      if (tStock <= alertThreshold) {
        lowStockCount++;
      }
      if (p.warehouseStocks) {
        Object.keys(p.warehouseStocks).forEach(wh => {
          if ((p.warehouseStocks![wh]?.currentStock || 0) > 0) {
            warehousesSet.add(wh);
          }
        });
      }
    });

    return {
      totalItems,
      totalStockUnits,
      activeWarehousesCount: warehousesSet.size,
      lowStockCount
    };
  }, [products]);

  // Handle open Add Modal
  const handleOpenAddModal = () => {
    setFormName('');
    setFormCategory('খাদ্যপণ্য');
    setFormUnit('কেজি (Kg)');
    setFormSku(`PRD-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormDescription('');
    setFormMinStockAlert(100);
    setFormNotes('');
    // Initialize warehouse stocks with 0
    const initialStocks: { [wh: string]: number } = {};
    availableWarehouses.forEach(wh => {
      initialStocks[wh] = 0;
    });
    setFormWarehouseStocks(initialStocks);
    setFormError(null);
    setIsAddProductModalOpen(true);
  };

  // Handle open Edit Modal
  const handleOpenEditModal = (p: CatalogProduct) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category || 'খাদ্যপণ্য');
    setFormUnit(p.unit || 'পিস (Pcs)');
    setFormSku(p.sku || '');
    setFormDescription(p.description || '');
    setFormMinStockAlert(p.minStockAlert || 100);
    setFormNotes(p.notes || '');

    const currentStocks: { [wh: string]: number } = {};
    availableWarehouses.forEach(wh => {
      currentStocks[wh] = p.warehouseStocks?.[wh]?.currentStock || 0;
    });
    // Also include any other warehouses existing on this product
    if (p.warehouseStocks) {
      Object.keys(p.warehouseStocks).forEach(wh => {
        if (!(wh in currentStocks)) {
          currentStocks[wh] = p.warehouseStocks![wh].currentStock || 0;
        }
      });
    }

    setFormWarehouseStocks(currentStocks);
    setFormError(null);
    setIsEditProductModalOpen(true);
  };

  // Save new Product
  const handleSaveNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError(isEn ? 'Please enter a valid product name.' : 'অনুগ্রহ করে পণ্যের সঠিক নাম প্রদান করুন।');
      return;
    }

    const newWarehouseStocks: { [wh: string]: WarehouseProductStock } = {};
    Object.entries(formWarehouseStocks).forEach(([wh, qty]) => {
      const numQty = Number(qty) || 0;
      if (numQty > 0) {
        newWarehouseStocks[wh] = {
          warehouseName: wh,
          currentStock: numQty,
          totalReceived: numQty,
          allocatedOrDispatched: 0,
          updatedAt: new Date().toISOString()
        };
      }
    });

    const newProd: CatalogProduct = {
      id: `PROD-${Date.now().toString().slice(-4)}`,
      name: formName.trim(),
      category: formCategory,
      unit: formUnit,
      sku: formSku.trim() || undefined,
      description: formDescription.trim() || undefined,
      minStockAlert: Number(formMinStockAlert) || 50,
      notes: formNotes.trim() || undefined,
      warehouseStocks: newWarehouseStocks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onUpdateProducts([newProd, ...products]);
    setIsAddProductModalOpen(false);
  };

  // Save edited Product
  const handleSaveEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!formName.trim()) {
      setFormError(isEn ? 'Please enter a valid product name.' : 'অনুগ্রহ করে পণ্যের সঠিক নাম প্রদান করুন।');
      return;
    }

    const updatedWarehouseStocks: { [wh: string]: WarehouseProductStock } = {};
    Object.entries(formWarehouseStocks).forEach(([wh, qty]) => {
      const existing = editingProduct.warehouseStocks?.[wh];
      updatedWarehouseStocks[wh] = {
        warehouseName: wh,
        currentStock: Math.max(0, Number(qty) || 0),
        totalReceived: existing?.totalReceived ? Math.max(existing.totalReceived, Number(qty)) : Number(qty) || 0,
        allocatedOrDispatched: existing?.allocatedOrDispatched || 0,
        notes: existing?.notes,
        updatedAt: new Date().toISOString()
      };
    });

    const updatedProd: CatalogProduct = {
      ...editingProduct,
      name: formName.trim(),
      category: formCategory,
      unit: formUnit,
      sku: formSku.trim() || undefined,
      description: formDescription.trim() || undefined,
      minStockAlert: Number(formMinStockAlert) || 50,
      notes: formNotes.trim() || undefined,
      warehouseStocks: updatedWarehouseStocks,
      updatedAt: new Date().toISOString()
    };

    const updatedList = products.map(p => p.id === editingProduct.id ? updatedProd : p);
    onUpdateProducts(updatedList);
    if (selectedProductForBreakdown?.id === editingProduct.id) {
      setSelectedProductForBreakdown(updatedProd);
    }
    setIsEditProductModalOpen(false);
  };

  // Delete product controller
  const handleDeleteProduct = (prodId: string, _prodName: string) => {
    const target = products.find(p => p.id === prodId);
    if (target) {
      setProductToDelete(target);
    }
  };

  const confirmDeleteProduct = () => {
    if (!productToDelete) return;
    const updatedList = products.filter(p => p.id !== productToDelete.id);
    onUpdateProducts(updatedList);
    if (selectedProductForBreakdown?.id === productToDelete.id) {
      setSelectedProductForBreakdown(null);
    }
    setProductToDelete(null);
  };

  // Quick Warehouse stock adjustment in modal
  const handleQuickAdjustWarehouseStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForBreakdown || !adjustWarehouseName) return;

    const qty = Number(adjustQuantity) || 0;
    if (qty <= 0 && adjustType !== 'set') return;

    const currentWhStock = selectedProductForBreakdown.warehouseStocks?.[adjustWarehouseName]?.currentStock || 0;
    let newQty = currentWhStock;

    if (adjustType === 'add') {
      newQty = currentWhStock + qty;
    } else if (adjustType === 'deduct') {
      newQty = Math.max(0, currentWhStock - qty);
    } else if (adjustType === 'set') {
      newQty = Math.max(0, qty);
    }

    const existingWhEntry = selectedProductForBreakdown.warehouseStocks?.[adjustWarehouseName];
    const updatedStocks = {
      ...(selectedProductForBreakdown.warehouseStocks || {}),
      [adjustWarehouseName]: {
        warehouseName: adjustWarehouseName,
        currentStock: newQty,
        totalReceived: adjustType === 'add' ? (existingWhEntry?.totalReceived || 0) + qty : (existingWhEntry?.totalReceived || newQty),
        allocatedOrDispatched: adjustType === 'deduct' ? (existingWhEntry?.allocatedOrDispatched || 0) + qty : (existingWhEntry?.allocatedOrDispatched || 0),
        notes: adjustNote.trim() || existingWhEntry?.notes,
        updatedAt: new Date().toISOString()
      }
    };

    const updatedProd: CatalogProduct = {
      ...selectedProductForBreakdown,
      warehouseStocks: updatedStocks,
      updatedAt: new Date().toISOString()
    };

    const updatedList = products.map(p => p.id === selectedProductForBreakdown.id ? updatedProd : p);
    onUpdateProducts(updatedList);
    setSelectedProductForBreakdown(updatedProd);
    setIsAdjustStockOpen(false);
    setAdjustQuantity(100);
    setAdjustNote('');
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const exportRows = filteredProducts.map(p => {
        const total = getProductTotalStock(p);
        const whBreakdown = p.warehouseStocks 
          ? Object.entries(p.warehouseStocks as Record<string, WarehouseProductStock>)
              .filter(([_, wh]) => ((wh as WarehouseProductStock).currentStock || 0) > 0)
              .map(([whName, wh]) => `${whName}: ${(wh as WarehouseProductStock).currentStock} ${p.unit}`)
              .join(' | ')
          : 'None';

        return {
          'Product Code / ID': p.id,
          'Product Name': p.name,
          'SKU / Barcode': p.sku || 'N/A',
          'Category': p.category,
          'Measurement Unit': p.unit,
          'Combined Total Stock': total,
          'Min Alert Threshold': p.minStockAlert || 50,
          'Warehouse Stock Breakdown': whBreakdown,
          'Notes': p.notes || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Product Catalog & Stocks');
      XLSX.writeFile(workbook, `MWO_Central_Products_Catalog_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  const isSuperAdmin = currentUser.role === 'SuperAdmin';
  const canManage = isSuperAdmin || currentUser.role === 'InventoryManager' || currentUser.permissions?.canManageInventory;

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-1 sm:px-0">
      
      {/* 1. Header & Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                <Package className="w-5 h-5" />
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 font-display uppercase tracking-wider">
                {isEn ? 'Central Product Catalog & Stock' : 'সেন্ট্রাল প্রোডাক্ট ক্যাটালগ ও মোট মজুদ'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isEn 
                ? 'Centralized master inventory of all goods with real-time per-warehouse breakdown and stock search.' 
                : 'সকল ত্রাণ সামগ্রীর কেন্দ্রীয় ক্যাটালগ: প্রতিটি গুদামের মজুদ আলাদা ও মোট পরিমাণ এক নজরে হিসাব করুন।'}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={handleExportExcel}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer flex-1 sm:flex-initial shadow-2xs"
              title={isEn ? 'Export to Excel' : 'এক্সেল ডাউনলোড'}
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>{isEn ? 'Export Excel' : 'এক্সপোর্ট'}</span>
            </button>

            {canManage && (
              <button
                onClick={handleOpenAddModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer flex-1 sm:flex-initial shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'Add New Product' : 'নতুন প্রোডাক্ট'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Top Metric KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mt-3.5">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono">
                {isEn ? 'Catalog Products' : 'মোট প্রোডাক্ট'}
              </span>
              <Package className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {summaryMetrics.totalItems}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {isEn ? 'Registered master items' : 'নিবন্ধিত অনন্য পণ্য'}
            </p>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono">
                {isEn ? 'Total Units In-Stock' : 'সর্বমোট মজুদ ইউনিট'}
              </span>
              <Boxes className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-700 font-mono">
              {summaryMetrics.totalStockUnits.toLocaleString()}
            </div>
            <p className="text-[10px] text-emerald-600/80 mt-0.5">
              {isEn ? 'Across all warehouses' : 'সব গুদাম মিলিয়ে মোট'}
            </p>
          </div>

          <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-3">
            <div className="flex items-center justify-between text-sky-700 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono">
                {isEn ? 'Warehouses Holding' : 'মজুদযুক্ত গুদাম'}
              </span>
              <Warehouse className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-lg sm:text-xl font-black text-sky-800 font-mono">
              {summaryMetrics.activeWarehousesCount}
            </div>
            <p className="text-[10px] text-sky-600/80 mt-0.5">
              {isEn ? 'Depots with active stock' : 'সক্রিয় স্টোরেজ ডিপো'}
            </p>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3">
            <div className="flex items-center justify-between text-amber-700 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono">
                {isEn ? 'Low Stock Alerts' : 'রিঅর্ডার সতর্কতা'}
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-800 font-mono">
              {summaryMetrics.lowStockCount}
            </div>
            <p className="text-[10px] text-amber-600/80 mt-0.5">
              {isEn ? 'Below minimum threshold' : 'ন্যূনতম পরিমাণের নিচে'}
            </p>
          </div>
        </div>

        {/* 3. Search and Filters Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col md:flex-row gap-2.5 items-stretch md:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={isEn 
                ? "Search product by name (e.g. Rice/চাউল), SKU, or warehouse name..." 
                : "পণ্য খুঁজুন: নাম (যেমন চাউল/Rice), কোড, বা গুদামের নাম দিয়ে সার্চ করুন..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium bg-white outline-none focus:border-amber-500"
          >
            <option value="ALL">{isEn ? 'All Categories' : 'সকল ক্যাটাগরি'}</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {isEn ? cat.en : cat.bn}
              </option>
            ))}
          </select>

          {/* Warehouse Filter */}
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium bg-white outline-none focus:border-amber-500"
          >
            <option value="ALL">{isEn ? 'All Warehouses (সকল গুদাম)' : 'সকল গুদাম (সকল অঞ্চল)'}</option>
            {availableWarehouses.map(wh => (
              <option key={wh} value={wh}>{wh}</option>
            ))}
          </select>

          {/* Low Stock Toggle & View Mode Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setOnlyLowStock(!onlyLowStock)}
              className={`text-xs px-2.5 py-2 rounded-xl font-bold flex items-center gap-1 transition cursor-pointer border ${
                onlyLowStock 
                  ? 'bg-amber-500 text-white border-amber-600' 
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEn ? 'Low Stock' : 'কম স্টক'}</span>
            </button>

            <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Card Grid View"
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Table View"
              >
                Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Products Listing */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">
            {isEn ? 'No products match your criteria' : 'কোনো প্রোডাক্টের তথ্য পাওয়া যায়নি'}
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery 
              ? (isEn ? `No product matching "${searchQuery}". Try a different keyword.` : `"${searchQuery}" এর জন্য কোনো প্রোডাক্ট পাওয়া যায়নি।`) 
              : (isEn ? 'Click "Add New Product" to register your first product.' : 'নতুন প্রোডাক্ট যুক্ত করতে "নতুন প্রোডাক্ট" বাটনে চাপ দিন।')}
          </p>
          {canManage && (
            <button
              onClick={handleOpenAddModal}
              className="mt-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              {isEn ? 'Add Product Now' : 'নতুন প্রোডাক্ট যোগ করুন'}
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* CARD GRID VIEW: Beautiful on Mobile & Desktop without horizontal sliding */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredProducts.map((p) => {
            const totalStock = getProductTotalStock(p);
            const isLow = p.minStockAlert ? totalStock <= p.minStockAlert : totalStock <= 50;
            const isOutOfStock = totalStock <= 0;
            const stockEntries = p.warehouseStocks 
              ? Object.entries(p.warehouseStocks as Record<string, WarehouseProductStock>)
                  .filter(([_, wh]) => ((wh as WarehouseProductStock).currentStock || 0) > 0) 
              : [];

            return (
              <div 
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-4.5 hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Category & Stock Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase">
                      {p.category || 'সাধারণ'}
                    </span>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isOutOfStock 
                        ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                        : isLow 
                        ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isOutOfStock ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      {isOutOfStock 
                        ? (isEn ? 'Out of Stock' : 'স্টক শেষ') 
                        : isLow 
                        ? (isEn ? 'Low Stock' : 'কম স্টক') 
                        : (isEn ? 'In Stock' : 'পর্যাপ্ত স্টক')}
                    </span>
                  </div>

                  {/* Product Title & SKU */}
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                      {p.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                      <span>ID: {p.id}</span>
                      {p.sku && <span>&bull; SKU: {p.sku}</span>}
                    </div>
                  </div>

                  {/* Combined Stock Banner Highlight */}
                  <div className="bg-amber-50/40 border border-amber-100/80 rounded-xl p-2.5 mb-3 flex items-center justify-between">
                    <div>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-700 block">
                        {isEn ? 'Combined Total Stock' : 'সবগুলো গুদাম মিলিয়ে মোট'}
                      </span>
                      <div className="text-base sm:text-lg font-black text-slate-900 font-mono leading-none mt-0.5">
                        {totalStock.toLocaleString()} <span className="text-xs font-bold text-slate-600">{p.unit}</span>
                      </div>
                    </div>
                    <span className="p-2 rounded-lg bg-amber-500/10 text-amber-700">
                      <Boxes className="w-5 h-5" />
                    </span>
                  </div>

                  {/* Warehouse breakdown pills preview */}
                  <div className="space-y-1.5 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center justify-between">
                      <span>{isEn ? 'Per Warehouse Stocks' : 'গুদামভিত্তিক মজুদ'}</span>
                      <span className="text-slate-500">{stockEntries.length} {isEn ? 'depots' : 'গুদাম'}</span>
                    </span>

                    {stockEntries.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic bg-slate-50 p-2 rounded-lg text-center">
                        {isEn ? 'No warehouse stock assigned yet.' : 'বর্তমানে কোনো গুদামে মালামাল বরাদ্দ নেই।'}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {stockEntries.map(([whName, wh]) => (
                          <span 
                            key={whName}
                            className="inline-flex items-center gap-1 text-[11px] bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-lg font-medium"
                          >
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-semibold">{whName}:</span>
                            <span className="font-mono font-bold text-slate-900">{(wh as WarehouseProductStock).currentStock} {p.unit}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons: thumb friendly */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedProductForBreakdown(p);
                      setIsAdjustStockOpen(false);
                    }}
                    className="flex-1 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isEn ? 'View Breakdown' : 'গুদাম হিসাব ও বিস্তারিত'}</span>
                  </button>

                  {canManage && (
                    <>
                      <button
                        onClick={() => handleOpenEditModal(p)}
                        className="p-2 text-slate-500 hover:text-amber-700 border border-slate-200 hover:bg-amber-50 rounded-xl transition cursor-pointer"
                        title={isEn ? 'Edit Product' : 'সম্পাদনা'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id, p.name)}
                        className="p-2 text-slate-400 hover:text-rose-700 border border-slate-200 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title={isEn ? 'Delete Product' : 'মুছে ফেলুন'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW (RESPONSIVE) */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  <th className="p-3">{isEn ? 'Product Name & Category' : 'পণ্যের নাম ও ক্যাটাগরি'}</th>
                  <th className="p-3">{isEn ? 'Combined Stock' : 'সর্বমোট মজুদ'}</th>
                  <th className="p-3">{isEn ? 'Warehouses Breakdown' : 'গুদামভিত্তিক হিসাব'}</th>
                  <th className="p-3">{isEn ? 'Status' : 'স্ট্যাটাস'}</th>
                  <th className="p-3 text-right">{isEn ? 'Actions' : 'অ্যাকশন'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const totalStock = getProductTotalStock(p);
                  const isLow = p.minStockAlert ? totalStock <= p.minStockAlert : totalStock <= 50;
                  const isOutOfStock = totalStock <= 0;
                  const stockEntries = p.warehouseStocks 
                    ? Object.entries(p.warehouseStocks as Record<string, WarehouseProductStock>)
                        .filter(([_, wh]) => ((wh as WarehouseProductStock).currentStock || 0) > 0) 
                    : [];

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                          <span>{p.category}</span>
                          {p.sku && <span>&bull; SKU: {p.sku}</span>}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-mono font-black text-slate-900 text-sm">
                          {totalStock.toLocaleString()} <span className="text-xs font-semibold text-slate-500">{p.unit}</span>
                        </div>
                        {p.minStockAlert && (
                          <div className="text-[9.5px] text-slate-400 font-mono">
                            Alert at &le; {p.minStockAlert}
                          </div>
                        )}
                      </td>

                      <td className="p-3 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {stockEntries.length === 0 ? (
                            <span className="text-slate-400 text-[10px] italic">No active stock</span>
                          ) : (
                            stockEntries.map(([whName, wh]) => (
                              <span 
                                key={whName}
                                className="inline-block bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono"
                              >
                                {whName}: <b>{(wh as WarehouseProductStock).currentStock}</b>
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          isOutOfStock 
                            ? 'bg-rose-50 text-rose-700' 
                            : isLow 
                            ? 'bg-amber-50 text-amber-700' 
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isOutOfStock ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          {isOutOfStock ? 'Empty' : isLow ? 'Low' : 'OK'}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedProductForBreakdown(p);
                              setIsAdjustStockOpen(false);
                            }}
                            className="bg-slate-50 hover:bg-emerald-50 border border-slate-200 text-slate-700 hover:text-emerald-700 p-1.5 rounded-lg transition cursor-pointer"
                            title={isEn ? 'View Breakdown' : 'গুদাম বিবরণ'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(p)}
                                className="border border-slate-200 text-slate-500 hover:text-amber-700 hover:bg-amber-50 p-1.5 rounded-lg transition cursor-pointer"
                                title={isEn ? 'Edit' : 'সম্পাদনা'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                className="border border-slate-200 text-slate-400 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer"
                                title={isEn ? 'Delete' : 'মুছে ফেলুন'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
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

      {/* ========================================================================= */}
      {/* 5. MODAL: DETAILED WAREHOUSE BREAKDOWN & QUICK ADJUST */}
      {/* ========================================================================= */}
      {selectedProductForBreakdown && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-4 sm:p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Close */}
            <button
              onClick={() => setSelectedProductForBreakdown(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 rounded-md bg-amber-50 text-amber-600">
                <Package className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">
                {selectedProductForBreakdown.id} &bull; {selectedProductForBreakdown.category}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 font-display leading-tight">
              {selectedProductForBreakdown.name}
            </h3>

            {/* Total Combined Stock Highlight Box */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl p-4 mt-3 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100 block">
                  {isEn ? 'Combined Stock Across All Warehouses' : 'সকল গুদাম মিলিয়ে মোট বর্তমান মজুদ'}
                </span>
                <div className="text-2xl font-black font-mono mt-0.5">
                  {getProductTotalStock(selectedProductForBreakdown).toLocaleString()}{' '}
                  <span className="text-sm font-semibold text-amber-100">{selectedProductForBreakdown.unit}</span>
                </div>
              </div>
              <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                <Boxes className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Warehouse Breakdown List / Table */}
            <div className="mt-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  {isEn ? 'Depot / Warehouse Breakdown' : 'গুদামভিত্তিক মজুদের হিসাব'}
                </h4>
                {canManage && (
                  <button
                    onClick={() => {
                      setIsAdjustStockOpen(!isAdjustStockOpen);
                      setAdjustWarehouseName(availableWarehouses[0] || 'ময়মনসিংহ');
                    }}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{isEn ? '+ Adjust / Inflow' : '+ স্টক ইন / সমন্বয়'}</span>
                  </button>
                )}
              </div>

              {/* Quick Stock Adjustment sub-panel */}
              {isAdjustStockOpen && (
                <form 
                  onSubmit={handleQuickAdjustWarehouseStock}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 my-3 space-y-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      {isEn ? 'Quick Stock Adjustment' : 'গুদামে দ্রুত স্টক পরিবর্তন / যোগ'}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setIsAdjustStockOpen(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        {isEn ? 'Select Warehouse' : 'গুদাম নির্বাচন'}
                      </label>
                      <select
                        value={adjustWarehouseName}
                        onChange={(e) => setAdjustWarehouseName(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white text-slate-800"
                      >
                        {availableWarehouses.map(wh => (
                          <option key={wh} value={wh}>{wh}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        {isEn ? 'Operation' : 'অ্যাকশন'}
                      </label>
                      <select
                        value={adjustType}
                        onChange={(e) => setAdjustType(e.target.value as any)}
                        className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white text-slate-800 font-bold"
                      >
                        <option value="add">{isEn ? '+ Add Stock' : '+ স্টক বৃদ্ধি (যোগ)'}</option>
                        <option value="deduct">{isEn ? '- Deduct Stock' : '- স্টক হ্রাস (বিয়োগ)'}</option>
                        <option value="set">{isEn ? '= Set Exact' : '= সরাসরি মান সেট'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        {isEn ? `Quantity (${selectedProductForBreakdown.unit})` : `পরিমাণ (${selectedProductForBreakdown.unit})`}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={adjustQuantity}
                        onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                        className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white text-slate-800 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      {isEn ? 'Reason / Reference Note' : 'নোট বা চালানের বিবরণ (ঐচ্ছিক)'}
                    </label>
                    <input
                      type="text"
                      placeholder={isEn ? "e.g. New supplier shipment, damaged stock, etc." : "যেমন: নতুন চালান গ্রহণ, স্থানান্তর, ইত্যাদি"}
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white text-slate-800"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAdjustStockOpen(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      {isEn ? 'Cancel' : 'বাতিল'}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer shadow-xs"
                    >
                      {isEn ? 'Apply Adjustment' : 'হিসাব আপডেট করুন'}
                    </button>
                  </div>
                </form>
              )}

              {/* Warehouse Table */}
              <div className="space-y-2 mt-3">
                {Object.keys(selectedProductForBreakdown.warehouseStocks || {}).length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl">
                    {isEn ? 'No stock registered in any warehouse.' : 'কোনো গুদামে মালামালের রেকর্ড নেই।'}
                  </div>
                ) : (
                  Object.entries(selectedProductForBreakdown.warehouseStocks as Record<string, WarehouseProductStock> || {}).map(([whName, whEntry]) => {
                    const wh = whEntry as WarehouseProductStock;
                    const total = getProductTotalStock(selectedProductForBreakdown);
                    const percentage = total > 0 ? Math.round(((wh.currentStock || 0) / total) * 100) : 0;

                    return (
                      <div 
                        key={whName}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{whName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({percentage}% {isEn ? 'of total' : 'মোট মজুদের'})
                            </span>
                          </div>

                          {/* Progress bar of warehouse proportion */}
                          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div 
                              className="bg-amber-500 h-full rounded-full transition-all duration-300" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>

                          {wh.notes && (
                            <p className="text-[10px] text-slate-500 italic mt-1.5">
                              {wh.notes}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-base font-black font-mono text-slate-900">
                            {wh.currentStock?.toLocaleString() || 0}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 ml-1">
                            {selectedProductForBreakdown.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Product Details Specs */}
            {(selectedProductForBreakdown.description || selectedProductForBreakdown.notes) && (
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                <span className="font-bold text-slate-700 block mb-1">
                  {isEn ? 'Specifications & Notes:' : 'পণ্যের বিবরণ ও নোট:'}
                </span>
                <p className="text-slate-600 leading-relaxed">
                  {selectedProductForBreakdown.description || selectedProductForBreakdown.notes}
                </p>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              {canManage && (
                <button
                  onClick={() => {
                    handleOpenEditModal(selectedProductForBreakdown);
                  }}
                  className="text-xs text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Edit Product Details' : 'প্রোডাক্ট এডিট করুন'}</span>
                </button>
              )}

              <button
                onClick={() => setSelectedProductForBreakdown(null)}
                className="ml-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer"
              >
                {isEn ? 'Close' : 'বন্ধ করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: ADD / REGISTER NEW PRODUCT */}
      {/* ========================================================================= */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-4 sm:p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setIsAddProductModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                <Plus className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 font-display">
                {isEn ? 'Register New Product in Catalog' : 'ক্যাটালগে নতুন প্রোডাক্ট যুক্ত করুন'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {isEn 
                ? 'Add standard goods and allocate initial stocks across your warehouses.' 
                : 'সকল গুদামে হিসাব করার জন্য নতুন প্রোডাক্টের নাম, একক ও প্রাথমিক স্টক দিন।'}
            </p>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-2.5 rounded-xl mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNewProduct} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isEn ? 'Product Name *' : 'প্রোডাক্টের নাম *'}
                </label>
                <input
                  type="text"
                  placeholder={isEn ? "e.g. Miniket Rice / চাল" : "যেমন: মিনিকেট চাল (Miniket Rice), সয়াবিন তেল, কম্বল ইত্যাদি"}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isEn ? 'Category' : 'ক্যাটাগরি'}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 bg-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{isEn ? c.en : c.bn}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isEn ? 'Unit of Measurement' : 'পরিমাপের একক'}
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 bg-white font-medium"
                  >
                    <option value="কেজি (Kg)">কেজি (Kg)</option>
                    <option value="পিস (Pcs)">পিস (Pcs)</option>
                    <option value="লিটার (Liter)">লিটার (Liter)</option>
                    <option value="প্যাকেট (Pkt)">প্যাকেট (Pkt)</option>
                    <option value="বস্তা (Bag)">বস্তা (Bag)</option>
                    <option value="জোড়া (Pair)">জোড়া (Pair)</option>
                    <option value="সেট (Set)">সেট (Set)</option>
                    <option value="কার্টন (Carton)">কার্টন (Carton)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isEn ? 'SKU / Barcode Code' : 'এসকেইউ / কোড'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FOOD-RICE-01"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isEn ? 'Min Stock Warning' : 'রিঅর্ডার সতর্কবার্তা সীমা'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinStockAlert}
                    onChange={(e) => setFormMinStockAlert(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Warehouse Initial Stock Allocations */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  {isEn ? 'Initial Stock Per Warehouse' : 'বিভিন্ন গুদামে প্রাথমিক মজুদ নির্ধারণ'}
                </span>
                <p className="text-[11px] text-slate-500">
                  {isEn 
                    ? 'Enter the current stock for each warehouse (leave 0 if not stored there):' 
                    : 'কোন গুদামে কতটুকু আছে তা লিখুন (যেমন: গুদাম ক-তে ২০০ কেজি, গুদাম খ-তে ৩০০ কেজি):'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {availableWarehouses.map(wh => (
                    <div key={wh} className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">{wh}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={formWarehouseStocks[wh] || 0}
                          onChange={(e) => setFormWarehouseStocks({
                            ...formWarehouseStocks,
                            [wh]: Math.max(0, Number(e.target.value) || 0)
                          })}
                          className="w-20 border border-slate-200 rounded px-1.5 py-1 text-xs text-right font-mono font-bold text-slate-900"
                        />
                        <span className="text-[10px] text-slate-400 font-mono">{formUnit.split(' ')[0]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isEn ? 'Description / Specifications (Optional)' : 'বিবরণ বা প্যাকেজিং তথ্য (ঐচ্ছিক)'}
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={isEn ? "e.g. 50kg bag packing, refined quality" : "যেমন: ৫০ কেজি বস্তা, প্রিমিয়াম গ্রেড"}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'বাতিল'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer shadow-xs"
                >
                  {isEn ? 'Save Product' : 'প্রোডাক্ট সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: EDIT PRODUCT */}
      {/* ========================================================================= */}
      {isEditProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-4 sm:p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setIsEditProductModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 rounded-md bg-amber-50 text-amber-600">
                <Edit3 className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 font-display">
                {isEn ? 'Edit Product Details' : 'প্রোডাক্ট তথ্য সম্পাদনা'}
              </h3>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-2.5 rounded-xl mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditProduct} className="space-y-3.5 mt-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isEn ? 'Product Name *' : 'প্রোডাক্টের নাম *'}
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isEn ? 'Category' : 'ক্যাটাগরি'}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 bg-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{isEn ? c.en : c.bn}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isEn ? 'Unit' : 'একক'}
                  </label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isEn ? 'SKU' : 'এসকেইউ কোড'}
                  </label>
                  <input
                    type="text"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isEn ? 'Min Alert Threshold' : 'সতর্কবার্তা সীমা'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinStockAlert}
                    onChange={(e) => setFormMinStockAlert(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Warehouse Stocks */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  {isEn ? 'Stock Quantity In Each Warehouse' : 'প্রতিটি গুদামে বর্তমান মজুদ'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {Object.keys(formWarehouseStocks).map(wh => (
                    <div key={wh} className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">{wh}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={formWarehouseStocks[wh] || 0}
                          onChange={(e) => setFormWarehouseStocks({
                            ...formWarehouseStocks,
                            [wh]: Math.max(0, Number(e.target.value) || 0)
                          })}
                          className="w-20 border border-slate-200 rounded px-1.5 py-1 text-xs text-right font-mono font-bold text-slate-900"
                        />
                        <span className="text-[10px] text-slate-400 font-mono">{formUnit.split(' ')[0]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isEn ? 'Notes' : 'নোট'}
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditProductModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'বাতিল'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white rounded-xl cursor-pointer shadow-xs"
                >
                  {isEn ? 'Update Product' : 'আপডেট করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {isEn ? 'Delete Product?' : 'প্রোডাক্ট মুছে ফেলবেন?'}
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  {productToDelete.id}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {isEn 
                ? `Are you sure you want to permanently delete "${productToDelete.name}" from the central product catalog? This will remove all associated warehouse counts.`
                : `আপনি কি নিশ্চিতভাবে সেন্ট্রাল ক্যাটালগ থেকে "${productToDelete.name}" মুছে ফেলতে চান? এতে এই পণ্যের সকল গুদামের হিসাব মুছে যাবে।`}
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                {isEn ? 'Cancel' : 'বাতিল'}
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer shadow-xs"
              >
                {isEn ? 'Yes, Delete' : 'হ্যাঁ, মুছে ফেলুন'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
