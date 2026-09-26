import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceService } from '../modules/workspaces/workspace.service';
import { EvidenceService } from '../modules/evidence/evidence.service';
import { SignalService } from '../modules/signals/signal.service';
import { BriefService } from '../modules/briefs/brief.service';
import { RunOrchestrator } from '../modules/runs/run-orchestrator.service';
import { FetchService } from '../modules/fetch/fetch.service';
import { ResearchService } from '../modules/research/research.service';
import { AgentRun } from '../modules/runs/entities/agent-run.entity';
import { RunStatus, SourceKind } from '../common/enums';
import { toPageParams } from '../common/pagination';
import {
  CliUsageError,
  getMany,
  getOne,
  parseArgs,
  ParsedArgs,
  requireOne,
} from './args';

const USAGE = `Sytadel Growth OS — CLI

Commands:
  ingest       --workspace <slug> --file <path> --source-url <url>
               --source-name <name> --retrieved-at <iso>
  analyze        --workspace <slug>
                 (--file <path> --source-url <url> --source-name <name> --retrieved-at <iso>
                  | --evidence <id> [<id> ...])
                 [--idempotency-key <key>] [--executor <id>]
  fetch          --workspace <slug> --url <url> [--source-name <name>]
  source:add     --workspace <slug> --url <url> [--label <name>]
                 [--kind web_page|hacker_news|github_releases]
  source:list    --workspace <slug>
  research       --workspace <slug> [--source <id> ...]
  workspace:list
  workspace:show --workspace <slug>
  evidence:list  --workspace <slug> [--limit <n>] [--offset <n>]
  run:list       --workspace <slug> [--status <status>] [--limit <n>] [--offset <n>]
  run:show       --run <id>
  run:resume     --run <id>
  signal:list    --run <id>
  brief:list     --workspace <slug> [--limit <n>] [--offset <n>]
  brief:show     --run <id>
  brief:export   --run <id> --out <path>

Notes:
  - Evidence is operator-supplied; source URLs are DECLARED, not fetched.
  - Omitting --idempotency-key starts a NEW run (reprocess). Reusing a key
    RETRIES the same run (resumes from its last durable stage).
  - --evidence accepts multiple ids to analyze several sources in one run.`;

/**
 * Command implementations for the CLI. Each returns a process exit code so
 * main.ts stays a thin bootstrap. Nothing here opens an HTTP port.
 */
@Injectable()
export class GrowthCli {
  constructor(
    private readonly workspaces: WorkspaceService,
    private readonly evidence: EvidenceService,
    private readonly signals: SignalService,
    private readonly briefs: BriefService,
    private readonly orchestrator: RunOrchestrator,
    private readonly fetch: FetchService,
    private readonly research: ResearchService,
  ) {}

