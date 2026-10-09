import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'bn';

export interface TranslationsDict {
  [key: string]: {
    en: string;
    bn: string;
  };
}

export const DICTIONARY: TranslationsDict = {
  // Navigation & Tabs
  'nav.dashboard': { en: 'Home Dashboard', bn: 'হোম ড্যাশবোর্ড' },
  'nav.biometrics': { en: 'Biometric Face Scan', bn: 'বায়োমেট্রিক ফেস স্ক্যান' },
  'nav.beneficiaries': { en: 'Beneficiary Directory', bn: 'সুবিধাভোগী ডিরেক্টরি' },
  'nav.programs': { en: 'Programs & Relief', bn: 'প্রোগ্রাম ও ত্রাণ' },
  'nav.inventory': { en: 'Inventory Desk', bn: 'ইনভেন্টরি ডেস্ক' },
  'nav.products': { en: 'Product Catalog & Stocks', bn: 'প্রোডাক্ট ক্যাটালগ ও মোট স্টক' },
  'nav.facilities': { en: 'Offices & Warehouses', bn: 'গুদাম ও শাখা ব্যবস্থাপনা' },
  'nav.users': { en: 'User Management', bn: 'ইউজার ম্যানেজমেন্ট' },
  'nav.profile': { en: 'Profile Settings', bn: 'প্রোফাইল সেটিংস' },
  'nav.logout': { en: 'Logout Session', bn: 'লগআউট' },
  'nav.view': { en: 'View', bn: 'ভিউ' },

  // Brand & Slogan
  'brand.title': { en: 'MWO Relief Hub', bn: 'MWO রিলিফ হাব' },
  'brand.subtitle': { en: 'Muslim Welfare Organization', bn: 'মানবকল্যাণ সংস্থা' },
  'brand.portal': { en: 'Beneficiary Management Portal', bn: 'সুবিধাভোগী ব্যবস্থাপনা পোর্টাল' },
  'brand.tagline': { en: 'Transparent Humanitarian Distribution Network', bn: 'স্বচ্ছ মানবিক ত্রাণ বিতরণ নেটওয়ার্ক' },

  // Quick Action Buttons
  'quick.face_scan': { en: 'Biometric Scan', bn: 'বায়োমেট্রিক স্ক্যান' },
  'quick.inventory': { en: 'Inventory', bn: 'ইনভেন্টরি' },
  'quick.warehouses': { en: 'Warehouses & Offices', bn: 'গুদাম ও অফিস' },
  'quick.beneficiaries': { en: 'Beneficiaries', bn: 'সুবিধাভোগী' },
  'quick.programs': { en: 'Programs', bn: 'প্রোগ্রাম' },

  // Language Switcher
  'lang.switch_to_bengali': { en: 'Switch to Bengali (বাংলা)', bn: 'বাংলায় দেখুন' },
  'lang.switch_to_english': { en: 'Switch to English', bn: 'ইংরেজিতে দেখুন' },
  'lang.current': { en: 'Language: English', bn: 'ভাষা: বাংলা' },
  'lang.language': { en: 'Language', bn: 'ভাষা' },
  'lang.english': { en: 'English', bn: 'English' },
  'lang.bengali': { en: 'বাংলা (Bengali)', bn: 'বাংলা' },

  // Drawer Group Titles
  'drawer.core_ops': { en: 'Core Operations', bn: 'মূল কার্যপ্রণালী' },
  'drawer.logistics': { en: 'Logistics & Distribution', bn: 'লজিস্টিকস ও বিতরণ' },
  'drawer.admin': { en: 'System & Administration', bn: 'প্রশাসনিক ও সেটিংস' },
  'drawer.quick_actions': { en: 'Quick Actions', bn: 'দ্রুত অ্যাকশন' },
  'drawer.register_beneficiary': { en: 'Register Beneficiary', bn: 'নতুন সুবিধাভোগী নিবন্ধন' },
  'drawer.create_program': { en: 'Create Relief Program', bn: 'নতুন প্রোগ্রাম তৈরি' },
  'drawer.system_users': { en: 'Staff & Donor Accounts', bn: 'স্টাফ ও ডোনার অ্যাকাউন্ট' },

  // Dashboard Stats
  'stat.total_beneficiaries': { en: 'Total Beneficiaries', bn: 'মোট সুবিধাভোগী' },
  'stat.active_programs': { en: 'Active Programs', bn: 'সক্রিয় কর্মসূচি' },
  'stat.packages_distributed': { en: 'Packages Distributed', bn: 'বিতরণকৃত প্যাকেজ' },
  'stat.biometric_coverage': { en: 'Biometric Coverage', bn: 'বায়োমেট্রিক কভারেজ' },
  'stat.recent_activity': { en: 'Recent Distributions', bn: 'সাম্প্রতিক বিতরণ লগ' },
  'stat.total_warehouses': { en: 'Offices & Warehouses', bn: 'গুদাম ও অফিসসমূহ' },

  // Buttons & Common Actions
  'btn.search': { en: 'Search', bn: 'অনুসন্ধান' },
  'btn.filter': { en: 'Filter', bn: 'ফিল্টার' },
  'btn.export': { en: 'Export Data', bn: 'ডাটা এক্সপোর্ট' },
  'btn.save': { en: 'Save Changes', bn: 'সংরক্ষণ করুন' },
  'btn.cancel': { en: 'Cancel', bn: 'বাতিল' },
  'btn.delete': { en: 'Delete', bn: 'মুছে ফেলুন' },
  'btn.edit': { en: 'Edit', bn: 'সম্পাদনা' },
  'btn.details': { en: 'View Details', bn: 'বিস্তারিত দেখুন' },
  'btn.close': { en: 'Close', bn: 'বন্ধ করুন' },
  'btn.confirm': { en: 'Confirm', bn: 'নিশ্চিত করুন' },
  'btn.add': { en: 'Add New', bn: 'নতুন যোগ করুন' },
  'btn.create': { en: 'Create', bn: 'তৈরি করুন' },

  // Distribution Desk
  'desk.title': { en: 'Live Distribution Desk', bn: 'সরাসরি বিতরণ ডেস্ক' },
  'desk.anonymous': { en: 'Anonymous Distribution', bn: 'অ্যানোনিমাস বিতরণ' },
  'desk.verified': { en: 'Verified Beneficiary Distribution', bn: 'সুবিধাভোগী যাচাইকৃত বিতরণ' },
  'desk.single': { en: 'Single Distribution', bn: 'একক বিতরণ' },
  'desk.batch': { en: 'Batch Distribution', bn: 'ব্যাচ বিতরণ' },
  'desk.location': { en: 'Distribution Location / Area', bn: 'বিতরণ এলাকা / অঞ্চল' },
  'desk.source_warehouse': { en: 'Source Warehouse', bn: 'উৎস গুদাম' },
  'desk.remaining_stock': { en: 'Remaining Stock', bn: 'অবশিষ্ট স্টক' },
  'desk.serve': { en: 'Issue & Distribute Package', bn: 'ত্রাণ বিতরণ সম্পন্ন করুন' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, enFallback?: string, bnFallback?: string) => string;
  isEn: boolean;
  isBn: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string, enFallback?: string) => enFallback || key,
  isEn: true,
  isBn: false,
});

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default to English as explicitly requested by user!
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('mwo_language');
      if (saved === 'bn' || saved === 'en') {
        return saved;
      }
    } catch (e) {}
    return 'en'; // DEFAULT IS ENGLISH
  });

  useEffect(() => {
    try {
      localStorage.setItem('mwo_language', language);
    } catch (e) {}
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState(prev => (prev === 'en' ? 'bn' : 'en'));
  };

  const t = (key: string, enFallback?: string, bnFallback?: string): string => {
    const entry = DICTIONARY[key];
    if (entry) {
      return language === 'bn' ? entry.bn : entry.en;
    }
    if (language === 'bn') {
      return bnFallback || enFallback || key;
    }
    return enFallback || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        isEn: language === 'en',
        isBn: language === 'bn',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
