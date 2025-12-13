export const getLocalISOString = () => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
};

export const addDays = (dateStr, days) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
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
