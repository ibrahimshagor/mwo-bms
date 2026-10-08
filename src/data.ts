import { User, Program, Beneficiary, ServiceRecord } from './types';

// Default system-admin, staff, and donor credentials
export const DEFAULT_USERS: User[] = [
  { 
    id: 'admin', 
    name: 'Md. Ibrahim Hossain', 
    role: 'SuperAdmin',
    permissions: {
      canManageInventory: true,
      canAddInventoryItems: true,
      canCreatePackages: true,
      canAssemblePackages: true,
      canDisassemblePackages: true,
      canDistributePackages: true,
      canManagePrograms: true,
      canManageBeneficiaries: true,
    }
  },
  { 
    id: 'inventory1', 
    name: 'Tareq Rahman (Store Keeper)', 
    role: 'InventoryManager',
    permissions: {
      canManageInventory: true,
      canAddInventoryItems: true,
      canCreatePackages: true,
      canAssemblePackages: true,
      canDisassemblePackages: true,
      canDistributePackages: false,
      canManagePrograms: false,
      canManageBeneficiaries: false,
    }
  },
  { 
    id: 'field1', 
    name: 'Field Admin Shagor', 
    role: 'FieldAdmin',
    permissions: {
      canManageInventory: true,
      canAddInventoryItems: true,
      canCreatePackages: false,
      canAssemblePackages: true,
      canDisassemblePackages: false,
      canDistributePackages: true,
      canManagePrograms: false,
      canManageBeneficiaries: true,
    }
  },
  { id: 'donor1', name: 'Mr. ABC (Donor)', role: 'Donor' },
  { id: 'donor2', name: 'Al-Khair Trust', role: 'Donor' }
];

