import { z } from 'zod';

/**
 * Schema for an account's ICP-fit assessment. `matchedSegmentRefs` are 1-based
 * indices into the ICP segment list given to the model; the service maps them
 * back to segment names and rejects out-of-range refs, so the model cannot cite
 * a segment the ICP does not have. `tier` is NOT requested — it is derived from
 * `fitScore` in code.
 */
export const assessmentOutputSchema = z.object({
  fitScore: z.number().min(0).max(1),
  matchedSegmentRefs: z.array(z.number().int().positive()).max(20),
  rationale: z.string().min(3).max(2000),
  gaps: z.array(z.string().min(2).max(500)).max(20),
  recommendedNextStep: z.string().min(3).max(1000),
});

export type AssessmentOutput = z.infer<typeof assessmentOutputSchema>;
