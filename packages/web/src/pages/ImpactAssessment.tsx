import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Answer, SECTORS, SectorId } from 'ppost-engine';
import { confirmFromSituation, setAiQuestions, setAnswer, setExpanded, setNote, StoreState, usePpost } from '../ppost/store';
import { CURRENT_EVENT } from '../ppost/seedData';
import { deepQuestionsOf, questionsFor, QuestionUI } from '../ppost/assessmentQuestions';
import { applyAssessment, previewAssessment, unknownsWithoutNotes } from '../ppost/assessmentBridge';
import { getQuestionProvider, sanitizeGenerated } from '../ppost/questionProviders';
import { AiInsightsPanel } from '../ppost/AiInsightsPanel';
import { buildInsightContext } from '../ppost/assessmentInsights';
import { EditorTarget, EntityEditor } from '../ppost/EntityEditor';
import { Button, IdChip, sectorLabel, SeverityBadge } from '../ppost/ui';
import { useServerSync } from '../ppost/sync';
import { ActivityLog, SyncStatusChip } from '../ppost/HistoryPanel';

type Filter = 'ALL' | 'UNANSWERED' | 'UNKNOWN' | 'NEEDS_NOTE';
const ANSWERS: Answer[] = ['YES', 'NO', 'UNKNOWN'];

