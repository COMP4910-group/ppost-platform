/**
 * Cost of one tactic: current amount, full history (never overwritten) and a way to
 * enter an initial allowance before a Class D estimate exists.
 * Class D estimates themselves are made on the Class D Estimates page (finance team)
 * and arrive here through financeBridge.recordClassDEstimate().
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tactic } from 'ppost-engine';
import { recordCost, usePpost } from './store';
import { costState, getCostHistory, moneyFull, STAGE_LABEL } from './financeBridge';
import { Button, inputCls } from './ui';

export function TacticCostSection({ tactic }: { tactic: Tactic }) {
  const s = usePpost();
  const navigate = useNavigate();
  const history = getCostHistory(tactic.id, s);
  const current = history[history.length - 1];
  const state = costState(tactic, current);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const add = () => {
    const n = Number(amount.replace(/[$,\s]/g, ''));
    if (!n || n < 0) { setError('Enter an amount greater than 0'); return; }
    if (!reason.trim()) { setError('Say how you got this number (e.g. "42 units × $35k")'); return; }
    recordCost({
      tacticId: tactic.id, amount: n, stage: 'ALLOWANCE', status: 'draft', reason: reason.trim(),
      by: tactic.owner ?? 'Planner', source: 'PPOST',
    });
    setAmount(''); setReason(''); setError(''); setOpen(false);
  };

  return (
    <section aria-label="Tactic cost" className="rounded-lg border border-gray-800 p-3 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-white">Cost</h3>
        <span className={`text-[11px] px-1.5 py-0.5 rounded ${state === 'FINALIZED' ? 'bg-green-950 text-green-300' : state === 'DRAFT' ? 'bg-amber-950 text-amber-300' : 'border border-red-800 text-red-300'}`}>
          {state === 'FINALIZED' ? '✓ Finalized' : state === 'DRAFT' ? 'Draft / not finalized' : 'Needs estimate'}
        </span>
      </div>

      {current ? (
        <div className="text-sm text-gray-200 mb-2">
          <b className="text-white text-base">{moneyFull(current.amount)}</b>{' '}
          <span className="text-xs text-gray-400">{STAGE_LABEL[current.stage]}{current.revision ? ` ${current.revision}` : ''} · {current.status.replace('_', ' ')}</span>
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-2">No cost yet. Add an initial allowance, or create a Class D estimate.</p>
      )}

      {history.length > 0 && (
        <ol aria-label="Cost history" className="text-xs space-y-1 mb-3 border-l border-gray-700 pl-3">
          {history.map((e, i) => {
            const prev = history[i - 1];
            const delta = prev ? e.amount - prev.amount : 0;
            return (
              <li key={e.id}>
                <span className="text-gray-500">{new Date(e.at).toLocaleDateString()}</span>{' '}
                <span className="text-gray-200">{STAGE_LABEL[e.stage]}{e.revision ? ` ${e.revision}` : ''}: {moneyFull(e.amount)}</span>
                {prev && delta !== 0 && (
                  <span className={delta > 0 ? 'text-red-300' : 'text-green-300'}> ({delta > 0 ? '▲ +' : '▼ −'}{moneyFull(Math.abs(delta))})</span>
                )}
                <div className="text-gray-500">{e.reason} — {e.by}{e.source === 'SYNTHETIC' ? ' · synthetic' : ''}</div>
              </li>
            );
          })}
        </ol>
      )}

      {open ? (
        <div className="rounded border border-gray-800 p-2">
          <div className="grid grid-cols-3 gap-2">
            <input aria-label="Allowance amount" className={inputCls} placeholder="$ amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input aria-label="How was this number reached" className={`${inputCls} col-span-2`} placeholder="How did you get this number?" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <div className="text-[11px] text-red-400 mt-1">{error}</div>}
          <div className="flex gap-2 mt-2">
            <Button onClick={add}>Add allowance</Button>
            <Button variant="ghost" onClick={() => { setOpen(false); setError(''); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOpen(true)}>+ Initial allowance</Button>
          <Button variant="ghost" onClick={() => navigate('/estimates')}>Open Class D Estimates →</Button>
        </div>
      )}
      <p className="text-[11px] text-gray-500 mt-2">Earlier numbers are kept. Each change is added as a new entry, so the history shows how the cost moved.</p>
    </section>
  );
}
