import {
  ApprovalAction,
  ApprovalStatus,
  AuditAction,
} from '../../src/common/enums';
import {
  ApprovalRequiredError,
  ApprovalStateError,
} from '../../src/modules/approvals/approval.service';
import { createTestApp, TestApp, uniqueSlug } from './harness';

describe('HITL approval gate (integration)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  async function propose(expiresAt: Date | null = null) {
    const ws = await t.workspaces.getOrCreate(uniqueSlug());
    const req = await t.approvals.propose({
      workspaceId: ws.id,
      action: ApprovalAction.BRIEF_DELIVERY,
      params: { runId: 'run-x', to: 'ops@example.com' },
      requestedBy: 'local-cli',
      expiresAt,
    });
    return { ws, req };
  }

  it('proposing persists PENDING and does not authorize execution', async () => {
    const { req } = await propose();
    expect(req.status).toBe(ApprovalStatus.PENDING);
    await expect(
      t.approvals.requireApproved(req.id, ApprovalAction.BRIEF_DELIVERY),
    ).rejects.toBeInstanceOf(ApprovalRequiredError);
  });

  it('approve → executable exactly once (no replay)', async () => {
    const { req } = await propose();
    await t.approvals.approve(req.id, 'alex');
    const ok = await t.approvals.requireApproved(
      req.id,
      ApprovalAction.BRIEF_DELIVERY,
    );
    expect(ok.status).toBe(ApprovalStatus.APPROVED);

    await t.approvals.markExecuted(req.id);
    await expect(
      t.approvals.requireApproved(req.id, ApprovalAction.BRIEF_DELIVERY),
    ).rejects.toBeInstanceOf(ApprovalStateError);
  });

  it('denied is terminal and never executable', async () => {
    const { req } = await propose();
    const denied = await t.approvals.deny(req.id, 'alex');
    expect(denied.status).toBe(ApprovalStatus.DENIED);
    await expect(
      t.approvals.requireApproved(req.id, ApprovalAction.BRIEF_DELIVERY),
    ).rejects.toBeInstanceOf(ApprovalRequiredError);
    // Cannot re-decide a non-pending request.
    await expect(t.approvals.approve(req.id, 'alex')).rejects.toBeInstanceOf(
      ApprovalStateError,
    );
  });

  it('expires a stale pending request lazily', async () => {
    const { req } = await propose(new Date(Date.now() - 1000));
    const got = await t.approvals.get(req.id);
    expect(got.status).toBe(ApprovalStatus.EXPIRED);
    await expect(
      t.approvals.requireApproved(req.id, ApprovalAction.BRIEF_DELIVERY),
    ).rejects.toBeInstanceOf(ApprovalRequiredError);
  });

  it('rejects a mismatched action', async () => {
    const { req } = await propose();
    await t.approvals.approve(req.id, 'alex');
    await expect(
      t.approvals.requireApproved(req.id, 'other.action' as ApprovalAction),
    ).rejects.toBeInstanceOf(ApprovalStateError);
  });

  it('emits audit events for propose and approve', async () => {
    const { ws, req } = await propose();
    await t.approvals.approve(req.id, 'alex');
    const events = await t.audit.listByWorkspace(ws.id, {
      limit: 20,
      offset: 0,
    });
    const actions = events.map((e) => e.action);
    expect(actions).toContain(AuditAction.APPROVAL_REQUESTED);
    expect(actions).toContain(AuditAction.APPROVAL_APPROVED);
  });
});
