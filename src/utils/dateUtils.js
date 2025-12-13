/**
 * Returns the current date as a YYYY-MM-DD string in the Local Timezone.
 * This prevents UTC rollover issues (e.g. 8PM EST becoming Tomorrow) 
 * which breaks daily inventory buckets.
 */
export const getLocalISOString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000; // Offset in milliseconds
    const localDate = new Date(d.getTime() - offset);
    return localDate.toISOString().split('T')[0];
};

/**
 * Returns a new YYYY-MM-DD string offset by N days from a given date string.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {number} daysOffset - Positive or negative integer
 */
export const addDays = (dateStr, daysOffset) => {
    const d = new Date(dateStr + 'T00:00:00'); // Valid ISO Construction
    d.setDate(d.getDate() + daysOffset);
    // Return formatted manually to ensure no UTC shifts
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Formats a Date object to YYYY-MM-DD using Local Time.
 * @param {Date} date 
 */
export const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
