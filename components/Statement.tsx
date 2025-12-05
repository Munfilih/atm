import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';
import { getRecords, getMachines, getBusiness } from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';
import { Machine, ReconcileRecord } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const Statement: React.FC = () => {
  const { user } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<ReconcileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      getMachines(user.uid).then(setMachines);
      getBusiness(user.uid).then(setBusiness);
    }
  }, [user]);

  useEffect(() => {
    loadRecords();
  }, [selectedMachine, startDate, endDate, user]);

  const loadRecords = async () => {
    if (!selectedMachine || !startDate || !endDate || !user) {
      setRecords([]);
      return;
    }

    try {
      const allRecords = await getRecords(user.uid);
      const filteredRecords = allRecords.filter(record => 
        record.machineId === selectedMachine &&
        record.date >= startDate &&
        record.date <= endDate
      ).sort((a, b) => a.date.localeCompare(b.date));

      setRecords(filteredRecords);
    } catch (error) {
      console.error('Error loading records:', error);
    }
  };

  const handleGenerateStatement = async () => {
    if (!selectedMachine || !startDate || !endDate || !user || records.length === 0) return;

    setLoading(true);
    try {
      await generatePDF(records);
    } catch (error) {
      console.error('Error generating statement:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async (records: ReconcileRecord[]) => {
    const machine = machines.find(m => m.id === selectedMachine);
    if (!machine || !printRef.current) return;

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
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

      const filename = `${machine.name}_Statement_${startDate}_to_${endDate}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-600 p-2 rounded-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Generate Statement</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Machine
            </label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Choose a machine...</option>
              {machines.map(machine => (
                <option key={machine.id} value={machine.id}>
                  {machine.name} - {machine.bankName}
                </option>
              ))}
            </select>
          </div>

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

        <button
          onClick={handleGenerateStatement}
          disabled={!selectedMachine || !startDate || !endDate || loading}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          {loading ? 'Generating...' : 'Download PDF Statement'}
        </button>

        {records.length > 0 && (
          <>
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-medium text-slate-800 mb-2">Preview</h3>
              <p className="text-sm text-slate-600">
                Found {records.length} records for the selected period.
              </p>
            </div>
            
            <div ref={printRef} className="mt-6 bg-white p-6 border rounded-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
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
                  <p><strong>Machine:</strong> {machines.find(m => m.id === selectedMachine)?.name}</p>
                  <p><strong>Bank:</strong> {machines.find(m => m.id === selectedMachine)?.bankName}</p>
                  <p><strong>Printed:</strong> {new Date().toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="text-center mb-4">
                <h1 className="text-sm font-bold">ATM RECONCILIATION STATEMENT ({new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()})</h1>
              </div>
              
              <table className="w-full border-collapse border border-gray-300 mb-6">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-gray-300 p-2 text-xs">Date</th>
                    <th className="border border-gray-300 p-2 text-xs">Opening</th>
                    <th className="border border-gray-300 p-2 text-xs">Type</th>
                    <th className="border border-gray-300 p-2 text-xs">MADA</th>
                    <th className="border border-gray-300 p-2 text-xs">VISA</th>
                    <th className="border border-gray-300 p-2 text-xs">MC</th>
                    <th className="border border-gray-300 p-2 text-xs">GCC</th>
                    <th className="border border-gray-300 p-2 text-xs">Total</th>
                    <th className="border border-gray-300 p-2 text-xs">Difference</th>
                    <th className="border border-gray-300 p-2 text-xs">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <React.Fragment key={record.id}>
                      <tr className="bg-gray-50">
                        <td className="border border-gray-300 p-2 text-xs text-right" rowSpan={2}>{new Date(record.date).toLocaleDateString()}</td>
                        <td className={`border border-gray-300 p-2 text-xs text-right ${record.openingBalance > 0 ? 'text-green-600' : 'text-red-600'}`} rowSpan={2}>{record.openingBalance.toFixed(2)}</td>
                        <td className="border border-gray-300 p-2 text-xs font-bold">Slip</td>
                        <td className="border border-gray-300 p-2 text-xs text-right">{record.mada.toFixed(2)}</td>
                        <td className="border border-gray-300 p-2 text-xs text-right">{record.visa.toFixed(2)}</td>
                        <td className="border border-gray-300 p-2 text-xs text-right">{record.mastercard.toFixed(2)}</td>
                        <td className="border border-gray-300 p-2 text-xs text-right">{record.gcc.toFixed(2)}</td>
                        <td className="border border-gray-300 p-2 text-xs text-right font-bold">{record.machineTotal.toFixed(2)}</td>
                        <td className={`border border-gray-300 p-2 text-xs text-right font-bold ${record.difference >= 0 ? 'text-green-600' : 'text-red-600'}`} rowSpan={2}>{record.difference.toFixed(2)}</td>
                        <td className={`border border-gray-300 p-2 text-xs text-right ${record.closingBalance > 0 ? 'text-green-600' : 'text-red-600'}`} rowSpan={2}>{record.closingBalance.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 text-xs font-bold">Statement</td>
                        <td className="border border-gray-300 p-2 text-xs text-right">{(record.bankMada || 0).toFixed(2)}</td>
                        <td className="border border-gray-300 p-2 text-xs text-right">{(record.bankVisa || 0).toFixed(2)}</td>
                        <td className="border border-gray-300 p-2 text-xs text-right">{(record.bankMastercard || 0).toFixed(2)}</td>
                        <td className="border border-gray-300 p-2 text-xs text-right">{(record.bankGcc || 0).toFixed(2)}</td>
                        <td className="border border-gray-300 p-2 text-xs text-right font-bold">{record.bankCredit.toFixed(2)}</td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              
              <div className="space-y-1">
                <p>Total Machine Sales: {records.reduce((sum, r) => sum + r.machineTotal, 0).toFixed(2)}</p>
                <p>Total Bank Credits: {records.reduce((sum, r) => sum + r.bankCredit, 0).toFixed(2)}</p>
                <p>Net Difference: {records.reduce((sum, r) => sum + r.difference, 0).toFixed(2)}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};