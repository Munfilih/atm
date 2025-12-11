import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, List, Monitor } from 'lucide-react';
import { getRecords, getMachines, getBusiness } from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';
import { Machine, ReconcileRecord } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { calculateSlipTotal, calculateStatementTotal, calculateDifference, calculateOpeningBalance, calculateClosingBalance } from '../services/balanceCalculationService';
import { initializeArialFonts } from '../services/arialFonts';

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
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');

      // Initialize Arial fonts
      await initializeArialFonts(pdf);

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10; // Minimal margins for maximum content width
      let yPos = margin + 5;
      let pageNumber = 1;

      const drawPageHeader = (isFirstPage = false, machineInfo: Machine | null = null) => {
        let headerY = margin + 5;

        // Common header elements
        const startFormatted = new Date(startDate).toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
        const endFormatted = new Date(endDate).toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });

        if (isFirstPage) {
          // Business Details - Top Left
          pdf.setFontSize(12);
          pdf.setFont('Arial', 'bold');
          pdf.text('SEMAKA SUPER MARKET', margin, headerY);

          // Printed Date/Time - Top Right
          const now = new Date();
          const printDateTime = now.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          pdf.setFontSize(8);
          pdf.setFont('Arial', 'normal');
          pdf.text(`Printed: ${printDateTime}`, pageWidth - margin, headerY, { align: 'right' });

          headerY += 4;

          // Machine name and bank name - Top Right (under printed date)
          if (machineInfo && machineInfo.name) {
            pdf.setFontSize(9);
            pdf.setFont('Arial', 'bold');
            pdf.text(machineInfo.name, pageWidth - margin, headerY, { align: 'right' });
            headerY += 4;
            if (machineInfo.bankname) {
              pdf.setFontSize(8);
              pdf.setFont('Arial', 'normal');
              pdf.text(machineInfo.bankname, pageWidth - margin, headerY, { align: 'right' });
            }
          }

          // Reset headerY for left side content
          headerY = margin + 12;

          // Address and contact - Left aligned
          pdf.setFontSize(9);
          pdf.setFont('Arial', 'normal');
          pdf.text('20TH STREET, BAYOUNIA. THUQBAH, DAMMAM', margin, headerY);
          headerY += 4;
          pdf.text('Tel: +966570523372', margin, headerY);
          headerY += 15;
        } else {
          // Same header format for continuation pages
          pdf.setFontSize(12);
          pdf.setFont('Arial', 'bold');
          pdf.text('SEMAKA SUPER MARKET', margin, headerY);

          // Printed Date/Time - Top Right
          const now = new Date();
          const printDateTime = now.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          pdf.setFontSize(8);
          pdf.setFont('Arial', 'normal');
          pdf.text(`Printed: ${printDateTime}`, pageWidth - margin, headerY, { align: 'right' });

          headerY += 4;

          // Machine name and bank name - Top Right (under printed date)
          if (machineInfo && machineInfo.name) {
            pdf.setFontSize(9);
            pdf.setFont('Arial', 'bold');
            pdf.text(machineInfo.name, pageWidth - margin, headerY, { align: 'right' });
            headerY += 4;
            if (machineInfo.bankname) {
              pdf.setFontSize(8);
              pdf.setFont('Arial', 'normal');
              pdf.text(machineInfo.bankname, pageWidth - margin, headerY, { align: 'right' });
            }
          }

          // Reset headerY for left side content
          headerY = margin + 12;

          // Address and contact - Left aligned
          pdf.setFontSize(9);
          pdf.setFont('Arial', 'normal');
          pdf.text('20TH STREET, BAYOUNIA. THUQBAH, DAMMAM', margin, headerY);
          headerY += 4;
          pdf.text('Tel: +966570523372', margin, headerY);
          headerY += 15;
        }

        // Single combined header - reconciliation statement with period (no machine name here)
        pdf.setFontSize(12);
        pdf.setFont('Arial', 'normal');
        const headerText = `RECONCILIATION STATEMENT - Period: ${startFormatted} to ${endFormatted}`;
        console.log('Header text:', headerText, 'Machine info:', machineInfo);
        pdf.text(headerText, pageWidth / 2, headerY, { align: 'center' });
        headerY += 10;

        // Page number
        pdf.setFontSize(8);
        pdf.setFont('Arial', 'normal');
        pdf.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - margin, { align: 'right' });

        return headerY;
      };

      const drawTableHeader = (startY: number) => {
        // Professional table setup
        const headers = activeTab === 'machine'
          ? ['Date', 'Opening', 'Slip Total', 'Statement', 'Difference', 'Closing']
          : ['Date', 'Machine', 'Opening', 'Slip Total', 'Statement', 'Difference', 'Closing'];
        const tableWidth = pageWidth - 2 * margin;
        const colWidths = activeTab === 'machine'
          ? [
            tableWidth * 0.20, // Date 20%
            tableWidth * 0.16, // Opening 16%
            tableWidth * 0.16, // Slip Total 16%
            tableWidth * 0.16, // Statement 16%
            tableWidth * 0.16, // Difference 16%
            tableWidth * 0.16  // Closing 16%
          ]
          : [
            tableWidth * 0.12, // Date 12%
            tableWidth * 0.22, // Machine 22% (increased)
            tableWidth * 0.132, // Opening 13.2%
            tableWidth * 0.132, // Slip Total 13.2%
            tableWidth * 0.132, // Statement 13.2%
            tableWidth * 0.132, // Difference 13.2%
            tableWidth * 0.132  // Closing 13.2%
          ];

        // Single table header - NO BORDERS
        let xPos = margin;

        // Header background - light gray, no borders
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, startY - 4, tableWidth, 10, 'F');

        // Header text - normal weight, center aligned
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(9);
        pdf.setFont('Arial', 'normal');

        headers.forEach((header, i) => {
          pdf.text(header, xPos + (colWidths[i] / 2), startY + 2, { align: 'center' });
          xPos += colWidths[i];
        });

        // Reset font size for table content after header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        
        return { nextY: startY + 10, colWidths, tableWidth };
      };

      // Get machine name for header if machine-wise
      const machineForHeader = activeTab === 'machine' ? machines.find(m => m.id === selectedMachineWise) : null;
      console.log('Machine for header:', machineForHeader);

      // Draw first page header
      yPos = drawPageHeader(true, machineForHeader);

      // Draw first table header
      const tableResult = drawTableHeader(yPos);
      yPos = tableResult.nextY;
      const { colWidths, tableWidth } = tableResult;

      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);

      // Table rows
      const dates = [...new Set(records.map(r => r.date))].sort();
      let rowCount = 0;

      if (activeTab === 'machine') {
        // Machine-wise: single column date format
        records.forEach((record, recordIndex) => {
          // Check for page break
          if (yPos > pageHeight - 50) {
            pdf.addPage();
            pageNumber++;
            yPos = drawPageHeader(false, machineForHeader);
            const newTableResult = drawTableHeader(yPos);
            yPos = newTableResult.nextY;
            // Ensure font size is reset for table content
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
          }

          const machine = machines.find(m => m.id === record.machineid);
          const opening = calculateOpeningBalance(record.machineid, record.date, allRecords);
          const slipTotal = calculateSlipTotal(record);
          const statementTotal = calculateStatementTotal(record);
          const diff = calculateDifference(record);
          const closing = calculateClosingBalance(record.machineid, record.date, allRecords);

          // Format date as single line: "Mon, 25 Dec 2025"
          const dateObj = new Date(record.date);
          const formattedDate = dateObj.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });

          const rowHeight = 7;
          const isOddRow = recordIndex % 2 === 1;

          // Draw row with alternating background
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.3);

          if (isOddRow) {
            pdf.setFillColor(240, 240, 240); // Light grey for odd rows
            pdf.rect(margin, yPos - 2, tableWidth, rowHeight, 'FD');
            // Add column borders for grey background
            let borderX = margin;
            for (let i = 0; i < colWidths.length - 1; i++) {
              borderX += colWidths[i];
              pdf.line(borderX, yPos - 2, borderX, yPos + 5);
            }
          } else {
            // Draw individual cells
            let xPos = margin;
            for (let i = 0; i < colWidths.length; i++) {
              pdf.rect(xPos, yPos - 2, colWidths[i], rowHeight, 'D');
              xPos += colWidths[i];
            }
          }

          // Date text in first column (single line, centered)
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('Arial', 'normal');
          pdf.text(formattedDate, margin + colWidths[0] / 2, yPos + 2, { align: 'center' });

          // Fill data columns
          const rowData = [
            opening.toFixed(2),
            slipTotal.toFixed(2),
            statementTotal.toFixed(2),
            diff.toFixed(2),
            closing.toFixed(2)
          ];

          let xPos = margin + colWidths[0]; // Start after date column
          rowData.forEach((data, i) => {
            // Color Opening (i=0), Difference (i=3), Closing (i=4)
            if (i === 0 || i === 3 || i === 4) {
              const value = parseFloat(data);
              if (value < 0) {
                pdf.setTextColor(255, 0, 0); // Red for negative
              } else if (value > 0) {
                pdf.setTextColor(0, 128, 0); // Green for positive
              } else {
                pdf.setTextColor(0, 0, 0); // Black for zero
              }
            } else {
              pdf.setTextColor(0, 0, 0); // Black for other columns
            }

            // All numbers - right align
            pdf.text(data, xPos + colWidths[i + 1] - 2, yPos + 2, { align: 'right' });
            xPos += colWidths[i + 1];
          });

          pdf.setTextColor(0, 0, 0);
          yPos += rowHeight;
          rowCount++;
        });
      } else {
        // Total statement: merged date format (existing code)
        dates.forEach((date, dateIndex) => {
          const dateRecords = records.filter(r => r.date === date);

          // Single merged date cell for all records of this date
          if (dateRecords.length > 0) {
            // Check for page break
            if (yPos > pageHeight - 50) {
              pdf.addPage();
              pageNumber++;
              yPos = drawPageHeader(false, machineForHeader);
              const newTableResult = drawTableHeader(yPos);
              yPos = newTableResult.nextY;
              // Ensure font size is reset for table content
              pdf.setFontSize(9);
              pdf.setFont('helvetica', 'normal');
            }

            // Format date as multiline: "Mon, 25" and "Dec 2025"
            const dateObj = new Date(date);
            const dayLine = dateObj.toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric'
            });
            const monthYearLine = dateObj.toLocaleDateString('en-GB', {
              month: 'short',
              year: 'numeric'
            });

            const dateRowHeight = dateRecords.length * 7;
            const isOddDate = dateIndex % 2 === 1;

            // Draw merged date cell with alternating background
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.3);

            if (isOddDate) {
              pdf.setFillColor(240, 240, 240); // Light grey for odd dates
              pdf.rect(margin, yPos - 2, tableWidth, dateRowHeight, 'FD');
              // Add column borders for grey background
              let borderX = margin;
              for (let i = 0; i < colWidths.length - 1; i++) {
                borderX += colWidths[i];
                pdf.line(borderX, yPos - 2, borderX, yPos - 2 + dateRowHeight);
              }
            } else {
              pdf.rect(margin, yPos - 2, colWidths[0], dateRowHeight, 'D');
            }

            // Date text in merged cell (multiline, centered)
            pdf.setTextColor(0, 0, 0);
            pdf.setFont('Arial', 'normal');
            const centerY = yPos + (dateRowHeight / 2);
            pdf.text(dayLine, margin + colWidths[0] / 2, centerY - 2, { align: 'center' });
            pdf.text(monthYearLine, margin + colWidths[0] / 2, centerY + 2, { align: 'center' });

            // Draw machine records for this date
            dateRecords.forEach((record, index) => {
              const machine = machines.find(m => m.id === record.machineid);
              const opening = calculateOpeningBalance(record.machineid, record.date, allRecords);
              const slipTotal = calculateSlipTotal(record);
              const statementTotal = calculateStatementTotal(record);
              const diff = calculateDifference(record);
              const closing = calculateClosingBalance(record.machineid, record.date, allRecords);

              const rowData = [
                machine?.name && machine?.bankname ? `${machine.name} - ${machine.bankname}` : (machine?.name || ''),
                opening.toFixed(2),
                slipTotal.toFixed(2),
                statementTotal.toFixed(2),
                diff.toFixed(2),
                closing.toFixed(2)
              ];

              const rowHeight = 7;

              // Draw cells for data (skip date column)
              let xPos = margin + colWidths[0];
              for (let i = 1; i < colWidths.length; i++) {
                if (!isOddDate) {
                  pdf.rect(xPos, yPos - 2, colWidths[i], rowHeight, 'D');
                } else {
                  // For grey background, only draw horizontal lines
                  pdf.line(xPos, yPos - 2, xPos + colWidths[i], yPos - 2);
                  pdf.line(xPos, yPos + 5, xPos + colWidths[i], yPos + 5);
                }
                xPos += colWidths[i];
              }

              // Fill cell data with correct column alignment
              xPos = margin + colWidths[0]; // Start after date column
              rowData.forEach((data, i) => {
                // For total: Opening (i=1), Difference (i=4), Closing (i=5)
                if (i === 1 || i === 4 || i === 5) {
                  const value = parseFloat(data);
                  if (value < 0) {
                    pdf.setTextColor(255, 0, 0); // Red for negative
                  } else if (value > 0) {
                    pdf.setTextColor(0, 128, 0); // Green for positive
                  } else {
                    pdf.setTextColor(0, 0, 0); // Black for zero
                  }
                } else {
                  pdf.setTextColor(0, 0, 0); // Black for other columns
                }

                if (i === 0) { // Machine name - left align
                  pdf.text(data, xPos + 2, yPos + 2);
                } else { // All numbers - right align
                  pdf.text(data, xPos + colWidths[i + 1] - 2, yPos + 2, { align: 'right' });
                }
                xPos += colWidths[i + 1]; // Move to next column
              });

              pdf.setTextColor(0, 0, 0);
              yPos += rowHeight;
              rowCount++;
            });
          }
        });
      }

      // Summary in BOTTOM-RIGHT BOX with border
      yPos += 5;
      if (yPos > pageHeight - 50) {
        pdf.addPage();
        yPos = margin + 20;
      }

      const totalSlip = records.reduce((sum, r) => sum + calculateSlipTotal(r), 0);
      const totalStatement = records.reduce((sum, r) => sum + calculateStatementTotal(r), 0);
      const netDiff = records.reduce((sum, r) => sum + calculateDifference(r), 0);

      // Summary box dimensions
      const boxWidth = 70;
      const boxHeight = 35;
      const boxX = pageWidth - margin - boxWidth;
      const boxY = yPos;

      // Summary box without border

      // Summary title - larger and left aligned
      pdf.setFontSize(11);
      pdf.setFont('Arial', 'bold');
      pdf.text('PERIOD SUMMARY', boxX + 3, boxY + 8);

      // Summary data - structured layout with larger font
      pdf.setFontSize(10);
      pdf.setFont('Arial', 'normal');

      // Left labels, right values
      pdf.text('Total Slip:', boxX + 3, boxY + 16);
      pdf.text(totalSlip.toFixed(2), boxX + boxWidth - 3, boxY + 16, { align: 'right' });

      pdf.text('Total Statement:', boxX + 3, boxY + 22);
      pdf.text(totalStatement.toFixed(2), boxX + boxWidth - 3, boxY + 22, { align: 'right' });

      // Net difference with separator line
      pdf.setLineWidth(0.3);
      pdf.line(boxX + 3, boxY + 25, boxX + boxWidth - 3, boxY + 25);

      pdf.text('Net Difference:', boxX + 3, boxY + 31);

      // Net difference: red if negative, green if positive
      if (netDiff < 0) {
        pdf.setTextColor(255, 0, 0); // Red for negative
      } else if (netDiff > 0) {
        pdf.setTextColor(0, 128, 0); // Green for positive
      } else {
        pdf.setTextColor(0, 0, 0); // Black for zero
      }
      pdf.setFont('Arial', 'bold');
      pdf.text(netDiff.toFixed(2), boxX + boxWidth - 3, boxY + 31, { align: 'right' });
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('Arial', 'normal');

      const filename = `Statement_${startDate}_to_${endDate}.pdf`;
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
                  {machine.name} - {machine.bankname}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('total')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${activeTab === 'total' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <List className="w-4 h-4" />
              <span className="text-sm">Total</span>
            </button>
            <button
              onClick={() => setActiveTab('machine')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${activeTab === 'machine' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <Monitor className="w-4 h-4" />
              <span className="text-sm">Machine</span>
            </button>
          </div>
          <button
            onClick={handleGenerateStatement}
            disabled={(activeTab === 'total' && selectedMachines.length === 0) || (activeTab === 'machine' && !selectedMachineWise) || !startDate || !endDate || loading}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title={loading ? 'Generating...' : 'Download PDF Statement'}
          >
            <Download className="w-5 h-5" />
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

            <div ref={printRef} className="mt-6 bg-white p-6 border rounded-lg max-w-4xl mx-auto" style={{ fontFamily: 'Arial, sans-serif', aspectRatio: '210/297' }}>
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
                  <p><strong>Machine:</strong> {activeTab === 'total' ? `${selectedMachines.length} machines` : machines.find(m => m.id === selectedMachineWise)?.name}</p>
                  <p><strong>Printed:</strong> {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="text-center mb-4">
                <h1 className="text-lg font-bold">{activeTab === 'total' ? 'TOTAL' : `${machines.find(m => m.id === selectedMachineWise)?.name} MACHINE WISE`} RECONCILIATION STATEMENT ({new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()})</h1>
              </div>

              {activeTab === 'total' ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 mb-4 min-w-max">
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
                                <td className="border border-gray-300 p-2 text-sm">{machine?.name && machine?.bankname ? `${machine.name} - ${machine.bankname}` : (machine?.name || '')}</td>
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
                </div>
              ) : (
                <div className="mb-6">
                  <h3 className="text-sm font-bold mb-2 bg-slate-100 p-2">{machines.find(m => m.id === selectedMachineWise)?.name}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 mb-4 min-w-max">
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
