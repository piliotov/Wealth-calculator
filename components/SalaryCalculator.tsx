import React, { useState } from 'react';
import { Account } from '../types';
import { Calculator, ArrowRight, Wallet, Check } from 'lucide-react';
import { useToast } from './ToastContainer';

interface Props {
  accounts: Account[];
  onAddIncome: (data: any) => Promise<void>;
}

// German Tax Classes (Steuerklasse)
type TaxClass = 1 | 2 | 3 | 4 | 5 | 6;
type EmploymentType = 'regular' | 'werkstudent' | 'minijob';

const SalaryCalculator: React.FC<Props> = ({ accounts, onAddIncome }) => {
  const [employmentType, setEmploymentType] = useState<EmploymentType>('werkstudent');
  const [hours, setHours] = useState(80); // Monthly hours for Werkstudent
  const [hourlyRate, setHourlyRate] = useState(16.50);
  const [taxClass, setTaxClass] = useState<TaxClass>(1);
  const [hasChurchTax, setHasChurchTax] = useState(false);
  const [targetAccountId, setTargetAccountId] = useState(accounts.find(a => a.currency === 'EUR')?.id || accounts[0]?.id || '');
  const [added, setAdded] = useState(false);
  const { showToast } = useToast();

  // Calculate gross based on employment type
  const grossMonthly = employmentType === 'werkstudent' || employmentType === 'minijob' 
    ? hours * hourlyRate 
    : hours * hourlyRate; // Can be overridden for regular employees

  // Calculate yearly gross for tax brackets
  const grossYearly = grossMonthly * 12;

  // 2025 German Tax Calculation - Updated with correct Grundfreibetrag
  const calculateIncomeTax = (yearlyIncome: number, taxClass: TaxClass): number => {
    // Basic allowance (Grundfreibetrag) 2025 - Updated to 12,084€
    const basicAllowance = 12084;
    
    // Tax class specific adjustments
    const allowances = {
      1: basicAllowance,
      2: basicAllowance + 4260, // Single parent allowance (Entlastungsbetrag)
      3: basicAllowance * 2, // Married, higher earner (24,168€)
      4: basicAllowance, // Married, equal earners
      5: 0, // Married, lower earner (partner has class 3)
      6: 0 // Second job, no allowances
    };

    const taxableIncome = Math.max(0, yearlyIncome - allowances[taxClass]);
    
    if (taxableIncome === 0) return 0;

    // Progressive tax rates (Einkommensteuer 2025) - Standard German formula
    let tax = 0;
    
    if (taxableIncome <= 17005) {
      // Zone 1: 14% - 23.97% (linear progression)
      const y = (taxableIncome - basicAllowance) / 10000;
      tax = (922.98 * y + 1400) * y;
    } else if (taxableIncome <= 66760) {
      // Zone 2: 23.97% - 42% (linear progression)
      const z = (taxableIncome - 17005) / 10000;
      tax = (181.19 * z + 2397) * z + 1025.38;
    } else if (taxableIncome <= 277825) {
      // Zone 3: 42%
      tax = 0.42 * taxableIncome - 10602.13;
    } else {
      // Zone 4: 45% (Reichensteuer)
      tax = 0.45 * taxableIncome - 18936.88;
    }

    return Math.max(0, tax);
  };

  // Solidarity surcharge (Solidaritätszuschlag) - 5.5% of income tax, only if tax > 18130
  const calculateSolidarityTax = (incomeTax: number): number => {
    const yearlyIncomeTax = incomeTax;
    if (yearlyIncomeTax <= 18130) return 0;
    if (yearlyIncomeTax <= 33652) {
      // Gradual phase-in
      return (yearlyIncomeTax - 18130) * 0.119;
    }
    return yearlyIncomeTax * 0.055;
  };

  // Social security contributions (Sozialversicherung) 2025
  // Updated rates from brutto-netto-rechner.info
  // Werkstudent (student worker): Only pays pension insurance (9.3%) if earning > 520€/month
  // Minijob (≤520€/month): No employee contributions
  // Regular employee: All contributions
  
  let healthInsurance = 0;
  let healthInsuranceExtra = 0;
  let pensionInsurance = 0;
  let unemploymentInsurance = 0;
  let nursingInsurance = 0;

  if (employmentType === 'regular') {
    // 2025 rates: KV 7.3%, RV 9.3%, AV 1.3%, PV 1.7-2.3% (average 1.7% for 1 child)
    healthInsurance = grossMonthly * 0.073; // 7.3% employee share
    healthInsuranceExtra = grossMonthly * 0.025; // 2.5% average Zusatzbeitrag (updated from website)
    pensionInsurance = grossMonthly * 0.093; // 9.3% employee share (18.6% total / 2)
    unemploymentInsurance = grossMonthly * 0.013; // 1.3% employee share (2.6% total / 2)
    nursingInsurance = grossMonthly * 0.017; // 1.7% base rate (for 1 child, no childless surcharge)
  } else if (employmentType === 'werkstudent') {
    // Werkstudent only pays pension insurance (9.3%) if above 520€ (Minijob threshold)
    pensionInsurance = grossMonthly > 520 ? grossMonthly * 0.093 : 0;
    // No health, unemployment, or nursing insurance for students under 20h/week
  } else if (employmentType === 'minijob') {
    // Minijob (≤520€): No employee contributions at all
    // Employer pays flat-rate contributions, but employee pays nothing
  }

  const totalSocialSecurity = healthInsurance + healthInsuranceExtra + pensionInsurance + 
                               unemploymentInsurance + nursingInsurance;

  // Income tax calculations
  const yearlyIncomeTax = calculateIncomeTax(grossYearly, taxClass);
  const monthlyIncomeTax = yearlyIncomeTax / 12;
  
  const yearlySoli = calculateSolidarityTax(yearlyIncomeTax);
  const monthlySoli = yearlySoli / 12;

  // Church tax (Kirchensteuer) - 8% or 9% of income tax depending on state
  const monthlyChurchTax = hasChurchTax ? monthlyIncomeTax * 0.09 : 0;

  // Total deductions
  const totalDeductions = totalSocialSecurity + monthlyIncomeTax + monthlySoli + monthlyChurchTax;
  const netSalary = grossMonthly - totalDeductions;

  const handleAddToAccount = async () => {
    if (!targetAccountId) return;
    
    await onAddIncome({
      type: 'income',
      accountId: targetAccountId,
      amount: parseFloat(netSalary.toFixed(2)),
      category: 'Salary',
      description: `${employmentType === 'werkstudent' ? 'Werkstudent' : employmentType === 'minijob' ? 'Minijob' : 'Salary'} (Tax Class ${taxClass}, Gross: €${grossMonthly.toFixed(2)})`,
      currency: 'EUR',
      date: new Date().toISOString()
    });
    setAdded(true);
    showToast('Net salary added to account', 'success');
    setTimeout(() => setAdded(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto bg-surface p-8 rounded-xl border border-slate-700 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-emerald-500/20 rounded-lg">
          <Calculator className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">German Salary Calculator</h2>
          <p className="text-slate-400 text-sm">2025 Tax & Social Security (based on brutto-netto-rechner.info)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-3">
          <label className="block text-sm text-slate-400 mb-2">Employment Type</label>
          <select
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="werkstudent">Werkstudent (Student Worker)</option>
            <option value="regular">Regular Employee (Vollzeit/Teilzeit)</option>
            <option value="minijob">Minijob (≤520€)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm text-slate-400 mb-2">Monthly Hours</label>
          <input
            type="number"
            step="1"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">Hourly Rate (€)</label>
          <input
            type="number"
            step="0.50"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center text-white">
          <span className="font-semibold">Calculated Gross Monthly:</span>
          <span className="text-2xl font-bold text-emerald-400">€{grossMonthly.toFixed(2)}</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">{hours} hours × €{hourlyRate.toFixed(2)}/hour</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm text-slate-400 mb-2">Tax Class (Steuerklasse)</label>
          <select
            value={taxClass}
            onChange={(e) => setTaxClass(Number(e.target.value) as TaxClass)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value={1}>Class 1 - Single</option>
            <option value={2}>Class 2 - Single parent</option>
            <option value={3}>Class 3 - Married (higher earner)</option>
            <option value={4}>Class 4 - Married (equal earners)</option>
            <option value={5}>Class 5 - Married (lower earner)</option>
            <option value={6}>Class 6 - Second job</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer pb-3">
            <input
              type="checkbox"
              checked={hasChurchTax}
              onChange={(e) => setHasChurchTax(e.target.checked)}
              className="w-4 h-4 bg-slate-900 border-slate-700 rounded"
            />
            <span className="text-sm">Church Tax (Kirchensteuer - 9%)</span>
          </label>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 space-y-3 mb-8">
        <div className="flex justify-between text-white font-semibold text-lg mb-3">
          <span>Gross Salary</span>
          <span>€{grossMonthly.toFixed(2)}</span>
        </div>
        
        <div className="border-t border-slate-700 pt-3 space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-bold mb-2">
            Social Security (Sozialversicherung) - 2025 Rates
            {employmentType === 'werkstudent' && <span className="ml-2 text-amber-400">⚠ Student: Reduced</span>}
            {employmentType === 'minijob' && <span className="ml-2 text-emerald-400">✓ Minijob: Tax-free</span>}
          </p>
          {healthInsurance + healthInsuranceExtra > 0 && (
            <div className="flex justify-between text-red-400 text-sm">
              <span>Health Insurance (7.3% + 2.5% extra)</span>
              <span>-€{(healthInsurance + healthInsuranceExtra).toFixed(2)}</span>
            </div>
          )}
          {pensionInsurance > 0 && (
            <div className="flex justify-between text-red-400 text-sm">
              <span>Pension Insurance (9.3%)</span>
              <span>-€{pensionInsurance.toFixed(2)}</span>
            </div>
          )}
          {unemploymentInsurance > 0 && (
            <div className="flex justify-between text-red-400 text-sm">
              <span>Unemployment Insurance (1.3%)</span>
              <span>-€{unemploymentInsurance.toFixed(2)}</span>
            </div>
          )}
          {nursingInsurance > 0 && (
            <div className="flex justify-between text-red-400 text-sm">
              <span>Nursing Care Insurance (1.7%)</span>
              <span>-€{nursingInsurance.toFixed(2)}</span>
            </div>
          )}
          {totalSocialSecurity === 0 && (
            <div className="text-emerald-400 text-sm italic">No social security contributions required</div>
          )}
        </div>

        <div className="border-t border-slate-700 pt-3 space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-bold mb-2">Taxes</p>
          <div className="flex justify-between text-red-400 text-sm">
            <span>Income Tax (Einkommensteuer)</span>
            <span>-€{monthlyIncomeTax.toFixed(2)}</span>
          </div>
          {monthlySoli > 0 && (
            <div className="flex justify-between text-red-400 text-sm">
              <span>Solidarity Surcharge (5.5%)</span>
              <span>-€{monthlySoli.toFixed(2)}</span>
            </div>
          )}
          {monthlyChurchTax > 0 && (
            <div className="flex justify-between text-red-400 text-sm">
              <span>Church Tax (9%)</span>
              <span>-€{monthlyChurchTax.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="h-px bg-slate-700 my-3"></div>
        
        <div className="flex justify-between text-slate-400 text-sm">
          <span>Total Deductions</span>
          <span>-€{totalDeductions.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between text-white font-bold text-xl pt-2">
          <span>Net Salary</span>
          <span className="text-emerald-400">€{netSalary.toFixed(2)}</span>
        </div>
        
        <div className="pt-2 text-xs text-slate-500 text-center">
          Effective tax rate: {((totalDeductions / grossMonthly) * 100).toFixed(1)}%
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