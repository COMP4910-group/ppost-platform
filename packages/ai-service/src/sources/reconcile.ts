import { type Cents, formatCents, percentOf, toCents } from "./common.ts";
import type { FinanceReport } from "./financeReport.ts";

export interface ReconciliationCheck {
  label: string;
  /** JSON pointer of the supplied figure. */
  path: string;
  supplied: string;
  recomputed: string;
  matches: boolean;
}

/**
 * Recomputes the finance report's derived figures in exact integer cents and
 * compares them with the supplied values. Supplied figures are never replaced;
 * mismatches are reported for a person to resolve.
 *
 * Assumed rules (to be confirmed with the finance owner):
 *  - a percentage line applies to the running subtotal of all lines before it;
 *  - "realistic" funding = approved + requested-and-likely;
 *  - lifecycle stages (commitment → expenditure → claim → reimbursement) track
 *    the same money and are never added together.
 */
export function reconcileFinanceReport(r: FinanceReport): ReconciliationCheck[] {
  const checks: ReconciliationCheck[] = [];
  const c = (v: number) => toCents(v) as Cents; // exactness verified during validation
  const check = (label: string, path: string, supplied: number, recomputed: Cents | null) => {
    if (recomputed === null) return;
    checks.push({ label, path, supplied: formatCents(c(supplied)), recomputed: formatCents(recomputed), matches: c(supplied) === recomputed });
  };
  const sum = (xs: number[]) => xs.reduce((a, v) => a + c(v), 0n);

  r.estimates.forEach((e, i) => {
    const at = `/estimates/${i}`;
    let direct = 0n;
    let running = 0n;
    e.lines.forEach((l, j) => {
      if (l.pricing === "unit" && l.quantity !== null && l.unit_rate !== null && l.duration !== null) {
        const q = toCents(l.quantity);
        const rate = toCents(l.unit_rate);
        const dur = toCents(l.duration);
        if (q !== null && rate !== null && dur !== null) {
          const product = q * rate * dur; // cents³ → divide by 100² for cents
          check(`${e.code} line ${l.position} total`, `${at}/lines/${j}/total_cost`, l.total_cost, (product + 5_000n) / 10_000n);
        }
        direct += c(l.total_cost);
      } else if (l.pricing === "percent" && l.percent !== null) {
        check(`${e.code} line ${l.position} (${l.percent}% of running subtotal)`, `${at}/lines/${j}/total_cost`, l.total_cost, percentOf(running, l.percent));
      }
      running += c(l.total_cost);
    });
    check(`${e.code} direct total`, `${at}/direct_total`, e.direct_total, direct);
    check(`${e.code} total`, `${at}/total`, e.total, running);
    check(`${e.code} total by category`, `${at}/total`, e.total, sum(Object.values(e.by_category)));
    check(`${e.code} low (${e.accuracy_low_pct}%)`, `${at}/low`, e.low, percentOf(c(e.total), 100 + e.accuracy_low_pct));
    check(`${e.code} high (+${e.accuracy_high_pct}%)`, `${at}/high`, e.high, percentOf(c(e.total), 100 + e.accuracy_high_pct));
  });

  const s = r.summary;
  const sources = r.funding.sources;
  check("Requirement = sum of current estimates", "/summary/requirement", s.requirement, sum(r.estimates.map((e) => e.total)));
  check("Finalized = approved estimates", "/summary/finalized", s.finalized, sum(r.estimates.filter((e) => e.status === "approved").map((e) => e.total)));
  check("Not yet approved = other estimates", "/summary/draft", s.draft, sum(r.estimates.filter((e) => e.status !== "approved").map((e) => e.total)));
  check("Approved funding", "/summary/approved_funding", s.approved_funding, sum(sources.filter((f) => f.status === "approved").map((f) => f.amount)));
  check("Requested funding", "/summary/requested_funding", s.requested_funding, sum(sources.filter((f) => f.status === "requested").map((f) => f.amount)));
  check("Likely funding (requested and likely)", "/summary/likely_funding", s.likely_funding, sum(sources.filter((f) => f.status === "requested" && f.likely).map((f) => f.amount)));
  check("Realistic funding = approved + likely", "/summary/realistic_funding", s.realistic_funding, c(s.approved_funding) + c(s.likely_funding));
  check("Gap = requirement − realistic funding", "/summary/gap", s.gap, c(s.requirement) - c(s.realistic_funding));

  // Coverage is a percentage with one decimal place: compare in tenths of a percent.
  if (c(s.requirement) > 0n) {
    const tenths = (c(s.realistic_funding) * 1000n * 2n + c(s.requirement)) / (c(s.requirement) * 2n);
    const suppliedTenths = toCents(s.coverage_pct);
    if (suppliedTenths !== null) {
      checks.push({
        label: "Coverage % = realistic funding ÷ requirement",
        path: "/summary/coverage_pct",
        supplied: String(s.coverage_pct),
        recomputed: `${tenths / 10n}.${tenths % 10n}`,
        matches: suppliedTenths === tenths * 10n,
      });
    }
  }

  for (const [key, pct] of Object.entries(r.funding.mix)) {
    const group = key.replace(/_pct$/, "");
    const amount = r.funding.mix_amounts[group];
    if (typeof amount === "number") check(`Funding mix ${group} (${pct}% of requirement)`, `/funding/mix_amounts/${group}`, amount, percentOf(c(s.requirement), pct));
  }

  const stage = (name: string, tacticId?: string) =>
    sum(r.financial_entries.filter((f) => f.stage === name && (tacticId === undefined || f.tactic_id === tacticId)).map((f) => f.amount));
  check("Committed = commitment entries", "/summary/committed", s.committed, stage("commitment"));
  check("Spent = expenditure entries", "/summary/spent", s.spent, stage("expenditure"));
  check("Claimed = claim entries", "/summary/claimed", s.claimed, stage("claim"));
  check("Reimbursed = reimbursement entries", "/summary/reimbursed", s.reimbursed, stage("reimbursement"));

  r.lifecycle_by_tactic.forEach((l, i) => {
    const at = `/lifecycle_by_tactic/${i}`;
    check(`${l.tactic_id} committed`, `${at}/committed`, l.committed, stage("commitment", l.tactic_id));
    check(`${l.tactic_id} spent`, `${at}/spent`, l.spent, stage("expenditure", l.tactic_id));
    check(`${l.tactic_id} claimed`, `${at}/claimed`, l.claimed, stage("claim", l.tactic_id));
    check(`${l.tactic_id} reimbursed`, `${at}/reimbursed`, l.reimbursed, stage("reimbursement", l.tactic_id));
    if (typeof l.approved_budget === "number" && typeof l.remaining_budget === "number")
      check(`${l.tactic_id} remaining budget = approved budget − spent`, `${at}/remaining_budget`, l.remaining_budget, c(l.approved_budget) - c(l.spent));
  });

  checks.push({
    label: "Tactics estimated = number of estimates",
    path: "/summary/tactics_estimated",
    supplied: String(s.tactics_estimated),
    recomputed: String(r.estimates.length),
    matches: s.tactics_estimated === r.estimates.length,
  });

  return checks;
}
