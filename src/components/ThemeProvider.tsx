import React, { createContext, useContext, useEffect, useState } from 'react';

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
  setFontFamily: (font: FontFamily) => void;
  setFontSize: (size: FontSize) => void;
  setCurrency: (code: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [fontFamily, setFontFamilyState] = useState<FontFamily>(() => {
    return localStorage.getItem('fontFamily') || 'sans';
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const saved = localStorage.getItem('fontSize') as FontSize;
    return ['sm', 'base', 'lg'].includes(saved) ? saved : 'base';
  });

  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('currencyCode');
    return CURRENCIES.find(c => c.code === saved) || CURRENCIES[0];
  });

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
    localStorage.setItem('fontFamily', fontFamily);

    // Apply font size
    const sizes = {
      sm: '14px',
      base: '16px',
      lg: '18px'
    };
    root.style.setProperty('--font-size-global', sizes[fontSize]);
    localStorage.setItem('fontSize', fontSize);
  }, [fontFamily, fontSize]);

  useEffect(() => {
    localStorage.setItem('currencyCode', currency.code);
  }, [currency]);

  const setFontFamily = (font: FontFamily) => setFontFamilyState(font);
  const setFontSize = (size: FontSize) => setFontSizeState(size);
  const setCurrency = (code: string) => {
    const found = CURRENCIES.find(c => c.code === code);
    if (found) setCurrencyState(found);
  };

  return (
    <ThemeContext.Provider value={{ 
      fontFamily, 
      fontSize, 
      currency,
      setFontFamily, 
      setFontSize,
      setCurrency
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
