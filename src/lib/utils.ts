import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | number, format: string) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';

  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString();
  const day = d.getDate().toString();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');

  switch (format) {
    case 'DD/MM/YYYY': return `${dd}/${mm}/${year}`;
    case 'YYYY-MM-DD': return `${year}-${mm}-${dd}`;
    case 'D/M/YYYY': return `${day}/${month}/${year}`;
    case 'M/D/YYYY': return `${month}/${day}/${year}`;
    case 'MM/DD/YYYY':
    default: return `${mm}/${dd}/${year}`;
  }
}
