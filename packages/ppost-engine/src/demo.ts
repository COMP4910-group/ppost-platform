/**
 * Terminal demo:  npm run demo -w ppost-engine
 * Shows the engine working end to end on the synthetic Clearwater Ridge data.
 * Change the answers below (YES / NO / UNKNOWN) and re-run to see what happens.
 */
import { evaluateAssessment, AnswerMap } from './engine/assessment';
import { buildMatrix } from './engine/matrix';
import { validateTactic } from './engine/validation';
import { DEFAULT_PRIORITIES, SECTORS, orderedPriorities } from './model/defaults';
import { SAMPLE_PPOST, SAMPLE_QUESTIONS } from './sampleData';

// ▼ Try changing these answers ▼
const answers: AnswerMap = {
  'Q-W03': 'UNKNOWN', // water system — safety-sensitive
  'Q-H07': 'YES',     // debris-flow risk → reveals follow-up Q-H07a
  'Q-H07a': 'NO',     // evacuation route NOT open → problem
  'Q-F02': 'UNKNOWN', // funding application — verify only, no hazard
};

const line = (s = '') => console.log(s);
const DIS = 'EV-2026-014';

line('══════════ 1. ASSESSMENT ENGINE ══════════');
const r = evaluateAssessment(DIS, SAMPLE_QUESTIONS, answers);
for (const q of SAMPLE_QUESTIONS) {
  const shown = r.visibleQuestionIds.includes(q.id);
  line(`${q.id.padEnd(7)} ${shown ? (answers[q.id] ?? '—').padEnd(8) : 'hidden  '} ${q.text}`);
}
line();
line(`Still UNKNOWN (kept as UNKNOWN): ${r.unknownQuestionIds.join(', ') || 'none'}`);
line('Problems created:');
r.problems.forEach((p) => line(`  ${p.id.padEnd(12)} [${p.severity}] ${p.title}`));
line('Safety tactics created:');
r.tactics.forEach((t) => line(`  ${t.id.padEnd(16)} ${t.title}`));
line('Verification tasks created:');
r.tasks.forEach((t) => line(`  ${t.id.padEnd(12)} ${t.title} → ${t.assignedRole}, due ${t.dueInHours}h`));

line();
line('══════════ 2. RECOVERY MATRIX (8 priorities × 5 sectors) ══════════');
// Merge the sample PPOST chain with what the assessment just generated.
const data = { ...SAMPLE_PPOST, problems: [...SAMPLE_PPOST.problems, ...r.problems] };
const sectors = SECTORS.filter((s) => !s.optional);
const priorities = orderedPriorities(DEFAULT_PRIORITIES);
const grid = buildMatrix(priorities, sectors.map((s) => s.id), data);
const short: Record<string, string> = { RED: 'RED  ', AMBER: 'AMBER', GREEN: 'GREEN', NOT_ASSESSED: '  ·  ' };
line(''.padEnd(36) + sectors.map((s) => s.label.slice(0, 12).padEnd(14)).join(''));
priorities.forEach((p, i) => {
  const cells = grid[i].map((c) => `${short[c.status]}${c.unknownCount ? ' ?' : '  '}`.padEnd(14));
  line(`${p.rank}. ${p.name}`.padEnd(36) + cells.join(''));
});
line('Legend: RED = safety unknown or high-severity problem with no objective · AMBER = incomplete chain · ? = has UNKNOWN');
line('Why each coloured cell has its colour:');
grid.flat().filter((c) => c.reasons.length).forEach((c) => line(`  ${c.priorityId} × ${c.sector}: ${c.reasons.join('; ')}`));

line();
line('══════════ 3. 5W1H VALIDATION ══════════');
const good = SAMPLE_PPOST.tactics[0];
line(`${good.id} "${good.title}": ${validateTactic(good).length === 0 ? 'ready to submit ✓' : 'has issues'}`);
const bad = { ...good, id: 'T-020', title: 'Insurance and damage documentation support', owner: undefined, fiveW1H: { what: { action: 'Help households document losses' } } };
line(`${bad.id} "${bad.title}":`);
validateTactic(bad).forEach((i) => line(`  ✗ ${i.field.toUpperCase()}: ${i.message}`));
