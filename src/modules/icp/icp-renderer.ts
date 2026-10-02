import { IcpContent } from './entities/icp-profile.entity';
import { MarketSignal } from '../signals/entities/market-signal.entity';

/**
 * Render an ICP to Markdown. Grounded sections (segments, pains) show the signals
 * they rest on, so each ICP claim traces back to evidence-backed signals.
 */
export function renderIcpMarkdown(
  title: string,
  content: IcpContent,
  signals: MarketSignal[],
): string {
  const byId = new Map(signals.map((s) => [s.id, s]));
  const lines: string[] = [];

  lines.push(`# ${title}`, '');
  lines.push(
    '> Ideal Customer Profile synthesized by Sytadel Growth OS from market',
    '> signals. Segments and pains cite the signals they rest on.',
    '',
    content.summary,
    '',
  );

  lines.push('## Candidate segments', '');
  content.segments.forEach((seg, i) => {
    lines.push(`${i + 1}. **${seg.name}** — ${seg.description}`);
    for (const sid of seg.signalIds) {
      const s = byId.get(sid);
      if (s) lines.push(`   - signal: [${s.category}/${s.kind}] ${s.statement}`);
    }
  });
  lines.push('');

  lines.push('## Key pains', '');
  if (content.keyPains.length === 0) lines.push('_None reported._', '');
  content.keyPains.forEach((p) => {
    lines.push(`- ${p.pain}`);
    for (const sid of p.signalIds) {
      const s = byId.get(sid);
      if (s) lines.push(`  - signal: [${s.category}/${s.kind}] ${s.statement}`);
    }
  });
  lines.push('');

  section(lines, 'Ideal characteristics', content.idealCharacteristics);
  section(lines, 'Disqualifiers', content.disqualifiers);

  lines.push('## Recommended beachhead', '', content.recommendedBeachhead, '');

  section(lines, 'Hypotheses to validate', content.hypothesesToValidate);
  section(lines, 'Uncertainty & coverage limits', content.uncertainty);

  return lines.join('\n').trimEnd() + '\n';
}

function section(lines: string[], heading: string, items: string[]): void {
  lines.push(`## ${heading}`, '');
  if (items.length === 0) {
    lines.push('_None reported._', '');
    return;
  }
  for (const item of items) lines.push(`- ${item}`);
  lines.push('');
}
