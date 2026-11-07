/**
 * Standard Date & Time formatting utilities for Vynzora
 * Enforces consistent ISO / Standard formats (YYYY-MM-DD and HH:mm)
 * across the Website, Admin Portal, and Supabase database records.
 */

export function formatStandardDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return String(dateInput);
  }
}

export function formatStandardTime(timeInput: string | null | undefined): string {
  if (!timeInput) return '—';
  try {
    // If it's already HH:mm or HH:mm:ss, return first 5 characters (HH:mm)
    if (typeof timeInput === 'string' && /^\d{2}:\d{2}/.test(timeInput)) {
      return timeInput.slice(0, 5);
    }
    const d = new Date(timeInput);
    if (isNaN(d.getTime())) return timeInput;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return timeInput;
  }
}

export function formatStandardDateTime(dateTimeInput: string | Date | null | undefined): string {
  if (!dateTimeInput) return '—';
  try {
    // If date string contains 'T' or space, it has time component
    const d = typeof dateTimeInput === 'string' ? new Date(dateTimeInput) : dateTimeInput;
    if (isNaN(d.getTime())) return String(dateTimeInput);
    const datePart = formatStandardDate(d);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${datePart} ${hours}:${minutes}`;
  } catch {
    return String(dateTimeInput);
  }
}

export function formatStandardDateWithTime(
  dateInput: string | Date | null | undefined,
  timeInput?: string | null | undefined
): string {
  if (!dateInput) return '—';
  const dateStr = formatStandardDate(dateInput);
  if (timeInput) {
    const timeStr = formatStandardTime(timeInput);
    return `${dateStr} ${timeStr}`;
  }
  return formatStandardDateTime(dateInput);
}
