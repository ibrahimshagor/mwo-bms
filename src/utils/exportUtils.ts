import * as XLSX from 'xlsx';
import { Program, Beneficiary, ServiceRecord, User } from '../types';

/**
 * Downloads a complete data report as a multi-tab Microsoft Excel (.xlsx) spreadsheet.
 */
export function exportAllToExcel(
  programs: Program[],
  beneficiaries: Beneficiary[],
  serviceRecords: ServiceRecord[],
  users: User[]
) {
  const wb = XLSX.utils.book_new();

  // Tab 1: Dashboard Summary Stats
  const totalPackagesServed = serviceRecords.reduce((sum, sr) => sum + sr.packageCount, 0);
  const dashboardData = [
    { "Metric KPI Indicator": "Total Registered Beneficiaries Profiles", "Quantity/Total": beneficiaries.length },
    { "Metric KPI Indicator": "Total Relief Support Distribution Programs", "Quantity/Total": programs.length },
    { "Metric KPI Indicator": "Total Support Portions/Packages Served Disbursed", "Quantity/Total": totalPackagesServed },
    { "Metric KPI Indicator": "Total Active Security System Accounts", "Quantity/Total": users.length },
    { "Metric KPI Indicator": "Export Sessions Captured (UTC Local Time)", "Quantity/Total": new Date().toLocaleString() },
    { "Metric KPI Indicator": "Status Code Indicators", "Quantity/Total": "HEALTHY / ONLINE" }
  ];
  const wsDash = XLSX.utils.json_to_sheet(dashboardData);
  XLSX.utils.book_append_sheet(wb, wsDash, "Dashboard Summary");

  // Tab 2: Programs Inventory Data
  const programData = programs.map(p => {
    const matchedRecords = serviceRecords.filter(r => r.programId === p.id);
    const distributedCount = p.targetStockSize - p.remainingStock;
    return {
      "Program ID Index": p.id,
      "Relief Support Program Name": p.name,
      "Program Category": p.type,
      "Timeline Program Run Date": p.programDate,
      "Expected Timeline Duration": p.programDuration,
      "Allocated Target Stock (Packages)": p.targetStockSize,
      "Inventory Remaining Stock": p.remainingStock,
      "Disbursed / Completed Stock": distributedCount,
      "Served Allocation Ratio (%)": `${Math.round((distributedCount / p.targetStockSize) * 100)}%`,
      "Coordinating Enlisted Donors": p.donors.join(", ") || "General Aid Funding"
    };
  });
  const wsProg = XLSX.utils.json_to_sheet(programData);
  XLSX.utils.book_append_sheet(wb, wsProg, "Programs inventory");

  // Tab 3: Beneficiary Profiles Registry
  const beneficiaryData = beneficiaries.map(b => {
    const bRecords = serviceRecords.filter(sr => sr.beneficiaryId === b.id);
    const packagesReceivedCount = bRecords.reduce((sum, sr) => sum + sr.packageCount, 0);
    return {
      "Beneficiary UID ID": b.id,
      "Citizen Full Display Name": b.name,
      "National Security NID / Birth Cert": b.nidOrBirthCert,
      "Primary Contact Mobile": b.mobile,
      "Village / Region Residence Address": b.address,
      "Account Type": b.type,
      "Total Resource Packages Disbursed": packagesReceivedCount,
      "Active Relief Drives Involved": bRecords.length
    };
  });
  const wsBen = XLSX.utils.json_to_sheet(beneficiaryData);
  XLSX.utils.book_append_sheet(wb, wsBen, "Beneficiaries List");

  // Tab 4: Service records Disbursed Logs
  const serviceLogsData = serviceRecords.map(sr => {
    const bMatch = beneficiaries.find(b => b.id === sr.beneficiaryId);
    return {
      "Record Disbursed ID": sr.id,
      "Relief Program Link ID": sr.programId,
      "Receiving Citizen Beneficiary Name": bMatch ? bMatch.name : "N/A",
      "Quantity Package Portion Served": sr.packageCount,
      "Disbursed Official Date": sr.servedDate,
      "Dispensing Officer Account ID": sr.servedAdmin
    };
  });
  const wsLogs = XLSX.utils.json_to_sheet(serviceLogsData);
  XLSX.utils.book_append_sheet(wb, wsLogs, "Service Log Records");

  // Tab 5: System Accounts
  const usersData = users.map(u => ({
    "Account Registry UID": u.id,
    "Profile Display Username": u.name,
    "System Clearance Authorized Role": u.role === 'SuperAdmin' ? 'Super Admin' : u.role === 'FieldAdmin' ? 'Field Staff Officer' : 'Direct Donor'
  }));
  const wsUsers = XLSX.utils.json_to_sheet(usersData);
  XLSX.utils.book_append_sheet(wb, wsUsers, "System Accounts Directory");

  XLSX.writeFile(wb, `MWO_Aid_Distribution_Records_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Creates a beautiful, synchronized Google Spreadsheet inside User's Google Drive.
 */
export async function syncDataToGoogleSheets(
  accessToken: string,
  programs: Program[],
  beneficiaries: Beneficiary[],
  serviceRecords: ServiceRecord[],
  users: User[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  
  // 1. Setup the multi-tab layout payload
  const createPayload = {
    properties: {
      title: `MWO Aid Distribution Master Records - ${new Date().toISOString().slice(0, 10)}`
    },
    sheets: [
      { properties: { title: "Dashboard Summary" } },
      { properties: { title: "Programs Inventory" } },
      { properties: { title: "Beneficiaries List" } },
      { properties: { title: "Service Log Records" } },
      { properties: { title: "System Accounts Directory" } }
    ]
  };

  // 2. Call Google Sheets API to create spreadsheet
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(createPayload)
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    console.error("Failed to create Google Spreadsheet:", errorText);
    throw new Error(`Google Sheets API Error: ${createRes.statusText || errorText}`);
  }

  const spreadsheet = await createRes.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const spreadsheetUrl = spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 3. Prepare data rows for batch writing
  const totalPackagesServed = serviceRecords.reduce((sum, sr) => sum + sr.packageCount, 0);
  
  const dashboardValues = [
    ["Metric KPI Indicator", "Quantity/Total"],
    ["Total Registered Beneficiaries Profiles", beneficiaries.length],
    ["Total Relief Support Distribution Programs", programs.length],
    ["Total Support Portions/Packages Served Disbursed", totalPackagesServed],
    ["Total Active Security System Accounts", users.length],
    ["Created and Synced At (UTC Local Time)", new Date().toLocaleString()],
    ["Platform Sync Connection Status", "ACTIVE & OPERATIONAL"]
  ];

  const programValues = [
    [
      "Program ID Index", 
      "Relief Support Program Name", 
      "Program Category", 
      "Timeline Program Run Date", 
      "Expected Timeline Duration", 
      "Allocated Target Stock (Packages)", 
      "Inventory Remaining Stock", 
      "Disbursed / Completed Stock", 
      "Served Allocation Ratio (%)", 
      "Coordinating Enlisted Donors"
    ],
    ...programs.map(p => {
      const distributedCount = p.targetStockSize - p.remainingStock;
      return [
        p.id,
        p.name,
        p.type,
        p.programDate,
        p.programDuration,
        p.targetStockSize,
        p.remainingStock,
        distributedCount,
        `${Math.round((distributedCount / p.targetStockSize) * 100)}%`,
        p.donors.join(", ") || "General Aid Funding"
      ];
    })
  ];

  const beneficiaryValues = [
    [
      "Beneficiary UID ID", 
      "Citizen Full Display Name", 
      "National Security NID / Birth Cert", 
      "Primary Contact Mobile", 
      "Village / Region Residence Address", 
      "Account Type", 
      "Total Resource Packages Disbursed", 
      "Active Relief Drives Involved"
    ],
    ...beneficiaries.map(b => {
      const bRecords = serviceRecords.filter(sr => sr.beneficiaryId === b.id);
      const packagesReceivedCount = bRecords.reduce((sum, sr) => sum + sr.packageCount, 0);
      return [
        b.id,
        b.name,
        b.nidOrBirthCert,
        b.mobile,
        b.address,
        b.type,
        packagesReceivedCount,
        bRecords.length
      ];
    })
  ];

  const serviceRecordValues = [
    [
      "Record Disbursed ID", 
      "Relief Program Link ID", 
      "Receiving Citizen Beneficiary Name", 
      "Quantity Package Portion Served", 
      "Disbursed Official Date", 
      "Dispensing Officer Account ID"
    ],
    ...serviceRecords.map(sr => {
      const bMatch = beneficiaries.find(b => b.id === sr.beneficiaryId);
      return [
        sr.id,
        sr.programId,
        bMatch ? bMatch.name : "N/A",
        sr.packageCount,
        sr.servedDate,
        sr.servedAdmin
      ];
    })
  ];

  const userValues = [
    ["Account Registry UID", "Profile Display Username", "System Clearance Authorized Role"],
    ...users.map(u => [
      u.id,
      u.name,
      u.role === 'SuperAdmin' ? 'Super Admin' : u.role === 'FieldAdmin' ? 'Field Staff Officer' : 'Direct Donor'
    ])
  ];

  // 4. Send values:batchUpdate to populate sheets in single call
  const batchUpdatePayload = {
    valueInputOption: "USER_ENTERED",
    data: [
      { range: "'Dashboard Summary'!A1", majorDimension: "ROWS", values: dashboardValues },
      { range: "'Programs Inventory'!A1", majorDimension: "ROWS", values: programValues },
      { range: "'Beneficiaries List'!A1", majorDimension: "ROWS", values: beneficiaryValues },
      { range: "'Service Log Records'!A1", majorDimension: "ROWS", values: serviceRecordValues },
      { range: "'System Accounts Directory'!A1", majorDimension: "ROWS", values: userValues }
    ]
  };

  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(batchUpdatePayload)
  });

  if (!updateRes.ok) {
    const errorText = await updateRes.text();
    console.error("Failed to populate Google Sheets data rows:", errorText);
    throw new Error(`Google Sheets populate failed: ${updateRes.statusText || errorText}`);
  }

  return {
    spreadsheetId,
    spreadsheetUrl
  };
}