// Seed initial distributions programs with rich dynamic inventory
export const DEFAULT_PROGRAMS: Program[] = [
  {
    id: 'MWO-PRG-1001',
    name: 'Rohingya Camp Winter Blanket Drive',
    type: 'Winter Program',
    donors: ['donor1', 'donor2'],
    beneficiaryCommunity: 'Rohingya Community',
    programDate: '2026-11-15',
    programDuration: '2 Weeks',
    targetStockSize: 500,
    remainingStock: 497,
    warehouses: ['ময়মনসিংহ', 'কক্সবাজার', 'খুলনা'],
    inventoryItems: [
      { 
        id: 'ITEM-101', 
        programId: 'MWO-PRG-1001', 
        name: 'ব্লাঙ্কেট (Heavy Blanket)', 
        category: 'শীতবস্ত্র', 
        unit: 'পিস (Pcs)', 
        totalReceived: 600, 
        allocatedToPackages: 500, 
        warehouseStocks: {
          'ময়মনসিংহ': { totalReceived: 300, allocatedToPackages: 250 },
          'কক্সবাজার': { totalReceived: 200, allocatedToPackages: 150 },
          'খুলনা': { totalReceived: 100, allocatedToPackages: 100 }
        },
        notes: 'তুর্কি ফ্লিস ডাবল লেয়ার' 
      },
      { 
        id: 'ITEM-102', 
        programId: 'MWO-PRG-1001', 
        name: 'উইন্টার জ্যাকেট (Jacket)', 
        category: 'শীতবস্ত্র', 
        unit: 'পিস (Pcs)', 
        totalReceived: 550, 
        allocatedToPackages: 500, 
        warehouseStocks: {
          'ময়মনসিংহ': { totalReceived: 275, allocatedToPackages: 250 },
          'কক্সবাজার': { totalReceived: 175, allocatedToPackages: 150 },
          'খুলনা': { totalReceived: 100, allocatedToPackages: 100 }
        },
        notes: 'ওয়াটারপ্রুফ প্যাডেড' 
      },
      { 
        id: 'ITEM-103', 
        programId: 'MWO-PRG-1001', 
        name: 'উলের সোয়েটার (Woolen Sweater)', 
        category: 'শীতবস্ত্র', 
        unit: 'পিস (Pcs)', 
        totalReceived: 520, 
        allocatedToPackages: 500, 
        warehouseStocks: {
          'ময়মনসিংহ': { totalReceived: 260, allocatedToPackages: 250 },
          'কক্সবাজার': { totalReceived: 160, allocatedToPackages: 150 },
          'খুলনা': { totalReceived: 100, allocatedToPackages: 100 }
        }
      },
      { 
        id: 'ITEM-104', 
        programId: 'MWO-PRG-1001', 
        name: 'উষ্ণ কাশ্মীরি শাল (Warm Shawl)', 
        category: 'শীতবস্ত্র', 
        unit: 'পিস (Pcs)', 
        totalReceived: 500, 
        allocatedToPackages: 500, 
        warehouseStocks: {
          'ময়মনসিংহ': { totalReceived: 250, allocatedToPackages: 250 },
          'কক্সবাজার': { totalReceived: 150, allocatedToPackages: 150 },
          'খুলনা': { totalReceived: 100, allocatedToPackages: 100 }
        }
      },
      { 
        id: 'ITEM-105', 
        programId: 'MWO-PRG-1001', 
        name: 'উলের গ্লাভস (Winter Gloves)', 
        category: 'শীতবস্ত্র', 
        unit: 'জোড়া (Pair)', 
        totalReceived: 550, 
        allocatedToPackages: 500, 
        warehouseStocks: {
          'ময়মনসিংহ': { totalReceived: 275, allocatedToPackages: 250 },
          'কক্সবাজার': { totalReceived: 175, allocatedToPackages: 150 },
          'খুলনা': { totalReceived: 100, allocatedToPackages: 100 }
        }
      },
      { 
        id: 'ITEM-106', 
        programId: 'MWO-PRG-1001', 
        name: 'মাফলার (Woolen Muffler)', 
        category: 'শীতবস্ত্র', 
        unit: 'পিস (Pcs)', 
        totalReceived: 500, 
        allocatedToPackages: 500, 
        warehouseStocks: {
          'ময়মনসিংহ': { totalReceived: 250, allocatedToPackages: 250 },
          'কক্সবাজার': { totalReceived: 150, allocatedToPackages: 150 },
          'খুলনা': { totalReceived: 100, allocatedToPackages: 100 }
        }
      },
      { 
        id: 'ITEM-107', 
        programId: 'MWO-PRG-1001', 
        name: 'বেবি উইন্টার স্যুট (Baby Winter Set)', 
        category: 'শিশুপণ্য', 
        unit: 'সেট (Set)', 
        totalReceived: 200, 
        allocatedToPackages: 0, 
        warehouseStocks: {
          'ময়মনসিংহ': { totalReceived: 100, allocatedToPackages: 0 },
          'কক্সবাজার': { totalReceived: 60, allocatedToPackages: 0 },
          'খুলনা': { totalReceived: 40, allocatedToPackages: 0 }
        },
        notes: 'অতিরিক্ত রিজার্ভ স্টক' 
      }
    ],
    inventoryPackages: [
      {
        id: 'PKG-1001',
        programId: 'MWO-PRG-1001',
        name: 'Winter Warmth Family Pack (শীতকালীন পোশাক ফ্যামিলি প্যাক)',
        description: '১টি ব্লাঙ্কেট + ১টি জ্যাকেট + ১টি সোয়েটার + ১টি শাল + ১ জোড়া গ্লাভস + ১টি মাফলার সমন্বিত পূর্ণাঙ্গ কম্বাইন্ড ফ্যামিলি প্যাক',
        items: [
          { itemId: 'ITEM-101', itemName: 'ব্লাঙ্কেট (Heavy Blanket)', quantityPerPackage: 1, unit: 'পিস (Pcs)' },
          { itemId: 'ITEM-102', itemName: 'উইন্টার জ্যাকেট (Jacket)', quantityPerPackage: 1, unit: 'পিস (Pcs)' },
          { itemId: 'ITEM-103', itemName: 'উলের সোয়েটার (Woolen Sweater)', quantityPerPackage: 1, unit: 'পিস (Pcs)' },
          { itemId: 'ITEM-104', itemName: 'উষ্ণ কাশ্মীরি শাল (Warm Shawl)', quantityPerPackage: 1, unit: 'পিস (Pcs)' },
          { itemId: 'ITEM-105', itemName: 'উলের গ্লাভস (Winter Gloves)', quantityPerPackage: 1, unit: 'জোড়া (Pair)' },
          { itemId: 'ITEM-106', itemName: 'মাফলার (Woolen Muffler)', quantityPerPackage: 1, unit: 'পিস (Pcs)' }
        ],
        assembledQuantity: 500,
        warehouseAssembled: {
          'ময়মনসিংহ': 250,
          'কক্সবাজার': 150,
          'খুলনা': 100
        }
      }
    ]
  },
  {
    id: 'MWO-PRG-1002',
    name: 'Rohingya Sanitation Wash Project',
    type: 'Wash Program',
    donors: ['donor2'],
    beneficiaryCommunity: 'Rohingya Community',
    programDate: '2026-05-10',
    programDuration: '3 Months',
    targetStockSize: 1200,
    remainingStock: 1200,
    warehouses: ['কক্সবাজার ক্যাম্প-১', 'কক্সবাজার ক্যাম্প-৪'],
    inventoryItems: [
      { 
        id: 'ITEM-201', 
        programId: 'MWO-PRG-1002', 
        name: 'অ্যান্টিসেপটিক সাবান (Soap)', 
        category: 'হাইজিন', 
        unit: 'পিস (Pcs)', 
        totalReceived: 4800, 
        allocatedToPackages: 4800,
        warehouseStocks: {
          'কক্সবাজার ক্যাম্প-১': { totalReceived: 2800, allocatedToPackages: 2800 },
          'কক্সবাজার ক্যাম্প-৪': { totalReceived: 2000, allocatedToPackages: 2000 }
        }
      },
      { 
        id: 'ITEM-202', 
        programId: 'MWO-PRG-1002', 
        name: 'ডিটারজেন্ট পাউডার (Detergent 1kg)', 
        category: 'হাইজিন', 
        unit: 'প্যাকেট (Pkt)', 
        totalReceived: 1500, 
        allocatedToPackages: 1200,
        warehouseStocks: {
          'কক্সবাজার ক্যাম্প-১': { totalReceived: 900, allocatedToPackages: 700 },
          'কক্সবাজার ক্যাম্প-৪': { totalReceived: 600, allocatedToPackages: 500 }
        }
      },
      { 
        id: 'ITEM-203', 
        programId: 'MWO-PRG-1002', 
        name: 'ওয়াটার পিউরিফায়ার ট্যাবলেট (Aqua Tabs)', 
        category: 'স্যানিটেশন', 
        unit: 'স্ট্রিপ (Strip)', 
        totalReceived: 3600, 
        allocatedToPackages: 2400,
        warehouseStocks: {
          'কক্সবাজার ক্যাম্প-১': { totalReceived: 2000, allocatedToPackages: 1400 },
          'কক্সবাজার ক্যাম্প-৪': { totalReceived: 1600, allocatedToPackages: 1000 }
        }
      },
      { 
        id: 'ITEM-204', 
        programId: 'MWO-PRG-1002', 
        name: 'স্যানিটারি ন্যাপকিন (Pads)', 
        category: 'হাইজিন', 
        unit: 'প্যাক (Pack)', 
        totalReceived: 2400, 
        allocatedToPackages: 2400,
        warehouseStocks: {
          'কক্সবাজার ক্যাম্প-১': { totalReceived: 1400, allocatedToPackages: 1400 },
          'কক্সবাজার ক্যাম্প-৪': { totalReceived: 1000, allocatedToPackages: 1000 }
        }
      }
    ],
    inventoryPackages: [
      {
        id: 'PKG-2001',
        programId: 'MWO-PRG-1002',
        name: 'Family Hygiene WASH Kit (হাইজিন ওয়াশ কিট)',
        description: '৪টি সাবান + ১টি ডিটারজেন্ট + ২ স্ট্রিপ পিউরিফায়ার ট্যাবলেট + ২ প্যাক স্যানিটারি ন্যাপকিন',
        items: [
          { itemId: 'ITEM-201', itemName: 'অ্যান্টিসেপটিক সাবান (Soap)', quantityPerPackage: 4, unit: 'পিস (Pcs)' },
          { itemId: 'ITEM-202', itemName: 'ডিটারজেন্ট পাউডার (Detergent 1kg)', quantityPerPackage: 1, unit: 'প্যাকেট (Pkt)' },
          { itemId: 'ITEM-203', itemName: 'ওয়াটার পিউরিফায়ার ট্যাবলেট (Aqua Tabs)', quantityPerPackage: 2, unit: 'স্ট্রিপ (Strip)' },
          { itemId: 'ITEM-204', itemName: 'স্যানিটারি ন্যাপকিন (Pads)', quantityPerPackage: 2, unit: 'প্যাক (Pack)' }
        ],
        assembledQuantity: 1200,
        warehouseAssembled: {
          'কক্সবাজার ক্যাম্প-১': 700,
          'কক্সবাজার ক্যাম্প-৪': 500
        }
      }
    ]
  },
  {
    id: 'MWO-PRG-1003',
    name: 'Dhaka Slum Dry Food Distribution',
    type: 'Food Program',
    donors: ['donor1'],
    beneficiaryCommunity: 'Local Community',
    programDate: '2026-06-12',
    programDuration: '1 Day',
    targetStockSize: 300,
    remainingStock: 298,
    warehouses: ['মিরপুর গুদাম', 'মোহাম্মদপুর গুদাম'],
    inventoryItems: [
      { 
        id: 'ITEM-301', 
        programId: 'MWO-PRG-1003', 
        name: 'মিনিকেট চাল (Miniket Rice)', 
        category: 'খাদ্যপণ্য', 
        unit: 'কেজি (Kg)', 
        totalReceived: 3500, 
        allocatedToPackages: 3000, 
        warehouseStocks: {
          'মিরপুর গুদাম': { totalReceived: 2000, allocatedToPackages: 1800 },
          'মোহাম্মদপুর গুদাম': { totalReceived: 1500, allocatedToPackages: 1200 }
        },
        notes: '৫০ কেজি বস্তা মোট ৭০টি' 
      },
      { id: 'ITEM-302', programId: 'MWO-PRG-1003', name: 'গম/আটা (Flour/Atta)', category: 'খাদ্যপণ্য', unit: 'কেজি (Kg)', totalReceived: 1800, allocatedToPackages: 1500 },
      { id: 'ITEM-303', programId: 'MWO-PRG-1003', name: 'ফর্টিফাইড সয়াবিন তেল (Soybean Oil)', category: 'খাদ্যপণ্য', unit: 'লিটার (Liter)', totalReceived: 700, allocatedToPackages: 600 },
      { id: 'ITEM-304', programId: 'MWO-PRG-1003', name: 'সাদা চিনি (Refined Sugar)', category: 'খাদ্যপণ্য', unit: 'কেজি (Kg)', totalReceived: 700, allocatedToPackages: 600 },
      { id: 'ITEM-305', programId: 'MWO-PRG-1003', name: 'আয়োডিনযুক্ত লবণ (Iodized Salt)', category: 'খাদ্যপণ্য', unit: 'প্যাকেট (Pkt)', totalReceived: 700, allocatedToPackages: 300 },
      { id: 'ITEM-306', programId: 'MWO-PRG-1003', name: 'মসুর ডাল (Red Lentils)', category: 'খাদ্যপণ্য', unit: 'কেজি (Kg)', totalReceived: 700, allocatedToPackages: 600 }
    ],
    inventoryPackages: [
      {
        id: 'PKG-3001',
        programId: 'MWO-PRG-1003',
        name: 'Standard Family Food Basket (স্ট্যান্ডার্ড খাদ্য সহায়তা প্যাক)',
        description: '১০ কেজি চাল + ৫ কেজি আটা + ২ লিটার তেল + ২ কেজি চিনি + ১ প্যাকেট লবণ + ২ কেজি মসুর ডাল',
        items: [
          { itemId: 'ITEM-301', itemName: 'মিনিকেট চাল (Miniket Rice)', quantityPerPackage: 10, unit: 'কেজি (Kg)' },
          { itemId: 'ITEM-302', itemName: 'গম/আটা (Flour/Atta)', quantityPerPackage: 5, unit: 'কেজি (Kg)' },
          { itemId: 'ITEM-303', itemName: 'ফর্টিফাইড সয়াবিন তেল (Soybean Oil)', quantityPerPackage: 2, unit: 'লিটার (Liter)' },
          { itemId: 'ITEM-304', itemName: 'সাদা চিনি (Refined Sugar)', quantityPerPackage: 2, unit: 'কেজি (Kg)' },
          { itemId: 'ITEM-305', itemName: 'আয়োডিনযুক্ত লবণ (Iodized Salt)', quantityPerPackage: 1, unit: 'প্যাকেট (Pkt)' },
          { itemId: 'ITEM-306', itemName: 'মসুর ডাল (Red Lentils)', quantityPerPackage: 2, unit: 'কেজি (Kg)' }
        ],
        assembledQuantity: 300
      }
    ]
  }
];

