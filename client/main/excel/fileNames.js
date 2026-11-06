/**
 * Sanitizes a string for use in a file name
 * @param {string} name 
 * @returns {string}
 */
function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*]+/g, '-').trim();
}

/**
 * Formats a Date object to DD-MM-YYYY string
 * @param {Date} [d]
 * @returns {string}
 */
function formatDDMMYYYY(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Returns safe material Excel file name: "<material> - DD-MM-YYYY.xlsx"
 * @param {string} materialName 
 * @param {Date} [d]
 * @returns {string}
 */
function getMaterialFileName(materialName, d = new Date()) {
  const cleanName = sanitizeFileName(materialName);
  const dateStr = formatDDMMYYYY(d);
  return `${cleanName} - ${dateStr}.xlsx`;
}

/**
 * Returns safe BOM Excel file name: "BOM - DD-MM-YYYY.xlsx"
 * @param {Date} [d]
 * @returns {string}
 */
function getBomFileName(d = new Date()) {
  const dateStr = formatDDMMYYYY(d);
  return `BOM - ${dateStr}.xlsx`;
}

module.exports = {
  sanitizeFileName,
  formatDDMMYYYY,
  getMaterialFileName,
  getBomFileName,
};

