/**
 * Format currency value in Ethiopian Birr (ETB)
 * @param {number} value - The numeric value to format
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'Birr 0.00';
  }
  
  const number = parseFloat(value);
  return `Birr ${number.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}

/**
 * Format currency value in Ethiopian Birr with symbol (ETB)
 * @param {number} value - The numeric value to format
 * @returns {string} - Formatted currency string with ETB symbol
 */
export function formatCurrencyWithSymbol(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'ETB 0.00';
  }
  
  const number = parseFloat(value);
  return `ETB ${number.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}

/**
 * Parse currency input string to number
 * @param {string} value - The currency string to parse
 * @returns {number} - Numeric value
 */
export function parseCurrency(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  // Remove "Birr", "ETB", commas, and extra spaces
  const cleaned = value.toString().replace(/Birr|ETB|,|\s/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}
