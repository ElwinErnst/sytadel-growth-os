import { RunStatus, RunStage } from '../../src/common/enums';
import { LlmProviderError } from '../../src/modules/llm/llm-provider.interface';
import { STEP_MARKER } from '../../src/modules/llm/providers/fixture.provider';
import { AgentRun } from '../../src/modules/runs/entities/agent-run.entity';
import { FounderBrief } from '../../src/modules/briefs/entities/founder-brief.entity';
import {
  analysisJson,
  briefJson,
  createTestApp,
  TestApp,
  uniqueSlug,
} from './harness';

/** A script that answers each step by its marker. */
function stepScript(analysis: string, brief: string) {
  return (req: { system: string }) =>
    req.system.includes(STEP_MARKER.analysis) ? analysis : brief;
}

async function ingestOne(t: TestApp, slug = uniqueSlug()) {
  const workspace = await t.workspaces.getOrCreate(slug);
  const evidence = await t.evidence.ingest({
    workspaceId: workspace.id,
    sourceName: 'src',
    sourceUrl: 'https://example.com',
    retrievedAt: new Date('2026-09-20T00:00:00Z'),
    content: `evidence for ${slug}`,
  });
  return { workspace, evidenceId: evidence.id };
}

describe('RunOrchestrator (integration)', () => {
  it('completes the happy path and grounds brief findings in real signals', async () => {
    const t = await createTestApp(
      stepScript(analysisJson('Auth incumbents raised prices'), briefJson()),
    );
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      const run = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'tester',
      });

      expect(run.status).toBe(RunStatus.COMPLETED);
      expect(run.stage).toBe(RunStage.BRIEF_PERSISTED);

      const signals = await t.signals.listByRun(run.id);
      expect(signals).toHaveLength(1);
      expect(signals[0]!.evidenceId).toBe(evidenceId);

      const brief = await t.briefs.findByRun(run.id);
      expect(brief).not.toBeNull();
      const signalIds = new Set(signals.map((s) => s.id));
      for (const finding of brief!.content.findings) {
        for (const sid of finding.signalIds) {
          expect(signalIds.has(sid)).toBe(true); // no invented citations
        }
      }
    } finally {
      await t.close();
    }
  });

  it('handles multiple evidence and maps each signal to the right source', async () => {
    const twoSignals = JSON.stringify({
      signals: [
        {
          category: 'pricing',
          kind: 'fact',
          statement: 'From the first source',
          evidenceQuote: null,
          confidence: 0.7,
          evidenceRef: 1,
        },
        {
          category: 'competition',
          kind: 'hypothesis',
          statement: 'From the second source',
          evidenceQuote: null,
          confidence: 0.6,
          evidenceRef: 2,
        },
      ],
    });
    const t = await createTestApp(stepScript(twoSignals, briefJson()));
    try {
      const slug = uniqueSlug();
      const workspace = await t.workspaces.getOrCreate(slug);
      const e1 = await t.evidence.ingest({
        workspaceId: workspace.id,
        sourceName: 'first',
        sourceUrl: 'https://a.test',
        retrievedAt: new Date('2026-09-20T00:00:00Z'),
        content: 'first source content',
      });
      const e2 = await t.evidence.ingest({
        workspaceId: workspace.id,
        sourceName: 'second',
        sourceUrl: 'https://b.test',
        retrievedAt: new Date('2026-09-20T00:00:00Z'),
        content: 'second source content',
      });

      const run = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [e1.id, e2.id],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'tester',
      });
      expect(run.status).toBe(RunStatus.COMPLETED);

      const signals = await t.signals.listByRun(run.id);
      expect(signals).toHaveLength(2);
      const byStatement = new Map(signals.map((s) => [s.statement, s.evidenceId]));
      expect(byStatement.get('From the first source')).toBe(e1.id);
      expect(byStatement.get('From the second source')).toBe(e2.id);
    } finally {
      await t.close();
    }
  });

  it('idempotency: same key retries the same run; new key reprocesses', async () => {
    const t = await createTestApp(
      stepScript(analysisJson('signal'), briefJson()),
    );
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      const key = uniqueSlug('key');
      const first = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: key,
        executorId: 'tester',
      });
      const retry = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: key,
        executorId: 'tester',
      });
      expect(retry.id).toBe(first.id);
      // No duplicate signals from the retry.
      expect(await t.signals.listByRun(first.id)).toHaveLength(1);

      const reprocess = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key2'),
        executorId: 'tester',
      });
      expect(reprocess.id).not.toBe(first.id);
    } finally {
      await t.close();
    }
  });

  it('rejects invented evidence references and persists nothing', async () => {
    const t = await createTestApp(
      stepScript(analysisJson('bad', 99), briefJson()),
    );
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      const run = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'tester',
      });
      expect(run.status).toBe(RunStatus.FAILED);
      expect(run.error).toContain('ReferenceIntegrityError');
      expect(await t.signals.listByRun(run.id)).toHaveLength(0);
    } finally {
      await t.close();
    }
  });

  it('fails on invalid model output with a sanitized error', async () => {
    const t = await createTestApp(stepScript('not json at all', briefJson()));
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      const run = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'tester',
      });
      expect(run.status).toBe(RunStatus.FAILED);
      expect(run.error).toContain('InvalidModelOutputError');
      expect(await t.signals.listByRun(run.id)).toHaveLength(0);
    } finally {
      await t.close();
    }
  });

  it('deduplicates identical signals within a run', async () => {
    const dup = JSON.stringify({
      signals: [
        {
          category: 'market',
          kind: 'fact',
          statement: 'Same claim.',
          evidenceQuote: null,
          confidence: 0.5,
          evidenceRef: 1,
        },
        {
          category: 'market',
          kind: 'fact',
          statement: '  same   claim ',
          evidenceQuote: null,
          confidence: 0.5,
          evidenceRef: 1,
        },
      ],
    });
    const t = await createTestApp(stepScript(dup, briefJson()));
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      const run = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'tester',
      });
      expect(run.status).toBe(RunStatus.COMPLETED);
      expect(await t.signals.listByRun(run.id)).toHaveLength(1);
    } finally {
      await t.close();
    }
  });

  it('fails visibly when the provider keeps failing (no fabricated result)', async () => {
    const t = await createTestApp(
      () => new LlmProviderError('provider down', true),
    );
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      const run = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'tester',
      });
      expect(run.status).toBe(RunStatus.FAILED);
      expect(run.error).toContain('LlmProviderError');
      expect(await t.briefs.findByRun(run.id)).toBeNull();
    } finally {
      await t.close();
    }
  });

  it('enforces the per-run token budget', async () => {
    const prev = process.env.GROWTH_RUN_TOKEN_BUDGET;
    process.env.GROWTH_RUN_TOKEN_BUDGET = '10';
    const t = await createTestApp((req) =>
      req.system.includes(STEP_MARKER.analysis)
        ? {
            text: analysisJson('costly'),
            model: 'm',
            usage: { inputTokens: 100, outputTokens: 100 },
          }
        : briefJson(),
    );
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      const run = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'tester',
      });
      expect(run.status).toBe(RunStatus.FAILED);
      expect(run.error).toContain('BudgetExceededError');
    } finally {
      await t.close();
      if (prev === undefined) delete process.env.GROWTH_RUN_TOKEN_BUDGET;
      else process.env.GROWTH_RUN_TOKEN_BUDGET = prev;
    }
  });

  it('recovers a partially-failed run on resume without redoing analysis', async () => {
    // First app: analysis OK, brief step throws → partial failure.
    const failing = await createTestApp((req) => {
      if (req.system.includes(STEP_MARKER.analysis)) return analysisJson('sig');
      return new LlmProviderError('brief writer down', false);
    });
    let runId: string;
    let workspaceId: string;
    try {
      const { workspace, evidenceId } = await ingestOne(failing);
      workspaceId = workspace.id;
      const run = await failing.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'tester',
      });
      runId = run.id;
      expect(run.status).toBe(RunStatus.FAILED);
      expect(run.stage).toBe(RunStage.SIGNALS_PERSISTED);
      expect(await failing.signals.listByRun(run.id)).toHaveLength(1);
      expect(await failing.briefs.findByRun(run.id)).toBeNull();
    } finally {
      await failing.close();
    }

    // Second app: resume. The FIRST model call must be the brief — if analysis
    // were re-run it would receive briefJson and fail schema validation.
    const resuming = await createTestApp(() => briefJson('Resumed'));
    try {
      const run = await resuming.orchestrator.execute(runId);
      expect(run.status).toBe(RunStatus.COMPLETED);
      const brief = await resuming.briefs.findByRun(runId);
      expect(brief?.title).toBe('Resumed');
      // Signals unchanged (analysis not repeated).
      expect(await resuming.signals.listByRun(runId)).toHaveLength(1);
      expect(workspaceId).toBeDefined();
    } finally {
      await resuming.close();
    }
  });

  it('persists across a fresh connection (durability)', async () => {
    let runId: string;
    const t = await createTestApp(
      stepScript(analysisJson('durable'), briefJson('Durable')),
    );
    try {
      const { workspace, evidenceId } = await ingestOne(t);
      const run = await t.orchestrator.startRun({
        workspace,
        evidenceIds: [evidenceId],
        idempotencyKey: uniqueSlug('key'),
        executorId: 'tester',
      });
      runId = run.id;
      expect(run.status).toBe(RunStatus.COMPLETED);
    } finally {
      await t.close();
    }

    // New app = new DataSource/connection: data must still be there.
    const fresh = await createTestApp();
    try {
      const run = await fresh.dataSource
        .getRepository(AgentRun)
        .findOneByOrFail({ id: runId });
      expect(run.status).toBe(RunStatus.COMPLETED);
      const brief = await fresh.dataSource
        .getRepository(FounderBrief)
        .findOneByOrFail({ runId });
      expect(brief.title).toBe('Durable');
    } finally {
      await fresh.close();
    }
  });
});
