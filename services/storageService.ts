import { db } from './firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  onSnapshot
} from "firebase/firestore";
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
  taxId: string;
  userId: string;
}

const MACHINES_COLLECTION = 'machines';
const RECORDS_COLLECTION = 'records';
const BUSINESS_COLLECTION = 'businesses';

// Helper to generate IDs compatible with Firestore
export const generateId = () => doc(collection(db, 'dummy')).id;

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
  // Return local data immediately
  return OfflineService.getMachines(userId);
};

export const saveMachine = async (machine: Machine) => {
  const { id, ...machineData } = machine;
  if (!machineData.userId) throw new Error("User ID is required to save a machine.");

  // Save locally first
  OfflineService.saveMachineLocal(machine);

  if (!OfflineService.isOnline()) return;

  try {
    await setDoc(doc(db, MACHINES_COLLECTION, id), machineData);
  } catch (error) {
    console.error('Error saving machine to Firebase:', error);
    OfflineService.forceQueueSync('machine', 'save', machine);
  }
};

export const deleteMachine = async (id: string) => {
  await deleteDoc(doc(db, MACHINES_COLLECTION, id));
};

export const getRecords = async (userId: string): Promise<ReconcileRecord[]> => {
  // Return local data immediately, sorted
  return OfflineService.getRecords(userId).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

export const saveRecord = async (record: ReconcileRecord) => {
  const { id, ...recordData } = record;
  if (!id) throw new Error("Record must have an ID to be saved");
  if (!recordData.userId) throw new Error("User ID is required to save a record.");

  const fullRecord = { ...record, timestamp: record.timestamp || Date.now() };

  // Save locally first for immediate UI update
  OfflineService.saveRecordLocal(fullRecord);

  // Don't wait for Firebase save - do it in background
  if (OfflineService.isOnline()) {
    setDoc(doc(db, RECORDS_COLLECTION, id), {
      ...recordData,
      timestamp: fullRecord.timestamp
    }).catch(error => {
      console.error('Error saving record to Firebase:', error);
      OfflineService.forceQueueSync('record', 'save', fullRecord);
    });
  }
};

export const deleteRecord = async (id: string) => {
  await deleteDoc(doc(db, RECORDS_COLLECTION, id));
};

export const getBusiness = async (userId: string): Promise<BusinessInfo | null> => {
  // Always try local first
  const localBusiness = OfflineService.getBusiness(userId);

  if (!OfflineService.isOnline()) {
    return localBusiness;
  }

  try {
    const docRef = doc(db, BUSINESS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    const business = docSnap.exists() ? docSnap.data() as BusinessInfo : null;

    // Update local storage
    if (business) {
      OfflineService.saveBusinessLocal({ ...business, userId });
    }
    return business;
  } catch (error) {
    console.error('Error fetching business:', error);
    return localBusiness;
  }
};

export const saveBusiness = async (business: BusinessInfo) => {
  const { userId, ...businessData } = business;
  if (!userId) throw new Error("User ID is required to save business info.");

  // Save locally first
  OfflineService.saveBusinessLocal(business);

  if (!OfflineService.isOnline()) return;

  try {
    await setDoc(doc(db, BUSINESS_COLLECTION, userId), businessData);
  } catch (error) {
    console.error('Error saving business to Firebase:', error);
    OfflineService.forceQueueSync('business', 'save', business);
  }
};

// Batch save multiple records for better performance
export const saveRecordsBatch = async (records: ReconcileRecord[]) => {
  if (records.length === 0) return;

  // Save all records locally first
  records.forEach(record => {
    const fullRecord = { ...record, timestamp: record.timestamp || Date.now() };
    OfflineService.saveRecordLocal(fullRecord);
  });

  if (!OfflineService.isOnline()) return;

  const batch = writeBatch(db);
  records.forEach(record => {
    const { id, ...recordData } = record;
    if (id && recordData.userId) {
      const docRef = doc(db, RECORDS_COLLECTION, id);
      batch.set(docRef, {
        ...recordData,
        timestamp: record.timestamp || Date.now()
      });
    }
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error('Error batch saving records to Firebase:', error);
  }
};

// Sync operations
export const syncOfflineData = async (userId: string) => {
  if (!OfflineService.isOnline()) return;

  try {
    await OfflineService.syncWithFirebase({ saveMachine, saveRecord, saveBusiness, deleteMachine, deleteRecord });
    await OfflineService.loadFromFirebase(userId, { getMachines: getFirebaseMachines, getRecords: getFirebaseRecords, getBusiness: getFirebaseBusiness });
  } catch (error) {
    console.error('Sync error:', error);
  }
};

// Direct Firebase calls (for sync)
const getFirebaseMachines = async (userId: string) => {
  const q = query(collection(db, MACHINES_COLLECTION), where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine));
};

const getFirebaseRecords = async (userId: string) => {
  const q = query(collection(db, RECORDS_COLLECTION), where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReconcileRecord));
};

const getFirebaseBusiness = async (userId: string) => {
  const docRef = doc(db, BUSINESS_COLLECTION, userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() as BusinessInfo : null;
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
