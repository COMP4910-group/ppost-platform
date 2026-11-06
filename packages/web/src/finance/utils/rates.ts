import type { CostLine, RateEntry } from '../types';
import { computeLineCost } from './calculations';

const TIME_UNITS: ReadonlyArray<CostLine['durationUnit']> = ['hr', 'day', 'wk', 'mo'];

/** The rate actually used: the regional override if set, else the base rate. */
export function effectiveRate(rate: RateEntry): number {
  return rate.regionalRate !== undefined && rate.regionalRate !== null && isFinite(rate.regionalRate)
    ? rate.regionalRate
    : rate.baseRate;
}

/**
 * Fill a cost line from a rate table entry.
 *
 * - description, category, unit and unit rate come from the rate
 * - if the rate is time-based (hr/day/wk/mo) the duration unit matches it
 * - if it isn't (m3, each, lump…) duration is set to 1 so
 *   Cost = Quantity × Rate
 * - quantity is kept, so the user doesn't lose what they typed
 * - rateId is stored so we can always trace which rate was used
 */
export function applyRateToLine(line: CostLine, rate: RateEntry): CostLine {
  const isTimeUnit = (TIME_UNITS as readonly string[]).includes(rate.unit);
  const next: CostLine = {
    ...line,
    rateId: rate.id,
    pricing: 'unit',
    percent: undefined,
    description: rate.resource,
    category: rate.category,
    unit: rate.unit,
    unitRate: effectiveRate(rate),
    durationUnit: isTimeUnit ? (rate.unit as CostLine['durationUnit']) : line.durationUnit,
    duration: isTimeUnit ? line.duration : 1,
  };
  next.totalCost = computeLineCost(next.quantity, next.unitRate, next.duration);
  return next;
}