  async run(argv: string[]): Promise<number> {
    const args = parseArgs(argv);
    try {
      switch (args.command) {
        case 'ingest':
          return await this.ingest(args);
        case 'analyze':
          return await this.analyze(args);
        case 'fetch':
          return await this.fetchCmd(args);
        case 'source:add':
          return await this.sourceAdd(args);
        case 'source:list':
          return await this.sourceList(args);
        case 'research':
          return await this.researchCmd(args);
        case 'workspace:list':
          return await this.workspaceList();
        case 'workspace:show':
          return await this.workspaceShow(args);
        case 'evidence:list':
          return await this.evidenceList(args);
        case 'run:list':
          return await this.runList(args);
        case 'signal:list':
          return await this.signalList(args);
        case 'brief:list':
          return await this.briefList(args);
        case 'run:show':
          return await this.runShow(args);
        case 'run:resume':
          return await this.runResume(args);
        case 'brief:show':
          return await this.briefShow(args);
        case 'brief:export':
          return await this.briefExport(args);
        case 'help':
        case undefined:
          console.log(USAGE);
          return 0;
        default:
          console.error(`Unknown command: ${args.command}\n`);
          console.error(USAGE);
          return 2;
      }
    } catch (err) {
      if (err instanceof CliUsageError) {
        console.error(`Error: ${err.message}\n`);
        console.error(USAGE);
        return 2;
      }
      // Domain/runtime errors: print the message, not a raw stack, to the user.
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
  }

  private async ingest(args: ParsedArgs): Promise<number> {
    const evidence = await this.ingestFromArgs(args);
    console.log(`Evidence ingested: ${evidence.id}`);
    console.log(`  workspace: ${args.values.get('workspace')?.[0]}`);
    console.log(`  bytes: ${evidence.contentBytes}  hash: ${evidence.contentHash.slice(0, 12)}…`);
    return 0;
  }

  private async analyze(args: ParsedArgs): Promise<number> {
    const slug = requireOne(args, 'workspace');
    const workspace = await this.workspaces.getOrCreate(slug);

    let evidenceIds = getMany(args, 'evidence');
    if (evidenceIds.length === 0) {
      // No explicit evidence: expect inline file ingestion.
      const evidence = await this.ingestFromArgs(args);
      evidenceIds = [evidence.id];
    }

    const idempotencyKey = getOne(args, 'idempotency-key') ?? uuidv4();
    const executorId = getOne(args, 'executor') ?? 'local-cli';

    const run = await this.orchestrator.startRun({
      workspace,
      evidenceIds,
      idempotencyKey,
      executorId,
    });

    await this.printRunSummary(run);
    return run.status === RunStatus.COMPLETED ? 0 : 1;
  }

  private async fetchCmd(args: ParsedArgs): Promise<number> {
    const slug = requireOne(args, 'workspace');
    const url = requireOne(args, 'url');
    const workspace = await this.workspaces.getOrCreate(slug);
    const evidence = await this.fetch.fetchToEvidence(
      workspace.id,
      url,
      getOne(args, 'source-name'),
    );
    console.log(`Fetched evidence: ${evidence.id}`);
    console.log(`  final url: ${evidence.sourceUrl}`);
    console.log(
      `  bytes: ${evidence.contentBytes}   provenance: ${evidence.provenance}`,
    );
    console.log(`  retrieved-at: ${evidence.retrievedAt.toISOString()}`);
    return 0;
  }

  private async sourceAdd(args: ParsedArgs): Promise<number> {
    const slug = requireOne(args, 'workspace');
    const url = requireOne(args, 'url');
    const kindRaw = getOne(args, 'kind');
    const kind = this.parseKind(kindRaw);
    if (kindRaw !== undefined && kind === undefined) {
      console.error(
        `Invalid --kind "${kindRaw}". Use one of: ${Object.values(SourceKind).join(', ')}`,
      );
      return 2;
    }
    const workspace = await this.workspaces.getOrCreate(slug);
    const source = await this.research.addSource(
      workspace.id,
      url,
      getOne(args, 'label'),
      kind,
    );
    console.log(`Source registered: ${source.id}`);
    console.log(`  ${source.kind}\t${source.url}\t"${source.label}"`);
    return 0;
  }

  private async sourceList(args: ParsedArgs): Promise<number> {
    const ws = await this.resolveWorkspace(args);
    if (!ws) return 1;
    const rows = await this.research.listSources(ws.id);
    console.log(`Sources in ${ws.slug} (${rows.length}):`);
    for (const s of rows) {
      const flag = s.enabled ? 'on ' : 'off';
      console.log(`  ${flag}\t${s.kind}\t${s.id}\t${s.url}\t"${s.label}"`);
    }
    return 0;
  }

  private async researchCmd(args: ParsedArgs): Promise<number> {
    const ws = await this.resolveWorkspace(args);
    if (!ws) return 1;
    const sourceIds = getMany(args, 'source');
    const result = await this.research.run(
      ws.id,
      sourceIds.length > 0 ? sourceIds : undefined,
    );
    console.log(
      `Research run in ${ws.slug}: ${result.stored} stored, ${result.failed} failed`,
    );
    for (const o of result.outcomes) {
      if (o.ok) {
        console.log(`  ok\t${o.label}\t-> ${o.evidenceIds.join(', ')}`);
      } else {
        console.log(`  FAIL\t${o.label}\t${o.error ?? ''}`);
      }
    }
    // Non-zero exit only if everything failed; partial success is still success.
    return result.outcomes.length > 0 && result.stored === 0 ? 1 : 0;
  }

  private async workspaceList(): Promise<number> {
    const all = await this.workspaces.list();
    if (all.length === 0) {
      console.log('No workspaces yet.');
      return 0;
    }
    for (const ws of all) {
      console.log(`${ws.slug}\t${ws.name}\t${ws.id}`);
    }
    return 0;
  }

  private async workspaceShow(args: ParsedArgs): Promise<number> {
    const ws = await this.resolveWorkspace(args);
    if (!ws) return 1;
    const [evidence, runs, signals, briefs] = await Promise.all([
      this.evidence.countByWorkspace(ws.id),
      this.orchestrator.countRuns(ws.id),
      this.signals.countByWorkspace(ws.id),
      this.briefs.countByWorkspace(ws.id),
    ]);
    console.log(`Workspace ${ws.slug} (${ws.id})`);
    console.log(`  name: ${ws.name}`);
    console.log(
      `  evidence: ${evidence}   runs: ${runs}   signals: ${signals}   briefs: ${briefs}`,
    );
    return 0;
  }

  private async evidenceList(args: ParsedArgs): Promise<number> {
    const ws = await this.resolveWorkspace(args);
    if (!ws) return 1;
    const page = toPageParams(getOne(args, 'limit'), getOne(args, 'offset'));
    const rows = await this.evidence.listByWorkspace(ws.id, page);
    const total = await this.evidence.countByWorkspace(ws.id);
    console.log(`Evidence in ${ws.slug} (${rows.length} of ${total}):`);
    for (const e of rows) {
      console.log(
        `  ${e.id}\t${e.ingestedAt.toISOString()}\t${e.contentBytes}B\t${e.sourceName}`,
      );
    }
    return 0;
  }

  private async runList(args: ParsedArgs): Promise<number> {
    const ws = await this.resolveWorkspace(args);
    if (!ws) return 1;
    const page = toPageParams(getOne(args, 'limit'), getOne(args, 'offset'));
    const statusRaw = getOne(args, 'status');
    const status = this.parseStatus(statusRaw);
    if (statusRaw !== undefined && status === undefined) {
      console.error(
        `Invalid --status "${statusRaw}". Use one of: ${Object.values(RunStatus).join(', ')}`,
      );
      return 2;
    }
    const rows = await this.orchestrator.listRuns(ws.id, page, status);
    const total = await this.orchestrator.countRuns(ws.id);
    console.log(`Runs in ${ws.slug} (${rows.length} of ${total}):`);
    for (const r of rows) {
      console.log(
        `  ${r.id}\t${r.status}\t${r.stage}\t${r.createdAt.toISOString()}\ttok=${r.inputTokens + r.outputTokens}`,
      );
    }
    return 0;
  }

  private async signalList(args: ParsedArgs): Promise<number> {
    const runId = requireOne(args, 'run');
    const rows = await this.signals.listByRun(runId);
    console.log(`Signals for run ${runId} (${rows.length}):`);
    for (const s of rows) {
      console.log(
        `  [${s.category}/${s.kind}] conf=${s.confidence.toFixed(2)}  ${s.statement}`,
      );
    }
    return 0;
  }

  private async briefList(args: ParsedArgs): Promise<number> {
    const ws = await this.resolveWorkspace(args);
    if (!ws) return 1;
    const page = toPageParams(getOne(args, 'limit'), getOne(args, 'offset'));
    const rows = await this.briefs.listByWorkspace(ws.id, page);
    const total = await this.briefs.countByWorkspace(ws.id);
    console.log(`Briefs in ${ws.slug} (${rows.length} of ${total}):`);
    for (const b of rows) {
      console.log(
        `  run=${b.runId}\t${b.createdAt.toISOString()}\t${b.title}`,
      );
    }
    return 0;
  }

  private async runShow(args: ParsedArgs): Promise<number> {
    const run = await this.orchestrator.getRun(requireOne(args, 'run'));
    await this.printRunSummary(run);
    return run.status === RunStatus.FAILED ? 1 : 0;
  }

  private async runResume(args: ParsedArgs): Promise<number> {
    const run = await this.orchestrator.execute(requireOne(args, 'run'));
    await this.printRunSummary(run);
    return run.status === RunStatus.COMPLETED ? 0 : 1;
  }

  private async briefShow(args: ParsedArgs): Promise<number> {
    const runId = requireOne(args, 'run');
    const brief = await this.briefs.findByRun(runId);
    if (!brief) {
      console.error(`No brief for run ${runId} (run may not have completed).`);
      return 1;
    }
    console.log(brief.bodyMarkdown);
    return 0;
  }

  private async briefExport(args: ParsedArgs): Promise<number> {
    const runId = requireOne(args, 'run');
    const out = requireOne(args, 'out');
    const brief = await this.briefs.findByRun(runId);
    if (!brief) {
      console.error(`No brief for run ${runId}.`);
      return 1;
    }
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, brief.bodyMarkdown, 'utf8');
    console.log(`Brief exported to ${out}`);
    return 0;
  }

