import { User, Program, Beneficiary, ServiceRecord } from './types';

// Default system-admin, staff, and donor credentials
export const DEFAULT_USERS: User[] = [
  { id: 'admin', name: 'Md. Ibrahim Hossain', role: 'SuperAdmin' },
  { id: 'field1', name: 'Field Admin Shagor', role: 'FieldAdmin' },
  { id: 'donor1', name: 'Mr. ABC (Donor)', role: 'Donor' },
  { id: 'donor2', name: 'Al-Khair Trust', role: 'Donor' }
];

// Seed initial distributions programs
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
    remainingStock: 497
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
    remainingStock: 1200
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
    remainingStock: 298
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
