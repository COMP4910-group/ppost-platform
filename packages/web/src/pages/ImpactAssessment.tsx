import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Answer, SECTORS, SectorId } from 'ppost-engine';
import { confirmFromSituation, setAnswer, setNote, usePpost } from '../ppost/store';
import { CURRENT_EVENT } from '../ppost/seedData';
import { questionsFor, QuestionUI } from '../ppost/assessmentQuestions';
import { applyAssessment, previewAssessment } from '../ppost/assessmentBridge';
import { AiSuggestionsPanel } from '../ppost/AiSuggestionsPanel';
import { EditorTarget, EntityEditor } from '../ppost/EntityEditor';
import { blankProblem } from '../ppost/records';
import { Button, IdChip, sectorLabel, SeverityBadge } from '../ppost/ui';

type Filter = 'ALL' | 'UNANSWERED' | 'UNKNOWN';
const ANSWERS: Answer[] = ['YES', 'NO', 'UNKNOWN'];

const ImpactAssessment = () => {
  const s = usePpost();
  const navigate = useNavigate();
  const questions = useMemo(() => questionsFor(CURRENT_EVENT.hazard), []);
  const preview = useMemo(() => previewAssessment(s, questions), [s, questions]);
  const [sector, setSector] = useState<SectorId | 'ALL'>('ALL');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<EditorTarget | null>(null);

  const answers = s.assessment.answers;
  const visible = questions.filter((q) => preview.visibleIds.includes(q.id));
  const answered = visible.filter((q) => answers[q.id] !== undefined).length;
  const shown = visible.filter((q) =>
    (sector === 'ALL' || q.sector === sector) &&
    (filter === 'ALL' || (filter === 'UNANSWERED' ? answers[q.id] === undefined : answers[q.id] === 'UNKNOWN')));
  const sectors = SECTORS.filter((x) => visible.some((q) => q.sector === x.id));

  const pending = preview.proposals.filter((p) => !p.alreadyIn).length
    + preview.proposals.filter((p) => p.safetyChain && !p.chainIn).length
    + preview.tasks.filter((t) => !t.alreadyIn).length;

  const apply = () => {
    const r = applyAssessment(preview);
    setMessage(`Added ${r.problems} problem(s), ${r.tactics} safety tactic(s) and ${r.tasks} verification task(s) to PPOST as drafts.`);
  };

  return (
    <div className="p-6 text-white">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Impact Assessment</h1>
          <p className="text-sm text-gray-400 mt-1">
            {CURRENT_EVENT.name} · Wildfire question set · {answered} of {visible.length} answered ·{' '}
            <span className="text-amber-300">{preview.unknownIds.length} UNKNOWN</span>
          </p>
        </div>
        <div className="w-64">
          <div className="h-2 bg-gray-800 rounded" aria-hidden>
            <div className="h-2 bg-green-500 rounded" style={{ width: `${visible.length ? (answered / visible.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* what the situation report already says */}
      <section aria-label="Known situation" className="rounded-lg border border-gray-800 bg-gray-900 p-3 mb-4">
        <div className="text-xs text-gray-400 mb-2">What we already know · {CURRENT_EVENT.situationVersion}</div>
        <div className="flex flex-wrap gap-2">
          {CURRENT_EVENT.facts.map((f) => (
            <span key={f.key} className={`text-xs px-2 py-1 rounded ${f.value ? 'bg-gray-800 text-gray-200' : 'border border-dashed border-amber-500 text-amber-300'}`}>
              {f.label}: <b>{f.value ?? '? not yet known'}</b>
            </span>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-12 gap-4">
        {/* left: sector navigator */}
        <nav aria-label="Assessment sections" className="col-span-12 lg:col-span-2 space-y-1">
          <SectorButton label="All sectors" active={sector === 'ALL'} onClick={() => setSector('ALL')}
            done={answered} total={visible.length} unknown={preview.unknownIds.length} />
          {sectors.map((x) => {
            const qs = visible.filter((q) => q.sector === x.id);
            return (
              <SectorButton key={x.id} label={x.label} active={sector === x.id} onClick={() => setSector(x.id)}
                done={qs.filter((q) => answers[q.id] !== undefined).length} total={qs.length}
                unknown={qs.filter((q) => answers[q.id] === 'UNKNOWN').length} />
            );
          })}
        </nav>

        {/* centre: questions */}
        <main className="col-span-12 lg:col-span-6">
          <div role="group" aria-label="Filter questions" className="flex rounded border border-gray-700 overflow-hidden mb-3 w-fit">
            {(['ALL', 'UNANSWERED', 'UNKNOWN'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={`text-xs px-3 py-1.5 ${filter === f ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                {f === 'ALL' ? 'All' : f === 'UNANSWERED' ? 'Unanswered' : 'UNKNOWN'}
              </button>
            ))}
          </div>
          {shown.length === 0 && <p className="text-sm text-gray-400">No questions match this filter.</p>}
          {shown.map((q) => (
            <QuestionCard key={q.id} q={q} answer={answers[q.id]} note={s.assessment.notes[q.id] ?? ''}
              confirmed={!!s.assessment.confirmedFromSituation[q.id]} linked={s.assessment.linked[q.id]} />
          ))}
        </main>

        {/* right: what the answers produce */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <section aria-label="Results" className="rounded-lg border border-gray-800 bg-gray-900 p-3">
            <h2 className="text-sm font-semibold mb-1">What these answers produce</h2>
            <p className="text-[11px] text-gray-500 mb-3">Generated by the PPOST rules engine (not AI). Added only when you press the button.</p>

            <ResultGroup title="Problems" empty="No problems yet — answer questions to see them.">
              {preview.proposals.map((p) => (
                <div key={p.problem.id} className="text-xs py-1 flex flex-wrap items-center gap-1.5">
                  <IdChip id={p.alreadyIn ?? p.problem.id} /><SeverityBadge severity={p.problem.severity} />
                  <span className="text-gray-200">{p.problem.title}</span>
                  {p.alreadyIn && <span className="text-[10px] text-green-400">✓ in PPOST</span>}
                </div>
              ))}
            </ResultGroup>

            <ResultGroup title="Safety tactics (from UNKNOWN answers)" empty="None — no safety question is UNKNOWN.">
              {preview.proposals.filter((p) => p.safetyChain).map((p) => (
                <div key={p.questionId} className="text-xs py-1 text-gray-200">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-950 text-red-300 mr-1">safety</span>
                  {p.safetyChain!.tactic.title}
                  <span className="text-gray-500"> → for {p.alreadyIn ?? p.problem.id}</span>
                  {p.chainIn && <span className="ml-1 text-[10px] text-green-400">✓ in PPOST</span>}
                </div>
              ))}
            </ResultGroup>

            <ResultGroup title="Verification tasks" empty="None.">
              {preview.tasks.map((t) => (
                <div key={t.id} className="text-xs py-1 text-gray-200">
                  {t.title} <span className="text-gray-500">→ {t.assignedRole}, due {t.dueInHours}h</span>
                  {t.alreadyIn && <span className="ml-1 text-[10px] text-green-400">✓ added</span>}
                </div>
              ))}
            </ResultGroup>

            {preview.needsReview.length > 0 && (
              <div className="mt-2 rounded border border-amber-700 bg-amber-950/40 p-2 text-xs text-amber-200">
                <div className="font-semibold mb-1">Answer changed — review in PPOST</div>
                {preview.needsReview.map((r) => (
                  <div key={r.questionId}>{r.questionId} is now {r.answer}; {r.problemId} was created while it was UNKNOWN.</div>
                ))}
              </div>
            )}

            <Button variant="primary" className="w-full mt-3 py-2" disabled={pending === 0} onClick={apply}>
              {pending ? `Add ${pending} item(s) to PPOST as drafts` : 'Nothing new to add'}
            </Button>
            {message && (
              <div role="status" className="mt-2 text-xs text-green-300">
                {message} <button className="underline" onClick={() => navigate('/ppost')}>Open PPOST Workspace →</button>
              </div>
            )}
          </section>

          <AiSuggestionsPanel
            request={{
              want: 'problem',
              answers: visible.filter((q) => answers[q.id]).map((q) => ({
                questionId: q.id, question: q.text, answer: answers[q.id]!, sector: q.sector, priorityId: q.priorityId,
              })),
            }}
            onUse={(sug, isSample) => setEditing({
              kind: 'problem', isNew: true,
              record: blankProblem(sug.priorityId ?? 'PR-1', {
                title: sug.title, description: sug.rationale, sector: sug.sector ?? 'HOUSING',
                source: isSample ? 'HUMAN_DECISION' : 'AI_SUGGESTION',
              }),
            })}
          />
        </aside>
      </div>

      {editing && <EntityEditor key={editing.record.id} target={editing} onClose={() => setEditing(null)} onOpen={setEditing} />}
    </div>
  );
};

function SectorButton({ label, active, onClick, done, total, unknown }: {
  label: string; active: boolean; onClick: () => void; done: number; total: number; unknown: number;
}) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`w-full text-left rounded px-2 py-1.5 text-sm ${active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/60'}`}>
      <div>{label}</div>
      <div className="text-[11px] text-gray-500">
        {done}/{total} answered{unknown > 0 && <span className="text-amber-300"> · {unknown}?</span>}
      </div>
    </button>
  );
}

