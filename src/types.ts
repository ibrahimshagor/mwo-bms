export type UserRole = 'SuperAdmin' | 'FieldAdmin' | 'Donor';

export interface User {
  id: string; // Auto-generated/manual ID, editable
  name: string;
  role: UserRole;
  password?: string; // Stored to simulate local login & changes
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
}
