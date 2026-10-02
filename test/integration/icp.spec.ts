import { AuditAction } from '../../src/common/enums';
import { ReferenceIntegrityError } from '../../src/common/errors';
import { ScopeDeniedError } from '../../src/modules/identity/sytadel-identity.service';
import { STEP_MARKER } from '../../src/modules/llm/providers/fixture.provider';
import { NoSignalsError } from '../../src/modules/icp/icp.service';
import {
  analysisJson,
  briefJson,
  createTestApp,
  stubIdentity,
  TestApp,
  uniqueSlug,
} from './harness';

function icpJson(segmentRef = 1): string {
  return JSON.stringify({
    title: 'ICP: AI-agent startups',
    summary: 'Teams shipping autonomous agents that need agent identity.',
    segments: [
      {
        name: 'AI-agent startups',
        description: 'Startups deploying autonomous agents.',
        signalRefs: [segmentRef],
      },
    ],
    idealCharacteristics: ['multi-tenant B2B SaaS', 'ships AI agents'],
    keyPains: [{ pain: 'API keys insufficient for agents', signalRefs: [1] }],
    disqualifiers: ['single-tenant internal tools'],
    recommendedBeachhead: 'AI-agent startups needing agent identity',
    hypothesesToValidate: ['They will pay for agent identity'],
    uncertainty: ['Limited signal volume'],
  });
}

/** One script routing analysis / brief / icp by marker. */
function allSteps(icp: string) {
  return (req: { system: string }) => {
    if (req.system.includes(STEP_MARKER.analysis)) {
      return analysisJson('AI-agent startups want agent identity');
    }
    if (req.system.includes(STEP_MARKER.icp)) return icp;
    return briefJson();
  };
}

/** Create a workspace with one persisted signal (via a completed run). */
async function workspaceWithSignal(t: TestApp) {
  const workspace = await t.workspaces.getOrCreate(uniqueSlug());
  const evidence = await t.evidence.ingest({
    workspaceId: workspace.id,
    sourceName: 'src',
    sourceUrl: 'https://example.com',
    retrievedAt: new Date('2026-10-02T00:00:00Z'),
    content: 'agents need identity',
  });
  await t.orchestrator.startRun({
    workspace,
    evidenceIds: [evidence.id],
    idempotencyKey: uniqueSlug('key'),
    executorId: 'local-cli',
  });
  return workspace;
}

describe('ICP Agent (integration)', () => {
  it('synthesizes an ICP grounded in real signals', async () => {
    const t = await createTestApp(allSteps(icpJson()));
    try {
      const ws = await workspaceWithSignal(t);
      const signals = await t.signals.listByWorkspace(ws.id, 100);
      expect(signals.length).toBeGreaterThan(0);

      const profile = await t.icp.generate(ws.id, 'local-cli');
      expect(profile.version).toBe(1);
      expect(profile.sourceSignalCount).toBe(signals.length);
      // Grounded: the segment's signalIds map to a real signal in the workspace.
      const ids = new Set(signals.map((s) => s.id));
      for (const seg of profile.content.segments) {
        for (const sid of seg.signalIds) expect(ids.has(sid)).toBe(true);
      }
      expect(profile.bodyMarkdown).toContain('# ICP: AI-agent startups');

      const audit = await t.audit.listByWorkspace(ws.id, {
        limit: 50,
        offset: 0,
      });
      expect(audit.map((e) => e.action)).toContain(AuditAction.ICP_GENERATED);
    } finally {
      await t.close();
    }
  });

  it('rejects an invented signal reference', async () => {
    const t = await createTestApp(allSteps(icpJson(99)));
    try {
      const ws = await workspaceWithSignal(t);
      await expect(t.icp.generate(ws.id, 'local-cli')).rejects.toBeInstanceOf(
        ReferenceIntegrityError,
      );
    } finally {
      await t.close();
    }
  });

  it('versions successive ICPs', async () => {
    const t = await createTestApp(allSteps(icpJson()));
    try {
      const ws = await workspaceWithSignal(t);
      const v1 = await t.icp.generate(ws.id, 'local-cli');
      const v2 = await t.icp.generate(ws.id, 'local-cli');
      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect((await t.icp.getLatest(ws.id))?.version).toBe(2);
    } finally {
      await t.close();
    }
  });

  it('errors when the workspace has no signals', async () => {
    const t = await createTestApp(allSteps(icpJson()));
    try {
      const ws = await t.workspaces.getOrCreate(uniqueSlug());
      await expect(t.icp.generate(ws.id, 'local-cli')).rejects.toBeInstanceOf(
        NoSignalsError,
      );
    } finally {
      await t.close();
    }
  });

  it('denies generation when the principal lacks research:read', async () => {
    const t = await createTestApp(
      allSteps(icpJson()),
      undefined,
      stubIdentity({
        tenantId: 't-1',
        tenantSlug: 'acme',
        serviceAccountId: 'sa-1',
        clientAppId: 'app-1',
        scopes: ['research:fetch'], // no research:read
      }),
    );
    try {
      // The scope check runs before the signal lookup, so an empty workspace is
      // enough — and avoids the denied identity also blocking analyze setup.
      const ws = await t.workspaces.getOrCreate(uniqueSlug());
      await expect(t.icp.generate(ws.id, 'local-cli')).rejects.toBeInstanceOf(
        ScopeDeniedError,
      );
    } finally {
      await t.close();
    }
  });
});
