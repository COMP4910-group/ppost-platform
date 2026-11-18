"""
Finance math (server copy of packages/web/src/finance/utils).

The server recalculates every total itself and never trusts totals sent by the
browser. All money uses Decimal and is rounded to cents (half-up).

Unit line      : cost = quantity x unit_rate x duration
Percent line   : cost = percent % of everything in the levels BELOW its category

  level 0  direct costs (labour, equipment, materials, subcontractors, facility rental)
  level 1  overhead               % of level 0
  level 2  escalation             % of levels 0-1
  level 3  engineering allowance  % of levels 0-2
  level 4  contingency            % of levels 0-3
"""
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
ZERO = Decimal("0")

PERCENT_CATEGORIES = ["overhead", "escalation", "engineering_allowance", "contingency"]


def money(value) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def _nonneg(value) -> Decimal:
    if value is None:
        return ZERO
    d = Decimal(value)
    return d if d > 0 else ZERO


def category_level(category: str) -> int:
    return PERCENT_CATEGORIES.index(category) + 1 if category in PERCENT_CATEGORIES else 0


def is_percent(line) -> bool:
    return getattr(line, "pricing", "unit") == "percent" and line.category in PERCENT_CATEGORIES


def unit_cost(quantity, unit_rate, duration) -> Decimal:
    return money(_nonneg(quantity) * _nonneg(unit_rate) * _nonneg(duration))


def resolve_line_costs(lines) -> list:
    """Cost of every line, in the same order. `lines` are objects with
    category, pricing, quantity, unit_rate, duration, percent."""
    totals = [ZERO if is_percent(l) else unit_cost(l.quantity, l.unit_rate, l.duration) for l in lines]
    levels = [category_level(l.category) for l in lines]
    for level in range(1, len(PERCENT_CATEGORIES) + 1):
        base = sum((t for t, lv in zip(totals, levels) if lv < level), ZERO)
        for i, line in enumerate(lines):
            if levels[i] == level and is_percent(line):
                totals[i] = money(base * _nonneg(line.percent) / 100)
    return totals


def estimate_totals(lines, line_totals, low_pct=-50, high_pct=100) -> dict:
    by_category = {}
    for line, t in zip(lines, line_totals):
        by_category[line.category] = by_category.get(line.category, ZERO) + t
    direct = sum((t for l, t in zip(lines, line_totals) if category_level(l.category) == 0), ZERO)
    total = sum(line_totals, ZERO)
    return {
        "direct": money(direct),
        "by_category": {k: money(v) for k, v in by_category.items()},
        "total": money(total),
        "low": money(max(ZERO, total * (1 + Decimal(low_pct) / 100))),
        "high": money(max(ZERO, total * (1 + Decimal(high_pct) / 100))),
    }
