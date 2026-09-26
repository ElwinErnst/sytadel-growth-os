/**
 * Shared domain enums for Growth OS. Kept as string unions persisted as text
 * columns so migrations stay readable and values are self-describing in the DB.
 */

/** Lifecycle of an AgentRun. Persisted so interrupted runs are recoverable. */
export enum RunStatus {
  /** Row created, work not started. */
  PENDING = 'pending',
  /** Actively executing a stage. A process crash leaves a run stuck here. */
  RUNNING = 'running',
  /** All stages done, brief persisted. */
  COMPLETED = 'completed',
  /** Terminal failure. `error` holds a sanitized reason. */
  FAILED = 'failed',
}

/**
 * The furthest stage a run has durably completed. Used to resume an
 * interrupted run without redoing already-persisted work.
 */
export enum RunStage {
  /** Nothing done yet. */
  CREATED = 'created',
  /** Input evidence validated and attached to the run. */
  EVIDENCE_READY = 'evidence_ready',
  /** Model analysis validated and MarketSignals persisted. */
  SIGNALS_PERSISTED = 'signals_persisted',
  /** FounderBrief generated and persisted. */
  BRIEF_PERSISTED = 'brief_persisted',
}

/** Role a run plays in the workflow. A single run walks all roles as steps. */
export enum AgentRole {
  /** The end-to-end research → analysis → brief workflow. */
  MARKET_RESEARCH = 'market_research',
}

/**
 * Who initiated a run. LOCAL is an operator identity that lives only inside
 * Growth OS. It is deliberately distinct from a Sytadel-authenticated identity
 * (which does not exist in this slice — see docs/integration).
 */
export enum ExecutorKind {
  LOCAL = 'local',
}

/**
 * Kind of a configured research source. Drives which connector collects it.
 * `web_page` (generic fetch + HTML→text) is the only kind implemented in this
 * slice; typed connectors (Hacker News, GitHub, …) are future kinds that follow
 * the same connector contract.
 */
export enum SourceKind {
  WEB_PAGE = 'web_page',
  /** Hacker News via the public Algolia search API (source url = the API URL). */
  HACKER_NEWS = 'hacker_news',
  /** GitHub releases via the public REST API (source url = the releases URL). */
  GITHUB_RELEASES = 'github_releases',
}

/** How a piece of evidence entered the system. */
export enum EvidenceProvenance {
  /** Supplied by the operator. We did NOT fetch or verify the source URL. */
  MANUAL = 'manual',
  /**
   * Fetched by Growth OS over HTTP(S) under SSRF controls. `sourceUrl` is the
   * final URL actually retrieved and `retrievedAt` is the real fetch time.
   */
  FETCHED = 'fetched',
}

/**
 * Category of a market signal. Kept as a closed set so the analysis prompt and
 * the schema stay in lockstep (the prompt lists these values dynamically).
 * Values are stored as text, so adding a category needs no migration.
 */
export enum SignalCategory {
  MARKET = 'market',
  COMPETITION = 'competition',
  SEGMENT = 'segment',
  PROBLEM = 'problem',
  PRICING = 'pricing',
  TREND = 'trend',
  POSITIONING = 'positioning',
  RISK = 'risk',
}

/**
 * Epistemic status of a signal. The workflow must separate what the evidence
 * states (FACT) from what the model infers (HYPOTHESIS).
 */
export enum SignalKind {
  FACT = 'fact',
  HYPOTHESIS = 'hypothesis',
}