// Seed default global registered beneficiaries with photo asset placeholders
export const DEFAULT_BENEFICIARIES: Beneficiary[] = [
  {
    id: 'MWO-BEN-10001',
    name: 'Abul Kalam Azad',
    type: 'General',
    nationality: 'Bangladeshi',
    dob: '1984-07-12',
    nidOrBirthCert: '19842617265431671',
    mobile: '01712345678',
    gender: 'Male',
    address: 'Mirpur-11, Dhaka, Bangladesh',
    photo: '', // default fallback visual will be rendered
    signature: '',
    createdAdmin: 'admin'
  },
  {
    id: 'MWO-BEN-10002',
    name: 'Fatema Begum',
    type: 'Widow',
    nationality: 'Bangladeshi',
    dob: '1979-11-03',
    nidOrBirthCert: '19792617211116666',
    mobile: '01598765432',
    gender: 'Female',
    address: 'Tejgaon Industrial Area, Dhaka',
    photo: '',
    signature: '',
    createdAdmin: 'field1'
  },
  {
    id: 'MWO-BEN-10003',
    name: 'Mohammad Selim',
    type: 'Disable',
    nationality: 'Rohingya',
    dob: '1992-04-20',
    nidOrBirthCert: 'RC-CAMP12-88746',
    mobile: '01855667788',
    gender: 'Male',
    address: 'Camp 12, Block-E, Cox\'s Bazar',
    photo: '',
    signature: '',
    createdAdmin: 'admin'
  },
  {
    id: 'MWO-BEN-10004',
    name: 'Mariam Khatun',
    type: 'Orphan',
    nationality: 'Rohingya',
    dob: '2016-01-15',
    nidOrBirthCert: 'RC-CAMP09-45612',
    mobile: '01900112233',
    gender: 'Female',
    address: 'Camp 09, Orphan Block, Cox\'s Bazar',
    photo: '',
    signature: '',
    createdAdmin: 'field1'
  }
];

