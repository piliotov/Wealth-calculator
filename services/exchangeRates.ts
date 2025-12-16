// Exchange rate service with daily updates
export type Currency = 'EUR' | 'USD' | 'BGN' | 'RSD' | 'HUF';

export interface ExchangeRates {
  EUR: number;
  USD: number;
  BGN: number;
  RSD: number; // Serbian Dinar
  HUF: number; // Hungarian Forint
  lastUpdated: string;
}

// Fallback rates (as of common rates, will be replaced by live data)
const FALLBACK_RATES: ExchangeRates = {
  EUR: 1,
  USD: 1.08,
  BGN: 1.95583,
  RSD: 117.25, // Approximate EUR to RSD
  HUF: 395.50, // Approximate EUR to HUF
  lastUpdated: new Date().toISOString()
};

let cachedRates: ExchangeRates = FALLBACK_RATES;
let lastFetch: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch live exchange rates from European Central Bank or fallback API
 * Rates are relative to EUR (base currency)
 */
export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();
  
  // Return cached rates if still fresh
  if (now - lastFetch < CACHE_DURATION && cachedRates) {
    return cachedRates;
  }

  try {
    // Try ECB API first (official European Central Bank rates)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
    
    if (!response.ok) throw new Error('Failed to fetch rates');
    
    const data = await response.json();
    
    const rates: ExchangeRates = {
      EUR: 1,
      USD: data.rates.USD || FALLBACK_RATES.USD,
      BGN: data.rates.BGN || FALLBACK_RATES.BGN,
      RSD: data.rates.RSD || FALLBACK_RATES.RSD,
      HUF: data.rates.HUF || FALLBACK_RATES.HUF,
      lastUpdated: new Date().toISOString()
    };
    
    cachedRates = rates;
    lastFetch = now;
    
    // Store in localStorage for offline access
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('exchangeRates', JSON.stringify(rates));
      localStorage.setItem('exchangeRatesTimestamp', now.toString());
    }
    
    return rates;
  } catch (error) {
    console.warn('Failed to fetch live exchange rates, using fallback:', error);
    
    // Try to load from localStorage if available
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('exchangeRates');
      const timestamp = localStorage.getItem('exchangeRatesTimestamp');
      
      if (stored && timestamp) {
        const storedTime = parseInt(timestamp);
        if (now - storedTime < 7 * CACHE_DURATION) { // Use stored rates up to 7 days
          return JSON.parse(stored);
        }
      }
    }
    
    return FALLBACK_RATES;
  }
}

/**
 * Get current exchange rates (from cache or fetch if needed)
 */
export function getExchangeRates(): ExchangeRates {
  return cachedRates;
}

/**
 * Convert amount from one currency to another
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  rates: ExchangeRates = cachedRates
): number {
  if (fromCurrency === toCurrency) return amount;
  
  // Convert to EUR first, then to target currency
  const amountInEUR = amount / rates[fromCurrency];
  const convertedAmount = amountInEUR * rates[toCurrency];
  
  return convertedAmount;
}

/**
 * Convert amount to EUR (base currency for calculations)
 */
export function toEUR(amount: number, currency: Currency, rates: ExchangeRates = cachedRates): number {
  return amount / rates[currency];
}

// Initialize rates on module load
if (typeof window !== 'undefined') {
  fetchExchangeRates().catch(console.warn);
  
  // Refresh rates daily
  setInterval(() => {
    fetchExchangeRates().catch(console.warn);
  }, CACHE_DURATION);
}