  // --- helpers -------------------------------------------------------------

  /** Resolve an existing workspace by --workspace slug; error if absent. */
  private async resolveWorkspace(args: ParsedArgs) {
    const slug = requireOne(args, 'workspace');
    const ws = await this.workspaces.findBySlug(slug);
    if (!ws) {
      console.error(`Workspace "${slug}" not found.`);
      return null;
    }
    return ws;
  }

  private parseStatus(raw: string | undefined): RunStatus | undefined {
    if (raw === undefined) return undefined;
    return (Object.values(RunStatus) as string[]).includes(raw)
      ? (raw as RunStatus)
      : undefined;
  }

  private parseKind(raw: string | undefined): SourceKind | undefined {
    if (raw === undefined) return undefined;
    return (Object.values(SourceKind) as string[]).includes(raw)
      ? (raw as SourceKind)
      : undefined;
  }

  private async ingestFromArgs(args: ParsedArgs) {
    const slug = requireOne(args, 'workspace');
    const workspace = await this.workspaces.getOrCreate(slug);
    const file = requireOne(args, 'file');
    const sourceUrl = requireOne(args, 'source-url');
    const sourceName = requireOne(args, 'source-name');
    const retrievedAtRaw = requireOne(args, 'retrieved-at');
    const retrievedAt = new Date(retrievedAtRaw);

    const content = await readFile(file, 'utf8');
    return this.evidence.ingest({
      workspaceId: workspace.id,
      sourceName,
      sourceUrl,
      retrievedAt,
      content,
    });
  }

  private async printRunSummary(run: AgentRun): Promise<void> {
    const signals = await this.signals.listByRun(run.id);
    const brief = await this.briefs.findByRun(run.id);
    console.log(`Run ${run.id}`);
    console.log(`  status: ${run.status}   stage: ${run.stage}`);
    console.log(`  provider: ${run.provider}   model: ${run.model}`);
    console.log(
      `  workflow: ${run.workflowVersion}   prompt: ${run.promptVersion}`,
    );
    console.log(
      `  tokens: in=${run.inputTokens} out=${run.outputTokens}   signals: ${signals.length}   brief: ${brief ? 'yes' : 'no'}`,
    );
    if (run.error) console.log(`  error: ${run.error}`);
    if (brief) console.log(`  brief title: ${brief.title}`);
  }
}
