import { supabase } from './supabase';
import { Machine, ReconcileRecord } from '../types';
import { OfflineService } from './offlineService';

// Cache for frequently accessed data
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper functions for caching
const getCacheKey = (collection: string, userId: string, extra?: string) =>
  `${collection}_${userId}${extra ? `_${extra}` : ''}`;

const getFromCache = <T>(key: string): T | null => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
};

const setCache = <T>(key: string, data: T, ttl: number = CACHE_TTL) => {
  cache.set(key, { data, timestamp: Date.now(), ttl });
};

interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  userid: string;
}

const MACHINES_COLLECTION = 'machines';
const RECORDS_COLLECTION = 'records';
const BUSINESS_COLLECTION = 'businesses';

// Helper to generate IDs
export const generateId = () => crypto.randomUUID();

// Helper to add timeout to promises
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    )
  ]);
};

export const getMachines = async (userId: string): Promise<Machine[]> => {
  try {
    const { data, error } = await supabase.from(MACHINES_COLLECTION).select('*').eq('userid', userId);
    if (error) throw error;
    return data as Machine[];
  } catch (error) {
    console.error('Error fetching machines:', error);
    return OfflineService.getMachines(userId);
  }
};

export const saveMachine = async (machine: Machine) => {
  if (!machine.userid) throw new Error("User ID is required to save a machine.");

  OfflineService.saveMachineLocal(machine);

  if (!OfflineService.isOnline()) return;

  try {
    const { error } = await supabase.from(MACHINES_COLLECTION).upsert(machine);
    if (error) throw error;
  } catch (error) {
    console.error('Error saving machine to Supabase:', error);
    OfflineService.forceQueueSync('machine', 'save', machine);
  }
};

export const deleteMachine = async (id: string) => {
  const { error } = await supabase.from(MACHINES_COLLECTION).delete().eq('id', id);
  if (error) throw error;
};

export const getRecords = async (userId: string): Promise<ReconcileRecord[]> => {
  try {
    const { data, error } = await supabase.from(RECORDS_COLLECTION).select('*').eq('userid', userId);
    if (error) throw error;
    return (data as ReconcileRecord[]).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch (error) {
    console.error('Error fetching records:', error);
    return OfflineService.getRecords(userId).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }
};

export const saveRecord = async (record: ReconcileRecord) => {
  if (!record.id) throw new Error("Record must have an ID to be saved");
  if (!record.userid) throw new Error("User ID is required to save a record.");

  const fullRecord = { ...record, timestamp: record.timestamp || Date.now() };

  OfflineService.saveRecordLocal(fullRecord);

  if (OfflineService.isOnline()) {
    const { error } = await supabase.from(RECORDS_COLLECTION).upsert(fullRecord);
    if (error) {
      console.error('Error saving record to Supabase:', error);
      OfflineService.forceQueueSync('record', 'save', fullRecord);
      throw error;
    }
  }
};

export const deleteRecord = async (id: string) => {
  const { error } = await supabase.from(RECORDS_COLLECTION).delete().eq('id', id);
  if (error) throw error;
};

export const getBusiness = async (userId: string): Promise<BusinessInfo | null> => {
  const localBusiness = OfflineService.getBusiness(userId);

  if (!OfflineService.isOnline()) {
    return localBusiness;
  }

  try {
    const { data, error } = await supabase.from(BUSINESS_COLLECTION).select('*').eq('userid', userId).maybeSingle();
    if (error) throw error;
    const business = data as BusinessInfo | null;

    if (business) {
      OfflineService.saveBusinessLocal(business);
    }
    return business;
  } catch (error) {
    console.error('Error fetching business:', error);
    return localBusiness;
  }
};

export const saveBusiness = async (business: BusinessInfo) => {
  if (!business.userid) throw new Error("User ID is required to save business info.");

  OfflineService.saveBusinessLocal(business);

  if (!OfflineService.isOnline()) return;

  try {
    const { error } = await supabase.from(BUSINESS_COLLECTION).upsert(business);
    if (error) throw error;
  } catch (error) {
    console.error('Error saving business to Supabase:', error);
    throw error;
  }
};

export const saveRecordsBatch = async (records: ReconcileRecord[]) => {
  if (records.length === 0) return;

  records.forEach(record => {
    const fullRecord = { ...record, timestamp: record.timestamp || Date.now() };
    OfflineService.saveRecordLocal(fullRecord);
  });

  if (!OfflineService.isOnline()) return;

  try {
    const { error } = await supabase.from(RECORDS_COLLECTION).upsert(records);
    if (error) throw error;
  } catch (error) {
    console.error('Error batch saving records to Supabase:', error);
  }
};

export const syncOfflineData = async (userId: string) => {
  if (!OfflineService.isOnline()) return;

  try {
    await OfflineService.syncWithFirebase({ saveMachine, saveRecord, saveBusiness, deleteMachine, deleteRecord });
    await OfflineService.loadFromFirebase(userId, { getMachines: getSupabaseMachines, getRecords: getSupabaseRecords, getBusiness: getSupabaseBusiness });
  } catch (error) {
    console.error('Sync error:', error);
  }
};

const getSupabaseMachines = async (userId: string) => {
  const { data, error } = await supabase.from(MACHINES_COLLECTION).select('*').eq('userid', userId);
  if (error) throw error;
  return data as Machine[];
};

const getSupabaseRecords = async (userId: string) => {
  const { data, error } = await supabase.from(RECORDS_COLLECTION).select('*').eq('userid', userId);
  if (error) throw error;
  return data as ReconcileRecord[];
};

const getSupabaseBusiness = async (userId: string) => {
  const { data, error } = await supabase.from(BUSINESS_COLLECTION).select('*').eq('userid', userId).maybeSingle();
  if (error) throw error;
  return data as BusinessInfo | null;
};

// Clear all cache (useful for logout)
export const clearCache = () => {
  cache.clear();
};

// Initialize storage for a new user (no longer creates default machines)
export const initializeStorage = async (userId: string) => {
  // Storage initialization complete - users will add their own machines
  console.log("Storage initialized for user:", userId);
};
