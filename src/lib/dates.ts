import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  subMonths,
  addDays as dateFnsAddDays,
  addWeeks,
  addMonths as dateFnsAddMonths,
  addYears,
  format,
} from 'date-fns';

/**
 * Returns the start and end of the specified period ('monthly' or 'yearly')
 * taking into account timezone or defaulting to user's timezone.
 */
export function getPeriodBounds(
  date: Date = new Date(),
  period: 'monthly' | 'yearly' = 'monthly'
): { start: Date; end: Date } {
  if (period === 'yearly') {
    return {
      start: startOfYear(date),
      end: endOfYear(date),
    };
  }
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

export function getCurrentMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: startOfMonth(now),
    end: endOfMonth(now),
  };
}

export function getPreviousMonthBounds(): { start: Date; end: Date } {
  const prev = subMonths(new Date(), 1);
  return {
    start: startOfMonth(prev),
    end: endOfMonth(prev),
  };
}

export function getCurrentYearBounds(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: startOfYear(now),
    end: endOfYear(now),
  };
}

export function getDayBounds(date: Date = new Date()): { start: Date; end: Date } {
  return {
    start: startOfDay(date),
    end: endOfDay(date),
  };
}

export function formatDate(date: Date | string, pattern: string = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return format(d, pattern);
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, 'dd MMM yyyy, hh:mm a');
}

/**
 * Computes next run date based on recurrence frequency and interval
 */
export function computeNextRun(
  currentRun: Date,
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly',
  interval: number = 1
): Date {
  switch (frequency) {
    case 'daily':
      return dateFnsAddDays(currentRun, interval);
    case 'weekly':
      return addWeeks(currentRun, interval);
    case 'biweekly':
      return addWeeks(currentRun, interval * 2);
    case 'monthly':
      return dateFnsAddMonths(currentRun, interval);
    case 'yearly':
      return addYears(currentRun, interval);
    default:
      return dateFnsAddMonths(currentRun, 1);
  }
}