const ResultGroup = ({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) => {
  const has = React.Children.toArray(children).length > 0;
  return (
    <div className="mb-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">{title}</div>
      {has ? children : <div className="text-xs text-gray-500">{empty}</div>}
    </div>
  );
};

function QuestionCard({ q, answer, note, confirmed, linked }: {
  q: QuestionUI; answer?: Answer; note: string; confirmed: boolean; linked?: string;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const [showNote, setShowNote] = useState(!!note);
  const fact = q.situationFact && CURRENT_EVENT.facts.find((f) => f.key === q.situationFact!.key);
  const safety = q.unknownPolicy === 'SAFETY';
  const makesProblem = q.problemTitle && answer === (q.problemWhen ?? 'YES');

  return (
    <article aria-label={q.id} className={`rounded-lg border p-4 mb-3 bg-gray-900 ${q.followUpOf ? 'ml-6 border-gray-700' : 'border-gray-800'} ${answer === 'UNKNOWN' ? '!border-dashed !border-amber-500' : ''}`}>
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        <IdChip id={q.id} />
        <span className="text-[11px] text-gray-500">{sectorLabel(q.sector)}</span>
        {safety && <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-950 text-red-300">safety-sensitive</span>}
        {q.followUpOf && <span className="text-[11px] text-gray-500">follow-up to {q.followUpOf}</span>}
      </div>
      <h3 className="text-sm text-gray-100 mb-1">{q.text}</h3>
      <button onClick={() => setShowWhy(!showWhy)} className="text-[11px] text-blue-300 hover:underline" aria-expanded={showWhy}>
        {showWhy ? 'Hide why we ask' : 'Why we ask'}
      </button>
      {showWhy && <p className="text-xs text-gray-400 mt-1">{q.why}</p>}

      {/* situation report hint (person must confirm) */}
      {fact && !confirmed && answer === undefined && (
        <div className="mt-2 rounded bg-gray-950 border border-gray-800 px-2 py-1.5 text-xs text-gray-300 flex flex-wrap items-center gap-2">
          {fact.value
            ? <>Situation report says <b>{fact.label}: {fact.value}</b> → suggests <b>{q.situationFact!.suggests}</b></>
            : <>Situation report: <b>{fact.label}</b> is not yet known → suggests <b>UNKNOWN</b> unless you can verify</>}
          <button onClick={() => confirmFromSituation(q.id, q.situationFact!.suggests)} className="text-green-400 hover:underline">
            Confirm {q.situationFact!.suggests}
          </button>
        </div>
      )}
      {confirmed && <div className="mt-1 text-[11px] text-gray-500">Answer confirmed from {CURRENT_EVENT.situationVersion}</div>}

      {/* YES / NO / UNKNOWN */}
      <div role="radiogroup" aria-label={`Answer for ${q.id}`} className="flex gap-2 mt-3">
        {ANSWERS.map((a) => {
          const on = answer === a;
          const cls = a === 'UNKNOWN'
            ? (on ? 'border-2 border-dashed border-amber-400 text-amber-200 bg-amber-950/40' : 'border border-gray-700 text-gray-300')
            : (on ? 'bg-gray-200 text-gray-900 border border-gray-200 font-semibold' : 'border border-gray-700 text-gray-300');
          return (
            <button key={a} role="radio" aria-checked={on} onClick={() => setAnswer(q.id, on ? undefined : a)}
              className={`text-xs px-4 py-1.5 rounded hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-blue-500 ${cls}`}>
              {a === 'UNKNOWN' ? '? UNKNOWN' : a}
            </button>
          );
        })}
        <button onClick={() => setShowNote(!showNote)} className="ml-auto text-[11px] text-gray-400 hover:text-white">
          {showNote ? 'Hide note' : note ? 'Note ✎' : '+ Note'}
        </button>
      </div>
      {showNote && (
        <textarea aria-label={`Note for ${q.id}`} rows={2} value={note} onChange={(e) => setNote(q.id, e.target.value)}
          placeholder="Source, who confirmed it, what is still unclear…"
          className="mt-2 w-full bg-gray-950 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      )}

      {/* system reaction */}
      {answer === 'UNKNOWN' && safety && (
        <div className="mt-3 rounded border border-amber-600 bg-amber-950/40 p-2.5 text-xs text-amber-100">
          <b>⚠ Treated as a potential hazard (rule).</b> Answer stays UNKNOWN until verified.
          <ul className="list-disc ml-4 mt-1">
            <li>Precautionary problem: {q.problemTitle}</li>
            {q.safetyTactic && <li>Safety tactic: {q.safetyTactic.title}</li>}
            {q.verification && <li>Verification: {q.verification.title} → {q.verification.assignedRole}, due {q.verification.dueInHours}h</li>}
          </ul>
        </div>
      )}
      {answer === 'UNKNOWN' && !safety && q.verification && (
        <div className="mt-3 rounded border border-blue-800 bg-blue-950/40 p-2.5 text-xs text-blue-100">
          <b>ⓘ Verify — no hazard assumed.</b> Task: {q.verification.title} → {q.verification.assignedRole}, due {q.verification.dueInHours}h.
        </div>
      )}
      {makesProblem && (
        <div className="mt-3 rounded border border-gray-700 bg-gray-950 p-2.5 text-xs text-gray-200">
          {linked ? <>Already recorded in PPOST as <IdChip id={linked} /></> : <>Creates problem: <b>{q.problemTitle}</b></>}
        </div>
      )}
    </article>
  );
}

export default ImpactAssessment;
