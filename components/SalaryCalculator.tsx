import React, { useState } from 'react';
import { Account } from '../types';
import { Calculator, ArrowRight, Wallet, Check } from 'lucide-react';

interface Props {
  accounts: Account[];
  onAddIncome: (data: any) => Promise<void>;
}

const SalaryCalculator: React.FC<Props> = ({ accounts, onAddIncome }) => {
  const [hours, setHours] = useState(80); // Typical 20h/week
  const [rate, setRate] = useState(16.50);
  const [targetAccountId, setTargetAccountId] = useState(accounts.find(a => a.currency === 'EUR')?.id || accounts[0]?.id || '');
  const [added, setAdded] = useState(false);

  // Werkstudent Calculations
  const gross = hours * rate;
  const pension = gross * 0.093; // 9.3% Pension Insurance
  // Rudimentary Tax estimation for demo (Allowances vary, simplifying to 0 for student limits typically < 1200/mo tax free effectively)
  // If Gross > 1200, assume some tax logic or keep simple. Let's keep strict Werkstudent pension only for demo clarity.
  const tax = 0; 
  const net = gross - pension - tax;

  const handleAddToAccount = async () => {
    if (!targetAccountId) return;
    
    await onAddIncome({
      type: 'income',
      accountId: targetAccountId,
      amount: parseFloat(net.toFixed(2)),
      category: 'Salary',
      description: `Werkstudent Salary (${hours}h @ €${rate}/h)`,
      currency: 'EUR',
      date: new Date().toISOString()
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto bg-surface p-8 rounded-xl border border-slate-700 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-emerald-500/20 rounded-lg">
          <Calculator className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Salary Calculator</h2>
          <p className="text-slate-400 text-sm">Werkstudent Estimation (DE)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm text-slate-400 mb-2">Monthly Hours</label>
          <input
            type="number"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">Hourly Rate (€)</label>
          <input
            type="number"
            step="0.5"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 space-y-4 mb-8">
        <div className="flex justify-between text-slate-400">
          <span>Gross Income</span>
          <span>€{gross.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-red-400 text-sm">
          <span>Pension Insurance (9.3%)</span>
          <span>-€{pension.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-red-400 text-sm">
          <span>Est. Tax</span>
          <span>-€{tax.toFixed(2)}</span>
        </div>
        <div className="h-px bg-slate-700 my-2"></div>
        <div className="flex justify-between text-white font-bold text-lg">
          <span>Net Salary</span>
          <span className="text-emerald-400">€{net.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
            <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wide font-bold">Deposit To</label>
            <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white mb-4"
            >
                {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                ))}
            </select>
        </div>

        <button
          onClick={handleAddToAccount}
          disabled={added}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            added 
             ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50' 
             : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20'
          }`}
        >
          {added ? (
            <>
              <Check className="w-5 h-5" />
              Salary Added!
            </>
          ) : (
            <>
              <Wallet className="w-5 h-5" />
              Add Net Salary to Balance
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SalaryCalculator;