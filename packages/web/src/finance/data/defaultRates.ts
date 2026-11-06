import type { RateEntry } from '../types';

/**
 * Starter rate table.
 *
 * ⚠️ SAMPLE VALUES ONLY — these are placeholder rates so the estimator has
 * something to pick from. Replace them with the client's approved rate
 * schedule (e.g. regional district or provincial DFA rates) before any
 * estimate is used for real decisions.
 *
 * Escalation, Engineering Allowance and Contingency are normally a
 * percentage of the estimate rather than a unit rate, so they are not
 * seeded here.
 */
const SAMPLE_SOURCE = 'Sample rate – replace with client rate schedule';
const EFFECTIVE = '2026-01-01';

const r = (
  id: string,
  category: RateEntry['category'],
  resource: string,
  unit: string,
  baseRate: number,
): RateEntry => ({
  id,
  category,
  resource,
  unit,
  baseRate,
  source: SAMPLE_SOURCE,
  effectiveDate: EFFECTIVE,
});

export const DEFAULT_RATES: RateEntry[] = [
  // Labour ($ per person per hour)
  r('rate-lab-01', 'labour', 'General Labourer', 'hr', 55),
  r('rate-lab-02', 'labour', 'Equipment Operator', 'hr', 75),
  r('rate-lab-03', 'labour', 'Journeyperson Electrician', 'hr', 95),
  r('rate-lab-04', 'labour', 'Site Supervisor', 'hr', 90),
  r('rate-lab-05', 'labour', 'Project Manager', 'hr', 120),

  // Equipment ($ per machine per period)
  r('rate-eqp-01', 'equipment', 'Excavator (20 t)', 'day', 1400),
  r('rate-eqp-02', 'equipment', 'Tandem Dump Truck', 'hr', 130),
  r('rate-eqp-03', 'equipment', 'Skid Steer Loader', 'day', 450),
  r('rate-eqp-04', 'equipment', 'Generator (100 kW)', 'day', 350),
  r('rate-eqp-05', 'equipment', 'Water Pump (4")', 'day', 120),

  // Materials ($ per unit of material)
  r('rate-mat-01', 'materials', 'Gravel / Aggregate', 'm3', 45),
  r('rate-mat-02', 'materials', 'Ready-mix Concrete', 'm3', 260),
  r('rate-mat-03', 'materials', 'Rip-rap', 'm3', 90),
  r('rate-mat-04', 'materials', 'Sandbags (filled)', 'each', 4),

  // Subcontractors
  r('rate-sub-01', 'subcontractors', 'Debris Removal Contractor', 'day', 4500),
  r('rate-sub-02', 'subcontractors', 'Traffic Control Crew', 'day', 1800),
  r('rate-sub-03', 'subcontractors', 'Environmental Assessment', 'lump', 15000),

  // Facility Rental
  r('rate-fac-01', 'facility_rental', 'Site Office Trailer', 'mo', 1200),
  r('rate-fac-02', 'facility_rental', 'Warehouse / Storage Space', 'mo', 3500),
  r('rate-fac-03', 'facility_rental', 'Community Hall (Reception Centre)', 'day', 600),
  r('rate-fac-04', 'facility_rental', 'Portable Toilet Unit', 'mo', 250),

  // Overhead
  r('rate-ovh-01', 'overhead', 'Project Administration', 'mo', 5000),
];
