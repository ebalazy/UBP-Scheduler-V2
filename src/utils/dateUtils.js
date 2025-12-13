export const getLocalISOString = () => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
};

export const addDays = (dateStr, days) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};

export const formatLocalDate = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    // Adjust for timezone offset to ensure we get the "Local" date part correctly if it's a full ISO string
    // But usually for "YYYY-MM-DD" input it works.
    // If input is Date object, toISOString might shift it to UTC.
    // Ideally we want local YYYY-MM-DD.
    // Let's use the same logic as getLocalISOString but for a specific date.

    // Simple approach: valid YYYY-MM-DD string? return it.
    if (typeof dateInput === 'string' && dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) return dateInput;

    // Else convert
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
};

export const formatTime12h = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    if (isNaN(h)) return time24; // Fallback
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    // Ensure minutes are 2 digits
    const mStr = m !== undefined ? String(m).padStart(2, '0') : '00';
    return `${h12}:${mStr} ${ampm}`;
};
