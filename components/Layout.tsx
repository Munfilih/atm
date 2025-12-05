import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { PlusCircle, Settings, CreditCard, LogOut, Building2, Wifi, WifiOff, RefreshCw, Menu, X, Download, FileText } from 'lucide-react';
import { getRecords, getMachines } from '../services/storageService';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSync } from '../hooks/useOfflineSync';


export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline, isSyncing, lastSync, manualSync } = useOfflineSync(user?.uid || null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSidebarClearConfirm, setShowSidebarClearConfirm] = useState(false);
  const [searchAmount, setSearchAmount] = useState('');
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const [records, setRecords] = useState([]);
  const [machines, setMachines] = useState([]);



  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center p-3 mb-2 rounded-lg transition-colors ${isActive
      ? 'bg-blue-600 text-white shadow-md'
      : 'text-slate-600 hover:bg-slate-100'
    }`;

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/auth');
  };

  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  useEffect(() => {
    const loadData = () => {
      if (user) {
        Promise.all([
          getRecords(user.uid),
          getMachines(user.uid)
        ]).then(([recordsData, machinesData]) => {
          setRecords(recordsData);
          setMachines(machinesData);
        });
      }
    };

    loadData();

    // Listen for reload event when records are saved
    const handleReloadRecords = () => {
      loadData();
    };

    window.addEventListener('reloadRecords', handleReloadRecords);
    return () => {
      window.removeEventListener('reloadRecords', handleReloadRecords);
    };
  }, [user]);

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">RECONCILE PRO</h1>
        </div>
        <button onClick={toggleSidebar} className="p-2 hover:bg-slate-100 rounded">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={closeSidebar}></div>
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-white border-r border-slate-200 flex flex-col h-screen transition-transform duration-300 z-50 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">RECONCILE PRO</h1>
          </div>
          <button onClick={closeSidebar} className="md:hidden p-2 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="mb-4 relative">
            <input
              type="text"
              placeholder="Search amounts..."
              value={searchAmount}
              onChange={(e) => {
                setSearchAmount(e.target.value);
                setSelectedSearchIndex(-1);
              }}
              onKeyDown={(e) => {
                const results = records.filter(r =>
                  [r.mada, r.visa, r.mastercard, r.gcc, r.bankMada, r.bankVisa, r.bankMastercard, r.bankGcc, r.closingBalance, r.openingBalance]
                    .some(amt => amt && String(amt).includes(searchAmount))
                ).slice(0, 10);

                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedSearchIndex(prev => Math.min(prev + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedSearchIndex(prev => Math.max(prev - 1, -1));
                } else if (e.key === 'Enter' && selectedSearchIndex >= 0 && results[selectedSearchIndex]) {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('navigateToDate', {
                    detail: { date: results[selectedSearchIndex].date, machineId: results[selectedSearchIndex].machineId }
                  }));
                  setSearchAmount('');
                  setSelectedSearchIndex(-1);
                  closeSidebar();
                } else if (e.key === 'Escape') {
                  setSearchAmount('');
                  setSelectedSearchIndex(-1);
                }
              }}
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
            {searchAmount && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-50 max-h-60 overflow-y-auto">
                {(() => {
                  const results = records.filter(r =>
                    [r.mada, r.visa, r.mastercard, r.gcc, r.bankMada, r.bankVisa, r.bankMastercard, r.bankGcc, r.closingBalance, r.openingBalance]
                      .some(amt => amt && String(amt).includes(searchAmount))
                  ).slice(0, 10);

                  console.log('Search results:', results.length, 'for search:', searchAmount);

                  if (results.length === 0) {
                    return (
                      <div className="p-4 text-xs text-gray-500 text-center">
                        No records found with amount "{searchAmount}"
                      </div>
                    );
                  }

                  return results.map((record, index) => {
                    const machine = machines.find(m => m.id === record.machineId);
                    const isSelected = index === selectedSearchIndex;
                    return (
                      <div
                        key={record.id}
                        className={`p-2 border-b text-xs cursor-pointer ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                          }`}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('navigateToDate', {
                            detail: { date: record.date, machineId: record.machineId }
                          }));
                          setSearchAmount('');
                          setSelectedSearchIndex(-1);
                          closeSidebar();
                        }}
                      >
                        <div className="font-medium">{machine?.name} - {record.date}</div>
                        <div className="text-gray-600">
                          Mada: {record.mada}, Visa: {record.visa}, MC: {record.mastercard}, GCC: {record.gcc}
                        </div>
                        <div className="text-gray-500 text-[10px]">Closing: {record.closingBalance}</div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
          <NavLink to="/entry" className={navClass} onClick={closeSidebar}>
            <PlusCircle className="w-5 h-5 mr-3" />
            <span className="font-medium">Daily Entry</span>
          </NavLink>
          <NavLink to="/settings" className={navClass} onClick={closeSidebar}>
            <Settings className="w-5 h-5 mr-3" />
            <span className="font-medium">Machines</span>
          </NavLink>
          <NavLink to="/business" className={navClass} onClick={closeSidebar}>
            <Building2 className="w-5 h-5 mr-3" />
            <span className="font-medium">My Business</span>
          </NavLink>
          <NavLink to="/statement" className={navClass} onClick={closeSidebar}>
            <FileText className="w-5 h-5 mr-3" />
            <span className="font-medium">Statement</span>
          </NavLink>


          <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('exportToExcel'))}
              className="flex w-full items-center p-3 rounded-lg transition-colors text-slate-600 hover:bg-green-50 hover:text-green-600"
            >
              <Download className="w-5 h-5 mr-3" />
              <span className="font-medium">Export to Excel</span>
            </button>

            <button
              onClick={() => setShowSidebarClearConfirm(true)}
              className="flex w-full items-center p-3 rounded-lg transition-colors text-slate-600 hover:bg-red-50 hover:text-red-600"
            >
              <span className="font-medium">Clear Today's Entries</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between p-2 text-xs">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            {isOnline && (
              <button
                onClick={manualSync}
                disabled={isSyncing}
                className="p-1 hover:bg-slate-100 rounded"
                title="Sync now"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          {lastSync > 0 && (
            <div className="text-xs text-slate-400 px-2">
              Last sync: {new Date(lastSync).toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center p-3 rounded-lg transition-colors text-slate-600 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 md:ml-0">
        <div className="p-4 md:p-6 lg:p-8 pt-20 md:pt-4">
          <Outlet />
        </div>
      </main>

      {showSidebarClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold mb-4">Clear Today's Data</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to clear all entries for today? This will permanently delete them from Firebase.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSidebarClearConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('clearSelectedDate'));
                  setShowSidebarClearConfirm(false);
                }}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
