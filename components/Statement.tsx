import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download } from 'lucide-react';
import { getRecords, getMachines, getBusiness } from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';
import { Machine, ReconcileRecord } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { calculateSlipTotal, calculateStatementTotal, calculateDifference, calculateOpeningBalance, calculateClosingBalance } from '../services/balanceCalculationService';

export const Statement: React.FC = () => {
  const { user } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [selectedMachineWise, setSelectedMachineWise] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<ReconcileRecord[]>([]);
  const [allRecords, setAllRecords] = useState<ReconcileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'total' | 'machine'>('total');
  const [showNotification, setShowNotification] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      getMachines(user.id).then((machinesData) => {
        setMachines(machinesData);
        setSelectedMachines(machinesData.map(m => m.id));
        if (machinesData.length > 0) {
          setSelectedMachineWise(machinesData[0].id);
        }
      });
      getBusiness(user.id).then(setBusiness);
    }
  }, [user]);

  useEffect(() => {
    loadRecords();
  }, [selectedMachines, selectedMachineWise, startDate, endDate, user, activeTab]);

  const loadRecords = async () => {
    if (!startDate || !endDate || !user) {
      setRecords([]);
      return;
    }

    if (activeTab === 'total' && selectedMachines.length === 0) {
      setRecords([]);
      return;
    }

    if (activeTab === 'machine' && !selectedMachineWise) {
      setRecords([]);
      return;
    }

    try {
      const allRecs = await getRecords(user.id);
      setAllRecords(allRecs);
      const machineIds = activeTab === 'total' ? selectedMachines : [selectedMachineWise];
      const filteredRecords = allRecs.filter(record =>
        machineIds.includes(record.machineid) &&
        record.date >= startDate &&
        record.date <= endDate
      ).sort((a, b) => a.date.localeCompare(b.date));

      setRecords(filteredRecords);
    } catch (error) {
      console.error('Error loading records:', error);
    }
  };

  const handleMachineToggle = (machineId: string) => {
    setSelectedMachines(prev =>
      prev.includes(machineId)
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    );
  };

  const handleSelectAll = () => {
    setSelectedMachines(machines.map(m => m.id));
  };

  const handleDeselectAll = () => {
    setSelectedMachines([]);
  };

  const handleGenerateStatement = async () => {
    if (selectedMachines.length === 0 || !startDate || !endDate || !user || records.length === 0) return;

    setLoading(true);
    try {
      await generatePDF();
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    } catch (error) {
      console.error('Error generating statement:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!printRef.current) return;

    try {
      const originalWidth = printRef.current.style.width;
      printRef.current.style.width = '1200px';

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 1200
      });

      printRef.current.style.width = originalWidth;

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = `Business_Statement_${startDate}_to_${endDate}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const groupedRecords = records.reduce((acc, record) => {
    if (!acc[record.date]) {
      acc[record.date] = [];
    }
    acc[record.date].push(record);
    return acc;
  }, {} as Record<string, ReconcileRecord[]>);

  return (
    <div className="max-w-6xl mx-auto relative">
      {showNotification && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-in">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            <span>PDF Statement downloaded successfully!</span>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-600 p-2 rounded-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Business Statement</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {activeTab === 'machine' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Machine
            </label>
            <select
              value={selectedMachineWise}
              onChange={(e) => setSelectedMachineWise(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {machines.map(machine => (
                <option key={machine.id} value={machine.id}>
                  {machine.name} - {machine.bankName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('total')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'total' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Total Statement
            </button>
            <button
              onClick={() => setActiveTab('machine')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'machine' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Machine Wise
            </button>
          </div>
          <button
            onClick={handleGenerateStatement}
            disabled={(activeTab === 'total' && selectedMachines.length === 0) || (activeTab === 'machine' && !selectedMachineWise) || !startDate || !endDate || loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            {loading ? 'Generating...' : 'Download PDF Statement'}
          </button>
        </div>

        {records.length > 0 && (
          <>
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-medium text-slate-800 mb-2">Preview</h3>
              <p className="text-sm text-slate-600">
                Found {records.length} records for {activeTab === 'total' ? `${selectedMachines.length} machine(s)` : machines.find(m => m.id === selectedMachineWise)?.name} in the selected period.
              </p>
            </div>

            <div ref={printRef} className="mt-6 bg-white p-6 border rounded-lg overflow-x-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
              <div className="flex justify-between mb-6">
                {business && (
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold">{business.name}</h2>
                    {business.address && <p className="text-sm">{business.address}</p>}
                    <div className="flex gap-4 text-sm">
                      {business.phone && <span>Tel: {business.phone}</span>}
                      {business.email && <span>Email: {business.email}</span>}
                    </div>
                    {business.taxId && <p className="text-sm">Tax ID: {business.taxId}</p>}
                  </div>
                )}

                <div className="text-right space-y-2">
                  <p><strong>Machines:</strong> {selectedMachines.length}</p>
                  <p><strong>Printed:</strong> {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="text-center mb-4">
                <h1 className="text-lg font-bold">{activeTab === 'total' ? 'TOTAL' : machines.find(m => m.id === selectedMachineWise)?.name} RECONCILIATION STATEMENT ({new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()})</h1>
              </div>

              {activeTab === 'total' ? (
                <table className="w-full border-collapse border border-gray-300 mb-4">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="border border-gray-300 p-2 text-sm">Date</th>
                      <th className="border border-gray-300 p-2 text-sm">Machine</th>
                      <th className="border border-gray-300 p-2 text-sm">Opening</th>
                      <th className="border border-gray-300 p-2 text-sm">Slip Total</th>
                      <th className="border border-gray-300 p-2 text-sm">Statement Total</th>
                      <th className="border border-gray-300 p-2 text-sm">Difference</th>
                      <th className="border border-gray-300 p-2 text-sm">Closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const dates = [...new Set(records.map(r => r.date))].sort();
                      return dates.map(date => {
                        const dateRecords = records.filter(r => r.date === date);
                        return dateRecords.map((record, index) => {
                          const machine = machines.find(m => m.id === record.machineid);
                          const opening = calculateOpeningBalance(record.machineid, record.date, allRecords);
                          const slipTotal = calculateSlipTotal(record);
                          const statementTotal = calculateStatementTotal(record);
                          const diff = calculateDifference(record);
                          const closing = calculateClosingBalance(record.machineid, record.date, allRecords);
                          return (
                            <tr key={record.id}>
                              {index === 0 && (
                                <td className="border border-gray-300 p-2 text-sm" rowSpan={dateRecords.length}>
                                  {new Date(record.date).toLocaleDateString()}
                                </td>
                              )}
                              <td className="border border-gray-300 p-2 text-sm">{machine?.name}</td>
                              <td className={`border border-gray-300 p-2 text-sm text-right ${opening < 0 ? 'text-red-600' : 'text-green-600'}`}>{opening.toFixed(2)}</td>
                              <td className="border border-gray-300 p-2 text-sm text-right">{slipTotal.toFixed(2)}</td>
                              <td className="border border-gray-300 p-2 text-sm text-right">{statementTotal.toFixed(2)}</td>
                              <td className={`border border-gray-300 p-2 text-sm text-right ${diff < 0 ? 'text-red-600' : 'text-green-600'}`}>{diff.toFixed(2)}</td>
                              <td className={`border border-gray-300 p-2 text-sm text-right ${closing < 0 ? 'text-red-600' : 'text-green-600'}`}>{closing.toFixed(2)}</td>
                            </tr>
                          );
                        });
                      }).flat();
                    })()}
                  </tbody>
                </table>
              ) : (
                <div className="mb-6">
                  <h3 className="text-sm font-bold mb-2 bg-slate-100 p-2">{machines.find(m => m.id === selectedMachineWise)?.name}</h3>
                  <table className="w-full border-collapse border border-gray-300 mb-4">
                    <thead>
                      <tr className="bg-blue-600 text-white">
                        <th className="border border-gray-300 p-2 text-sm">Date</th>
                        <th className="border border-gray-300 p-2 text-sm">Opening</th>
                        <th className="border border-gray-300 p-2 text-sm">Slip Total</th>
                        <th className="border border-gray-300 p-2 text-sm">Statement Total</th>
                        <th className="border border-gray-300 p-2 text-sm">Difference</th>
                        <th className="border border-gray-300 p-2 text-sm">Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map(record => {
                        const opening = calculateOpeningBalance(record.machineid, record.date, allRecords);
                        const slipTotal = calculateSlipTotal(record);
                        const statementTotal = calculateStatementTotal(record);
                        const diff = calculateDifference(record);
                        const closing = calculateClosingBalance(record.machineid, record.date, allRecords);
                        return (
                          <tr key={record.id}>
                            <td className="border border-gray-300 p-2 text-sm">{new Date(record.date).toLocaleDateString()}</td>
                            <td className={`border border-gray-300 p-2 text-sm text-right ${opening < 0 ? 'text-red-600' : 'text-green-600'}`}>{opening.toFixed(2)}</td>
                            <td className="border border-gray-300 p-2 text-sm text-right">{slipTotal.toFixed(2)}</td>
                            <td className="border border-gray-300 p-2 text-sm text-right">{statementTotal.toFixed(2)}</td>
                            <td className={`border border-gray-300 p-2 text-sm text-right ${diff < 0 ? 'text-red-600' : 'text-green-600'}`}>{diff.toFixed(2)}</td>
                            <td className={`border border-gray-300 p-2 text-sm text-right ${closing < 0 ? 'text-red-600' : 'text-green-600'}`}>{closing.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t-2 border-black pt-4 mt-6">
                <h3 className="text-sm font-bold mb-3">Period Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p>Total Slip Sales: <strong>{records.reduce((sum, r) => sum + calculateSlipTotal(r), 0).toFixed(2)}</strong></p>
                    <p>Total Statement Credits: <strong>{records.reduce((sum, r) => sum + calculateStatementTotal(r), 0).toFixed(2)}</strong></p>
                  </div>
                  <div>
                    <p>Net Difference: <strong className={records.reduce((sum, r) => sum + calculateDifference(r), 0) < 0 ? 'text-red-600' : 'text-green-600'}>
                      {records.reduce((sum, r) => sum + calculateDifference(r), 0).toFixed(2)}
                    </strong></p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
