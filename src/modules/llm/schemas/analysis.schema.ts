import { z } from 'zod';
import { SignalCategory, SignalKind } from '../../../common/enums';

/**
 * Schema the model MUST satisfy for the analysis step. Output is parsed and
 * validated against this before anything is persisted; an invalid shape is a
 * hard failure (bounded retries), never a silent fallback.
 *
 * `evidenceRef` is a 1-based index into the evidence list handed to the model.
 * The service maps it back to a real evidence id and rejects out-of-range refs,
 * so the model cannot cite evidence it was not given.
 */
export const analysisSignalSchema = z.object({
  category: z.nativeEnum(SignalCategory),
  kind: z.nativeEnum(SignalKind),
  statement: z.string().min(3).max(1000),
  evidenceQuote: z.string().max(2000).nullable().optional(),
  confidence: z.number().min(0).max(1),
  evidenceRef: z.number().int().positive(),
});

export const analysisOutputSchema = z.object({
  signals: z.array(analysisSignalSchema).min(1).max(50),
});

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;
export type AnalysisSignal = z.infer<typeof analysisSignalSchema>;
