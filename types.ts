
export interface Machine {
  id: string;
  userId: string;
  name: string;
  bankName: string;
  active: boolean;
}

export interface ReconcileRecord {
  id: string;
  userId: string;
  machineId: string;
  date: string; // ISO Date string YYYY-MM-DD
  openingBalance: number;
  closingBalance: number;

  // Machine Report Breakdown
  mada: number;
  visa: number;
  mastercard: number;
  gcc: number;
  machineTotal: number; // Calculated: Sum of machine cards

  // Bank Credit Breakdown
  bankMada?: number;
  bankVisa?: number;
  bankMastercard?: number;
  bankGcc?: number;
  bankCredit: number;      // Calculated: Sum of bank cards

  difference: number; // bankCredit - machineTotal (Negative = Shortage)
  notes?: string;
  extraFields?: { [key: string]: { slip: number; statement: number } };
  timestamp: number;
}

export interface DailySummary {
  date: string;
  totalMachine: number;
  totalBank: number;
  totalDifference: number;
  recordCount: number;
}
