export type UserRole = 'SuperAdmin' | 'FieldAdmin' | 'InventoryManager' | 'Donor';

export interface UserPermissions {
  canManageInventory?: boolean;      // Can access inventory dashboard
  canAddInventoryItems?: boolean;   // Can add items & stock-in
  canCreatePackages?: boolean;      // Can design package composition/recipes
  canAssemblePackages?: boolean;    // Can assemble and pack goods
  canDisassemblePackages?: boolean; // Can unpack goods back to store
  canDistributePackages?: boolean;  // Can serve beneficiaries in distribution desk
  canManagePrograms?: boolean;      // Can create and edit programs
  canManageBeneficiaries?: boolean; // Can register beneficiaries
}

export interface User {
  id: string; // Auto-generated/manual ID, editable
  name: string;
  role: UserRole;
  password?: string; // Stored to simulate local login & changes
  permissions?: UserPermissions;
}

export interface WarehouseItemStock {
  totalReceived: number; // মোট প্রাপ্ত মালামাল এই গুদামে
  allocatedToPackages: number; // এই গুদামে প্যাকেজে ব্যবহৃত পরিমাণ
  notes?: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string; // e.g. "ITEM-1001"
  programId: string;
  name: string; // e.g. "ব্লাঙ্কেট / Blanket", "জ্যাকেট / Jacket", "চাল / Rice", "সয়াবিন তেল / Oil"
  category?: string; // e.g. "শীতবস্ত্র", "খাদ্যপণ্য", "স্যানিটেশন সামগ্রী", "অন্যান্য"
  unit: string; // e.g. "পিস (Pcs)", "কেজি (Kg)", "লিটার (Liter)", "প্যাকেট (Pkt)", "জোড়া (Pair)"
  totalReceived: number; // মোট প্রাপ্ত মালামাল (সকল গুদাম সমন্বিত)
  allocatedToPackages: number; // প্যাকেজ বানাতে ব্যবহৃত পরিমাণ (সকল গুদাম সমন্বিত)
  warehouseStocks?: { [warehouseName: string]: WarehouseItemStock }; // আলাদা আলাদা গুদামের হিসাব
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PackageItemRequirement {
  itemId: string; // references InventoryItem.id
  itemName: string; // display snapshot
  quantityPerPackage: number; // ১টি প্যাকেজে কতটুকু লাগবে
  unit: string;
}

export interface InventoryPackage {
  id: string; // e.g. "PKG-1001"
  programId: string;
  name: string; // e.g. "Winter Family Clothing Pack / শীতবস্ত্র ফ্যামিলি প্যাক"
  description?: string;
  items: PackageItemRequirement[]; // Constituent items for 1 package
  assembledQuantity: number; // মোট কতটি প্যাকেজ প্রস্তুত করা হয়েছে (সকল গুদাম সমন্বিত)
  warehouseAssembled?: { [warehouseName: string]: number }; // আলাদা আলাদা গুদামে প্রস্তুত সংখ্যা
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ProgramType =
  | 'Food Program'
  | 'Winter Program'
  | 'Wash Program'
  | 'Seasonal Program'
  | 'Emergency Program'
  | 'Rohingya Program'
  | 'Humanitarian Program'
  | 'Health Program'
  | 'Shelter Program'
  | 'Orphan Program'
  | 'Other Program';

export type BeneficiaryCommunity = 
  | 'Local Community'
  | 'Rohingya Community'
  | 'Both'
  | 'Other Community';

export interface Program {
  id: string; // Auto-generated but editable
  name: string;
  type: ProgramType;
  donors: string[]; // List of donor user IDs assigned to this program
  beneficiaryCommunity: BeneficiaryCommunity;
  programDate: string;
  programDuration: string;
  targetStockSize: number;
  remainingStock: number;
  warehouses?: string[]; // গুদাম/ওয়্যারহাউস তালিকা (যেমন: ['ময়মনসিংহ', 'কক্সবাজার', 'খুলনা'])
  inventoryItems?: InventoryItem[];
  inventoryPackages?: InventoryPackage[];
}

export type BeneficiaryType = 'General' | 'Orphan' | 'Widow' | 'Disable';
export type NationalityType = 'Bangladeshi' | 'Rohingya' | 'Other';
export type GenderType = 'Male' | 'Female' | 'Other';

export interface Beneficiary {
  id: string; // Auto-generated and editable unique ID
  name: string;
  type: BeneficiaryType;
  nationality: NationalityType;
  dob: string;
  nidOrBirthCert: string;
  mobile: string;
  gender: GenderType;
  address: string;
  photo: string; // Base64 Data URL or SVG string
  signature: string; // Base64 signature image drawn on canvas
  createdAdmin: string; // Username/ID of admin who created
  updatedAdmin?: string; // Username/ID of last admin who modified
  updatedAt?: string; // ISO String
}

export interface ServiceRecord {
  id: string; // Auto-generated
  programId: string;
  beneficiaryId: string;
  packageCount: number;
  servedDate: string;
  servedAdmin: string; // Record which admin assigned/marked served
  isAnonymous?: boolean; // রোহিঙ্গা ক্যাম্প বা জরুরি বিতরণে বেনামী সুবিধাভোগী
  community?: BeneficiaryCommunity; // সম্প্রদায় (Rohingya, Local, etc.)
  recipientLabel?: string; // স্লিপ/টোকেন বা লেবেল (যেমন: "অ্যানোনিমাস রোহিঙ্গা প্রাপক #102")
  campOrLocation?: string; // ক্যাম্প নং বা বিতরণ স্থল (যেমন: "উখিয়া ক্যাম্প ১২, ব্লক সি")
  warehouse?: string; // কোন গুদাম থেকে মালামাল সরবরাহ করা হয়েছে (যেমন: "কক্সবাজার")
  notes?: string;
}
