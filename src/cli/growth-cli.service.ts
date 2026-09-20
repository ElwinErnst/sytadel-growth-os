import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceService } from '../modules/workspaces/workspace.service';
import { EvidenceService } from '../modules/evidence/evidence.service';
import { SignalService } from '../modules/signals/signal.service';
import { BriefService } from '../modules/briefs/brief.service';
import { RunOrchestrator } from '../modules/runs/run-orchestrator.service';
import { AgentRun } from '../modules/runs/entities/agent-run.entity';
import { RunStatus } from '../common/enums';
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
  analyze      --workspace <slug>
               (--file <path> --source-url <url> --source-name <name> --retrieved-at <iso>
                | --evidence <id> [<id> ...])
               [--idempotency-key <key>] [--executor <id>]
  run:show     --run <id>
  run:resume   --run <id>
  brief:show   --run <id>
  brief:export --run <id> --out <path>

Notes:
  - Evidence is operator-supplied; source URLs are DECLARED, not fetched.
  - Omitting --idempotency-key starts a NEW run (reprocess). Reusing a key
    RETRIES the same run (resumes from its last durable stage).`;

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
  ) {}

  async run(argv: string[]): Promise<number> {
    const args = parseArgs(argv);
    try {
      switch (args.command) {
        case 'ingest':
          return await this.ingest(args);
        case 'analyze':
          return await this.analyze(args);
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
