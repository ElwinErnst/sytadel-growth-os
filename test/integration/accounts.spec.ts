import { AccountFitTier, AuditAction } from '../../src/common/enums';
import { ReferenceIntegrityError } from '../../src/common/errors';
import { ScopeDeniedError } from '../../src/modules/identity/sytadel-identity.service';
import { STEP_MARKER } from '../../src/modules/llm/providers/fixture.provider';
import {
  NoAccountsError,
  NoIcpError,
} from '../../src/modules/accounts/account.service';
import {
  analysisJson,
  briefJson,
  createTestApp,
  stubIdentity,
  TestApp,
  uniqueSlug,
} from './harness';

function icpJson(): string {
  return JSON.stringify({
    title: 'ICP',
    summary: 'AI-agent startups needing agent identity.',
    segments: [
      {
        name: 'AI-agent startups',
        description: 'Teams shipping autonomous agents.',
        signalRefs: [1],
      },
    ],
    idealCharacteristics: ['multi-tenant B2B SaaS'],
    keyPains: [{ pain: 'API keys insufficient', signalRefs: [1] }],
    disqualifiers: ['single-tenant internal tools'],
    recommendedBeachhead: 'AI-agent startups',
    hypothesesToValidate: ['they pay for agent identity'],
    uncertainty: ['limited signals'],
  });
}

function assessmentJson(fitScore: number, segmentRefs: number[]): string {
  return JSON.stringify({
    fitScore,
    matchedSegmentRefs: segmentRefs,
    rationale: 'Ships autonomous agents; multi-tenant.',
    gaps: ['team size unknown'],
    recommendedNextStep: 'Research their agent stack.',
  });
}

function allSteps(icp: string, assessment: string) {
  return (req: { system: string }) => {
    if (req.system.includes(STEP_MARKER.analysis)) {
      return analysisJson('AI-agent startups want agent identity');
    }
    if (req.system.includes(STEP_MARKER.icp)) return icp;
    if (req.system.includes(STEP_MARKER.account)) return assessment;
    return briefJson();
  };
}

/** Workspace with one signal + a generated ICP (v1, one segment). */
async function workspaceWithIcp(t: TestApp) {
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
  await t.icp.generate(workspace.id, 'local-cli');
  return workspace;
}

describe('Accounts + ICP-fit scoring (integration)', () => {
  it('adds accounts (dedup per workspace by normalized name)', async () => {
    const t = await createTestApp(allSteps(icpJson(), assessmentJson(0.8, [1])));
    try {
      const ws = await t.workspaces.getOrCreate(uniqueSlug());
      const a = await t.accounts.add({
        workspaceId: ws.id,
        name: 'Acme AI',
        notes: 'builds agents',
      });
      const b = await t.accounts.add({
        workspaceId: ws.id,
        name: '  acme   ai ',
        notes: 'dup',
      });
      expect(b.id).toBe(a.id);
    } finally {
      await t.close();
    }
  });

  it('scores an account against the ICP, grounded in segments, tier from score', async () => {
    const t = await createTestApp(allSteps(icpJson(), assessmentJson(0.8, [1])));
    try {
      const ws = await workspaceWithIcp(t);
      const account = await t.accounts.add({
        workspaceId: ws.id,
        name: 'Agentify',
        notes: 'multi-tenant SaaS shipping AI agents',
      });
      const [assessment] = await t.accounts.score(ws.id, 'local-cli');
      expect(assessment!.accountId).toBe(account.id);
      expect(assessment!.fitScore).toBeCloseTo(0.8, 5);
      expect(assessment!.tier).toBe(AccountFitTier.STRONG);
      expect(assessment!.matchedSegments).toEqual(['AI-agent startups']);
      expect(assessment!.icpVersion).toBe(1);

      const audit = await t.audit.listByWorkspace(ws.id, { limit: 50, offset: 0 });
      expect(audit.map((e) => e.action)).toContain(AuditAction.ACCOUNT_SCORED);
    } finally {
      await t.close();
    }
  });

  it('rejects an invented segment reference', async () => {
    const t = await createTestApp(allSteps(icpJson(), assessmentJson(0.6, [99])));
    try {
      const ws = await workspaceWithIcp(t);
      await t.accounts.add({ workspaceId: ws.id, name: 'X', notes: 'n' });
      await expect(t.accounts.score(ws.id, 'local-cli')).rejects.toBeInstanceOf(
        ReferenceIntegrityError,
      );
    } finally {
      await t.close();
    }
  });

  it('errors when there is no ICP yet', async () => {
    const t = await createTestApp(allSteps(icpJson(), assessmentJson(0.8, [1])));
    try {
      const ws = await t.workspaces.getOrCreate(uniqueSlug());
      await t.accounts.add({ workspaceId: ws.id, name: 'X', notes: 'n' });
      await expect(t.accounts.score(ws.id, 'local-cli')).rejects.toBeInstanceOf(
        NoIcpError,
      );
    } finally {
      await t.close();
    }
  });

  it('errors when there are no accounts to score', async () => {
    const t = await createTestApp(allSteps(icpJson(), assessmentJson(0.8, [1])));
    try {
      const ws = await workspaceWithIcp(t);
      await expect(t.accounts.score(ws.id, 'local-cli')).rejects.toBeInstanceOf(
        NoAccountsError,
      );
    } finally {
      await t.close();
    }
  });

  it('denies scoring when the principal lacks research:read', async () => {
    const t = await createTestApp(
      allSteps(icpJson(), assessmentJson(0.8, [1])),
      undefined,
      stubIdentity({
        tenantId: 't-1',
        tenantSlug: 'acme',
        serviceAccountId: 'sa-1',
        clientAppId: 'app-1',
        scopes: ['research:fetch'],
      }),
    );
    try {
      const ws = await t.workspaces.getOrCreate(uniqueSlug());
      await expect(t.accounts.score(ws.id, 'local-cli')).rejects.toBeInstanceOf(
        ScopeDeniedError,
      );
    } finally {
      await t.close();
    }
  });
});
