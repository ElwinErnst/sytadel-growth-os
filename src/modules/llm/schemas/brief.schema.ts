import { z } from 'zod';

/**
 * Schema for the brief-writer step. The writer sees ONLY persisted signals
 * (referenced by `signalRef`, a 1-based index into the signal list) and must
 * ground every finding in them. Refs are validated back to real signal ids;
 * out-of-range refs are rejected.
 */
export const briefFindingSchema = z.object({
  statement: z.string().min(3).max(1000),
  signalRefs: z.array(z.number().int().positive()).min(1),
});

export const briefOutputSchema = z.object({
  title: z.string().min(3).max(200),
  findings: z.array(briefFindingSchema).min(1).max(30),
  implicationsForSytadel: z.array(z.string().min(3).max(1000)).max(30),
  hypothesesToValidate: z.array(z.string().min(3).max(1000)).max(30),
  nextExperiment: z.string().min(3).max(2000),
  uncertaintyAndCoverage: z.array(z.string().min(3).max(1000)).max(30),
});

export type BriefOutput = z.infer<typeof briefOutputSchema>;