// Seed served history records matching programs
export const DEFAULT_SERVICE_RECORDS: ServiceRecord[] = [
  {
    id: 'SR-77341',
    programId: 'MWO-PRG-1001',
    beneficiaryId: 'MWO-BEN-10003',
    packageCount: 2,
    servedDate: '2026-06-15T11:20:00Z',
    servedAdmin: 'Md. Ibrahim Hossain'
  },
  {
    id: 'SR-77342',
    programId: 'MWO-PRG-1001',
    beneficiaryId: 'MWO-BEN-10004',
    packageCount: 1,
    servedDate: '2026-06-16T15:30:00Z',
    servedAdmin: 'Field Admin Shagor'
  },
  {
    id: 'SR-77343',
    programId: 'MWO-PRG-1003',
    beneficiaryId: 'MWO-BEN-10001',
    packageCount: 2,
    servedDate: '2026-06-17T09:12:00Z',
    servedAdmin: 'Md. Ibrahim Hossain'
  }
];

// Storage persistence helper functions with quota protection
export function getSavedState<T>(key: string, backup: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Warning fetching localStorage key:', key, err);
  }
  return backup;
}

export function saveState<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err: any) {
    console.warn('LocalStorage write warning for key:', key, err?.message || err);
    // If quota exceeded, attempt to clear old temporary caches
    if (err?.name === 'QuotaExceededError' || err?.message?.includes('quota')) {
      try {
        // Clear non-critical temporary keys
        const keysToClean = ['mwo_audit_temp', 'google_access_token_temp'];
        keysToClean.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, JSON.stringify(data));
      } catch (retryErr) {
        console.warn('LocalStorage quota remained full after cache cleanup for key:', key);
      }
    }
  }
}
