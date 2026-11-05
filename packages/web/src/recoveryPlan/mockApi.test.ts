import { MOCK_DISASTER_ID, createMockRecoveryPlanApi } from './mockApi';

describe('mock recovery plan adapter', () => {
  it('returns the synthetic draft for the demo disaster', async () => {
    const api = createMockRecoveryPlanApi({ delayMs: 0 });

    const result = await api.generateDraft(MOCK_DISASTER_ID);

    expect(api.isMock).toBe(true);
    expect(result.draftId).toBe('mock-draft-1');
    expect(result.draft.kind).toBe('INITIAL_RECOVERY_PLAN_DRAFT');
    expect(result.draft.isSynthetic).toBe(true);
    expect(result.draft.structure.provisional).toBe(true);
    expect(result.draft.sections.map((s) => s.key)).toEqual([
      'DOCUMENT_CONTROL',
      'EXECUTIVE_SUMMARY',
      'EVENT_OVERVIEW',
      'IMPACT_ASSESSMENT',
      'RECOVERY_PRIORITIES',
      'PPOST_CHAINS',
      'RESOURCES_AND_BUDGET',
      'GAPS_AND_CONFIRMATIONS',
      'RECOMMENDED_NEXT_STEPS',
      'SOURCE_RECORD_INDEX',
    ]);
  });

  it('returns an independent copy for every generation', async () => {
    const api = createMockRecoveryPlanApi({ delayMs: 0 });

    const first = await api.generateDraft(MOCK_DISASTER_ID);
    first.draft.sections.length = 0;
    const second = await api.generateDraft(MOCK_DISASTER_ID);

    expect(second.draftId).toBe('mock-draft-2');
    expect(second.draft.sections).toHaveLength(10);
  });

  it('can simulate a failure', async () => {
    const api = createMockRecoveryPlanApi({ delayMs: 0, shouldFail: () => true });

    await expect(api.generateDraft(MOCK_DISASTER_ID)).rejects.toThrow(/Simulated failure/);
  });

  it('only has data for the synthetic demo disaster', async () => {
    const api = createMockRecoveryPlanApi({ delayMs: 0 });

    await expect(api.generateDraft('EV-OTHER')).rejects.toThrow(/only has synthetic data/);
  });
});
