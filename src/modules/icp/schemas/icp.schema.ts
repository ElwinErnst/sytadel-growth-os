import { z } from 'zod';

/**
 * Schema the model MUST satisfy for ICP synthesis. `signalRefs` are 1-based
 * indices into the signal list handed to the model; the service maps them back
 * to real signal ids and rejects out-of-range refs, so the model cannot cite
 * signals it was not given.
 */
const grounded = z.object({
  signalRefs: z.array(z.number().int().positive()).min(1),
});

export const icpOutputSchema = z.object({
  title: z.string().min(3).max(200),
  summary: z.string().min(3).max(2000),
  segments: z
    .array(
      grounded.extend({
        name: z.string().min(2).max(200),
        description: z.string().min(3).max(1000),
      }),
    )
    .min(1)
    .max(10),
  idealCharacteristics: z.array(z.string().min(2).max(500)).max(30),
  keyPains: z
    .array(
      grounded.extend({ pain: z.string().min(3).max(1000) }),
    )
    .max(30),
  disqualifiers: z.array(z.string().min(2).max(500)).max(30),
  recommendedBeachhead: z.string().min(3).max(1000),
  hypothesesToValidate: z.array(z.string().min(3).max(1000)).max(30),
  uncertainty: z.array(z.string().min(3).max(1000)).max(30),
});

export type IcpOutput = z.infer<typeof icpOutputSchema>;
