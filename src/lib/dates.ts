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

export type DashboardPeriod =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'this_year'
  | 'custom';

export interface DashboardDateRange {
  from: Date;
  to: Date;
  label: string;
  period: DashboardPeriod;
}

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
 * Resolves standard dashboard periods into concrete Date boundaries.
 */
export function getDashboardPeriodRange(
  period: string = 'this_month',
  customFrom?: string | Date,
  customTo?: string | Date
): DashboardDateRange {
  const now = new Date();

  switch (period) {
    case 'last_month': {
      const prev = subMonths(now, 1);
      const from = startOfMonth(prev);
      const to = endOfMonth(prev);
      return {
        from,
        to,
        label: format(from, 'MMMM yyyy'),
        period: 'last_month',
      };
    }
    case 'last_3_months': {
      const start = startOfMonth(subMonths(now, 2));
      const end = endOfMonth(now);
      return {
        from: start,
        to: end,
        label: `${format(start, 'MMM yyyy')} – ${format(end, 'MMM yyyy')}`,
        period: 'last_3_months',
      };
    }
    case 'this_year': {
      const from = startOfYear(now);
      const to = endOfYear(now);
      return {
        from,
        to,
        label: format(from, 'yyyy'),
        period: 'this_year',
      };
    }
    case 'custom': {
      if (customFrom && customTo) {
        const fromDate = typeof customFrom === 'string' ? new Date(customFrom) : customFrom;
        const toDate = typeof customTo === 'string' ? new Date(customTo) : customTo;
        if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
          const from = startOfDay(fromDate);
          const to = endOfDay(toDate);
          return {
            from,
            to,
            label: `${format(from, 'dd MMM yyyy')} – ${format(to, 'dd MMM yyyy')}`,
            period: 'custom',
          };
        }
      }
      // Fallback to this month if custom range is invalid
      const from = startOfMonth(now);
      const to = endOfMonth(now);
      return {
        from,
        to,
        label: format(from, 'MMMM yyyy'),
        period: 'this_month',
      };
    }
    case 'this_month':
    default: {
      const from = startOfMonth(now);
      const to = endOfMonth(now);
      return {
        from,
        to,
        label: format(from, 'MMMM yyyy'),
        period: 'this_month',
      };
    }
  }
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
