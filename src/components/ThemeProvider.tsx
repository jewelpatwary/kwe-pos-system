import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

type FontFamily = string;
type FontSize = 'sm' | 'base' | 'lg';
type Currency = { code: string; symbol: string; label: string };

const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', label: 'US_DOLLAR' },
  { code: 'MYR', symbol: 'RM', label: 'MY_RINGGIT' },
  { code: 'BDT', symbol: '৳', label: 'BD_TAKA' },
  { code: 'EUR', symbol: '€', label: 'EU_EURO' },
  { code: 'GBP', symbol: '£', label: 'UK_POUND' },
  { code: 'INR', symbol: '₹', label: 'IN_RUPEE' },
];

const DEFAULT_FONTS: Record<string, string> = {
  sans: 'Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace'
};

interface ThemeContextType {
  fontFamily: FontFamily;
  fontSize: FontSize;
  currency: Currency;
  dateFormat: string;
  taxRate: number;
  timezone: string;
  setFontFamily: (font: FontFamily) => void;
  setFontSize: (size: FontSize) => void;
  setCurrency: (code: string) => void;
  setDateFormat: (format: string) => void;
  setTaxRate: (rate: number) => void;
  setTimezone: (tz: string) => void;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  const [fontFamily, setFontFamilyState] = useState<FontFamily>('sans');
  const [fontSize, setFontSizeState] = useState<FontSize>('base');
  const [currency, setCurrencyState] = useState<Currency>(CURRENCIES[1]); // Default MYR
  const [dateFormat, setDateFormatState] = useState<string>('MM/DD/YYYY');
  const [taxRate, setTaxRateState] = useState<number>(8.5);
  const [timezone, setTimezoneState] = useState<string>('ASIA/KUALA_LUMPUR');
  const [loading, setLoading] = useState(true);

  // FETCH THEME SETTINGS FROM SERVER
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchTheme = async () => {
      try {
        const res = await fetch('/api/settings/theme', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success && result.data) {
          const { font_family, font_size, currency_code, date_format, tax_rate, timezone } = result.data;
          if (font_family) setFontFamilyState(font_family);
          if (font_size && ['sm', 'base', 'lg'].includes(font_size)) setFontSizeState(font_size as FontSize);
          if (currency_code) {
            const found = CURRENCIES.find(c => c.code === currency_code);
            if (found) setCurrencyState(found);
          }
          if (date_format) setDateFormatState(date_format);
          if (tax_rate) setTaxRateState(parseFloat(tax_rate));
          if (timezone) setTimezoneState(timezone);
        }
      } catch (err) {
        console.error('Failed to fetch theme settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTheme();
  }, [token]);

  // SAVE THEME SETTINGS TO SERVER
  const saveTheme = useCallback(async (updates: any) => {
    if (!token) return;
    try {
      await fetch('/api/settings/theme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error('Failed to save theme settings:', err);
    }
  }, [token]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Apply font family
    let fontStack = fontFamily;
    if (DEFAULT_FONTS[fontFamily]) {
      fontStack = DEFAULT_FONTS[fontFamily];
    } else {
      // For Google Fonts, use the name as fallback
      fontStack = `"${fontFamily}", sans-serif`;
    }
    
    root.style.setProperty('--font-family-global', fontStack);

    // Apply font size
    const sizes = {
      sm: '10px',
      base: '14px',
      lg: '18px'
    };
    const multipliers = {
      sm: '0.714',
      base: '1.0',
      lg: '1.286'
    };
    root.style.setProperty('--font-size-global', sizes[fontSize]);
    root.style.setProperty('--font-size-multiplier', multipliers[fontSize]);
    root.setAttribute('data-font-size', fontSize);
  }, [fontFamily, fontSize]);

  const setFontFamily = (font: FontFamily) => {
    setFontFamilyState(font);
    saveTheme({ font_family: font });
  };
  
  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    saveTheme({ font_size: size });
  };
  
  const setCurrency = (code: string) => {
    const found = CURRENCIES.find(c => c.code === code);
    if (found) {
      setCurrencyState(found);
      saveTheme({ currency_code: code });
    }
  };

  const setDateFormat = (format: string) => {
    setDateFormatState(format);
    saveTheme({ date_format: format });
  };

  const setTaxRate = (rate: number) => {
    setTaxRateState(rate);
    saveTheme({ tax_rate: rate });
  };

  const setTimezone = (tz: string) => {
    setTimezoneState(tz);
    saveTheme({ timezone: tz });
  };

  return (
    <ThemeContext.Provider value={{ 
      fontFamily, 
      fontSize, 
      currency,
      dateFormat,
      taxRate,
      timezone,
      setFontFamily, 
      setFontSize,
      setCurrency,
      setDateFormat,
      setTaxRate,
      setTimezone,
      loading
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
