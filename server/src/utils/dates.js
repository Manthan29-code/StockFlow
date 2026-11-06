/**
 * Formats a Date object or ISO string to YYYY-MM-DD
 * @param {Date|string} date 
 * @returns {string}
 */
function formatDateToYYYYMMDD(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    // If it's already YYYY-MM-DD, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    date = new Date(date);
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses YYYY-MM-DD string to UTC midnight Date for Prisma @db.Date
 * @param {string} str 
 * @returns {Date}
 */
function parseYYYYMMDDToDate(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw new Error(`Invalid date format (expected YYYY-MM-DD): ${str}`);
  }
  return new Date(`${str}T00:00:00.000Z`);
}

module.exports = {
  formatDateToYYYYMMDD,
  parseYYYYMMDDToDate,
};

