import React, { useEffect, useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { getRecords, getMachines } from '../services/storageService';
import { analyzeFinancials } from '../services/geminiService';
import { ReconcileRecord, Machine } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle, Loader2, Download } from 'lucide-react';
import { exportToXLSX } from '../services/exportService';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<ReconcileRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [recordsData, machinesData] = await Promise.all([
                getRecords(user.uid),
                getMachines(user.uid)
            ]);
            setRecords(recordsData);
            setMachines(machinesData);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            // Optionally set an error state here to show a message to the user
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, [user]);

  // Chart and total calculations remain the same, they operate on the fetched state
  const chartData = useMemo(() => {
    const dataByDate: Record<string, { date: string; totalMachine: number; totalBank: number; difference: number }> = {};
    records.forEach(r => {
      if (!dataByDate[r.date]) {
        dataByDate[r.date] = { date: r.date, totalMachine: 0, totalBank: 0, difference: 0 };
      }
      dataByDate[r.date].totalMachine += Number(r.machineTotal);
      dataByDate[r.date].totalBank += Number(r.bankCredit);
      dataByDate[r.date].difference += Number(r.difference);
    });
    return Object.values(dataByDate).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  }, [records]);

  const totals = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = records.filter(r => r.date === today);
    
    let totalOpening = 0;
    let totalClosing = 0;
    
    // Calculate for each machine
    machines.forEach(machine => {
      const todayRecord = todayRecords.find(r => r.machineId === machine.id);
      
      if (todayRecord) {
        totalOpening += Number(todayRecord.openingBalance || 0);
        totalClosing += Number(todayRecord.closingBalance || 0);
      } else {
        // Get previous day's closing balance as opening
        const sortedPrevRecords = records
          .filter(r => r.machineId === machine.id && r.date < today)
          .sort((a, b) => b.date.localeCompare(a.date));
        
        const lastRecord = sortedPrevRecords[0];
        const openingBalance = lastRecord ? Number(lastRecord.closingBalance || 0) : 0;
        
        totalOpening += openingBalance;
        totalClosing += openingBalance; // Same as opening since no transactions
      }
    });
    
    return {
      sales: todayRecords.reduce((acc, r) => acc + Number(r.machineTotal || 0), 0),
      bank: todayRecords.reduce((acc, r) => acc + Number(r.bankCredit || 0), 0),
      diff: totalClosing - totalOpening,
      opening: totalOpening,
      closing: totalClosing
    };
  }, [records, machines]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
        const result = await analyzeFinancials(records, machines);
        setAiAnalysis(result);
    } catch(error) {
        console.error("AI Analysis failed:", error);
        setAiAnalysis("Sorry, the AI analysis could not be completed at this time.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="ml-2 text-slate-500">Loading Dashboard...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">




      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Sales vs. Settlement (Last 7 Days)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{fontSize: 12}} /><YAxis tick={{fontSize: 12}} /><Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} /><Legend /><Bar dataKey="totalMachine" name="Machine Reported" fill="#3b82f6" radius={[4, 4, 0, 0]} /><Bar dataKey="totalBank" name="Bank Credit" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Net Balance Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{fontSize: 12}} /><YAxis tick={{fontSize: 12}} /><Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} /><Legend /><Line type="monotone" dataKey="difference" name="Net Balance" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} /></LineChart></ResponsiveContainer>
          </div>
        </div>
      </div>



      <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-xl shadow-sm border border-indigo-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-600" /><h3 className="text-lg font-semibold text-indigo-900">AI Financial Insight</h3></div>
          <button onClick={handleAnalyze} disabled={isAnalyzing} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze Discrepancies'}
          </button>
        </div>
        {aiAnalysis ? (
          <div className="prose prose-indigo max-w-none text-slate-700 bg-white p-4 rounded-lg border border-indigo-50 shadow-sm" dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n/g, '<br />') }}></div>
        ) : (
          <p className="text-slate-500 text-sm">Click analyze to get Gemini AI's take on your machine reconciliation variances.</p>
        )}
      </div>
    </div>
  );
};