const ImpactAssessment = () => {
  useServerSync();
  const s = usePpost();
  const navigate = useNavigate();
  const aiQuestions = s.assessment.aiQuestions;
  const questions = useMemo(() => questionsFor(CURRENT_EVENT.hazard, aiQuestions), [aiQuestions]);
  const preview = useMemo(() => previewAssessment(s, questions), [s, questions]);
  const [sector, setSector] = useState<SectorId | 'ALL'>('ALL');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  /** Activity history side panel: undefined = closed, '' = all questions, 'Q-…' = one question. */
  const [historyFor, setHistoryFor] = useState<string | undefined>(undefined);

  const answers = s.assessment.answers;
  const expanded = s.assessment.expanded;
  // main questions in order; each one's deeper questions right after it (only when opened)
  const engineVisible = (q: QuestionUI) => preview.visibleIds.includes(q.id);
  const visible: QuestionUI[] = [];
  for (const q of questions.filter((x) => !x.deepOf && engineVisible(x))) {
    visible.push(q);
    if (expanded[q.id]) visible.push(...deepQuestionsOf(questions, q.id).filter(engineVisible));
  }
  const missingNotes = unknownsWithoutNotes(s, visible.map((q) => q.id));
  const answered = visible.filter((q) => answers[q.id] !== undefined).length;
  const shown = visible.filter((q) =>
    (sector === 'ALL' || q.sector === sector) &&
    (filter === 'ALL'
      || (filter === 'UNANSWERED' && answers[q.id] === undefined)
      || (filter === 'UNKNOWN' && answers[q.id] === 'UNKNOWN')
      || (filter === 'NEEDS_NOTE' && missingNotes.includes(q.id))));
  const sectors = SECTORS.filter((x) => visible.some((q) => q.sector === x.id));

  const pending = preview.proposals.filter((p) => !p.alreadyIn).length
    + preview.proposals.filter((p) => p.safetyChain && !p.chainIn).length
    + preview.tasks.filter((t) => !t.alreadyIn).length;

  const apply = () => {
    if (missingNotes.length) { setFilter('NEEDS_NOTE'); return; }
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
            {CURRENT_EVENT.name} · {CURRENT_EVENT.hazard.charAt(0) + CURRENT_EVENT.hazard.slice(1).toLowerCase()} assessment · {answered} of {visible.length} answered ·{' '}
            <span className="text-amber-300">{preview.unknownIds.length} UNKNOWN</span>
            {missingNotes.length > 0 && <span className="text-red-300"> · {missingNotes.length} UNKNOWN need a note</span>}
          </p>
        </div>
        <div className="w-72">
          <div className="flex flex-wrap justify-end items-center gap-2 mb-2">
            <SyncStatusChip />
            <Button onClick={() => setHistoryFor('')}>Activity history</Button>
          </div>
          <div className="h-2 bg-gray-800 rounded" aria-hidden>
            <div className="h-2 bg-green-500 rounded" style={{ width: `${visible.length ? (answered / visible.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* disaster situation overview: reported facts vs. what still needs verification */}
      <section aria-label="Disaster Situation Overview" className="rounded-lg border border-gray-800 bg-gray-900 p-3 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div>
            <h2 className="text-sm font-semibold">Disaster Situation Overview</h2>
            <div className="text-[11px] text-gray-400">{CURRENT_EVENT.name} · {CURRENT_EVENT.situationLabel}</div>
          </div>
          <AiQuestionButton s={s} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-500 mr-1">Reported</span>
          {CURRENT_EVENT.facts.filter((f) => f.value).map((f) => (
            <span key={f.key} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-200">
              {f.label}: <b>{f.value}</b>
            </span>
          ))}
        </div>
        {CURRENT_EVENT.facts.some((f) => !f.value) && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-[11px] uppercase tracking-wide text-amber-400 mr-1">Unknown — needs verification</span>
            {CURRENT_EVENT.facts.filter((f) => !f.value).map((f) => (
              <span key={f.key} className="text-xs px-2 py-1 rounded border border-dashed border-amber-500 text-amber-300">
                {f.label}: <b>not yet known</b>
              </span>
            ))}
          </div>
        )}
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
            {(['ALL', 'UNANSWERED', 'UNKNOWN', 'NEEDS_NOTE'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={`text-xs px-3 py-1.5 ${filter === f ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                {f === 'ALL' ? 'All' : f === 'UNANSWERED' ? 'Unanswered' : f === 'UNKNOWN' ? 'UNKNOWN' : `Needs note (${missingNotes.length})`}
              </button>
            ))}
          </div>
          {shown.length === 0 && <p className="text-sm text-gray-400">No questions match this filter.</p>}
          {shown.map((q) => (
            <QuestionCard key={q.id} q={q} answer={answers[q.id]} note={s.assessment.notes[q.id] ?? ''}
              confirmed={!!s.assessment.confirmedFromSituation[q.id]} linked={s.assessment.linked[q.id]}
              deep={deepQuestionsOf(questions, q.id)} deepOpen={!!expanded[q.id]}
              deepAnswered={deepQuestionsOf(questions, q.id).filter((d) => answers[d.id] !== undefined).length}
              onHistory={() => setHistoryFor(q.id)} />
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

            {missingNotes.length > 0 && pending > 0 && (
              <div role="alert" className="mt-2 text-xs text-red-300">
                Add a note to every UNKNOWN answer first ({missingNotes.join(', ')}).
              </div>
            )}
            <Button variant="primary" className="w-full mt-3 py-2" disabled={pending === 0} onClick={apply}>
              {pending === 0 ? 'Nothing new to add' : missingNotes.length ? `Show ${missingNotes.length} UNKNOWN answer(s) missing a note` : `Add ${pending} item(s) to PPOST as drafts`}
            </Button>
            {message && (
              <div role="status" className="mt-2 text-xs text-green-300">
                {message} <button className="underline" onClick={() => navigate('/ppost')}>Open PPOST Workspace →</button>
              </div>
            )}
          </section>

          <AiInsightsPanel
            answeredCount={answered}
            buildContext={() => buildInsightContext(s, visible, preview)}
            onDraft={setEditing}
          />
        </aside>
      </div>

      {editing && <EntityEditor key={editing.record.id} target={editing} onClose={() => setEditing(null)} onOpen={setEditing} />}
      {historyFor !== undefined && (
        <ActivityLog key={historyFor || 'all'} scope="assessment" title="Activity history"
          questions={questions.map((q) => ({ id: q.id, text: q.text }))} initialQuestion={historyFor || undefined}
          onClose={() => setHistoryFor(undefined)} />
      )}
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

function QuestionCard({ q, answer, note, confirmed, linked, deep, deepOpen, deepAnswered, onHistory }: {
  q: QuestionUI; answer?: Answer; note: string; confirmed: boolean; linked?: string;
  deep: QuestionUI[]; deepOpen: boolean; deepAnswered: number; onHistory: () => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const noteRequired = answer === 'UNKNOWN';
  const noteMissing = noteRequired && !note.trim();
  const fact = q.situationFact && CURRENT_EVENT.facts.find((f) => f.key === q.situationFact!.key);
  const safety = q.unknownPolicy === 'SAFETY';
  const makesProblem = q.problemTitle && answer === (q.problemWhen ?? 'YES');

  return (
    <article aria-label={q.id} className={`rounded-lg border p-4 mb-3 ${q.deepOf ? 'ml-6 bg-gray-950 border-gray-700' : q.followUpOf ? 'ml-6 bg-gray-900 border-gray-700' : 'bg-gray-900 border-gray-800'} ${answer === 'UNKNOWN' ? '!border-dashed !border-amber-500' : ''}`}>
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        <IdChip id={q.id} />
        {q.deepOf && <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300">deeper question · {q.deepOf}</span>}
        {q.origin === 'AI_FROM_DOCUMENTS' && <span className="text-[11px] px-1.5 py-0.5 rounded border border-violet-600 text-violet-300">✦ AI-suggested from documents</span>}
        <span className="text-[11px] text-gray-500">{sectorLabel(q.sector)}</span>
        {safety && <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-950 text-red-300">safety-sensitive</span>}
        {q.followUpOf && <span className="text-[11px] text-gray-500">follow-up to {q.followUpOf}</span>}
      </div>
      <h3 className="text-sm text-gray-100 mb-1">{q.text}</h3>
      <div className="flex gap-3">
        <button onClick={() => setShowWhy(!showWhy)} className="text-[11px] text-blue-300 hover:underline" aria-expanded={showWhy}>
          {showWhy ? 'Hide why we ask' : 'Why we ask'}
        </button>
        <button onClick={onHistory} className="text-[11px] text-gray-400 hover:text-white hover:underline" aria-label={`View history for ${q.id}`}>
          View question history
        </button>
      </div>
      {showWhy && <p className="text-xs text-gray-400 mt-1">{q.why}</p>}

      {/* situation report hint (person must confirm) */}
      {fact && !confirmed && answer === undefined && (
        <div className="mt-2 rounded bg-gray-950 border border-gray-800 px-2 py-1.5 text-xs text-gray-300 flex flex-wrap items-center gap-2">
          {fact.value
            ? <>Situation report indicates <b>{fact.label}: {fact.value}</b> → suggests <b>{q.situationFact!.suggests}</b></>
            : <>Situation report: <b>{fact.label}</b> is not yet known → suggests <b>UNKNOWN</b> unless you can verify</>}
          <button onClick={() => confirmFromSituation(q.id, q.situationFact!.suggests)} className="text-green-400 hover:underline">
            Confirm {q.situationFact!.suggests}
          </button>
        </div>
      )}
      {confirmed && <div className="mt-1 text-[11px] text-gray-500">Answer confirmed from the situation report</div>}

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
      </div>

      {/* notes: optional for YES / NO, required for UNKNOWN */}
      <label className="block mt-3">
        <span className={`block text-[11px] mb-1 ${noteMissing ? 'text-red-300' : 'text-gray-400'}`}>
          Notes {noteRequired ? <b>(required for UNKNOWN — what is unknown, why, and who is checking)</b> : '(optional)'}
        </span>
        <textarea aria-label={`Note for ${q.id}`} aria-invalid={noteMissing} rows={2} value={note} onChange={(e) => setNote(q.id, e.target.value)}
          placeholder={noteRequired ? 'e.g. Utility has not reported pressure readings yet; M. Chen visiting the intake Oct 9.' : 'Source, who confirmed it, extra details…'}
          className={`w-full bg-gray-950 border rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${noteMissing ? 'border-red-600' : 'border-gray-700'}`} />
        {noteMissing && <span className="block text-[11px] text-red-400 mt-1">A note is required for UNKNOWN answers.</span>}
      </label>

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

      {deep.length > 0 && (
        <button onClick={() => setExpanded(q.id, !deepOpen)} aria-expanded={deepOpen}
          className="mt-3 text-xs text-blue-300 hover:text-blue-200 hover:underline">
          {deepOpen ? '▾ Hide deeper questions' : `▸ Ask ${deep.length} deeper questions`}
          {deepAnswered > 0 && <span className="text-gray-400"> · {deepAnswered} answered</span>}
        </button>
      )}
    </article>
  );
}

/**
 * "Suggest questions from documents" — only shown once the AI service registers a question provider.
 * Nothing is shown while it is not connected.
 */
function AiQuestionButton({ s }: { s: StoreState }) {
  const provider = getQuestionProvider();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!provider) return null;

  const generate = async () => {
    setBusy(true); setError('');
    try {
      const existing = [...questionsFor(CURRENT_EVENT.hazard).map((q) => q.id), ...s.assessment.aiQuestions.map((q) => q.id)];
      const qs = await provider.generate({
        event: { id: CURRENT_EVENT.id, name: CURRENT_EVENT.name, hazard: CURRENT_EVENT.hazard, location: CURRENT_EVENT.location },
        facts: CURRENT_EVENT.facts, documents: [], answers: s.assessment.answers, existingQuestionIds: existing,
      });
      setAiQuestions([...s.assessment.aiQuestions, ...sanitizeGenerated(qs, existing)]);
    } catch {
      setError('Could not generate questions. Try again later.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex items-center gap-2">
      <Button onClick={generate} disabled={busy}>{busy ? 'Generating…' : '✦ Suggest questions from documents'}</Button>
      {error && <span className="text-[11px] text-red-300">{error}</span>}
    </span>
  );
}

export default ImpactAssessment;
