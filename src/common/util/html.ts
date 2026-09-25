/**
 * Minimal, dependency-free HTML → text normalizer for fetched pages. It is not a
 * full parser: it drops script/style, turns block-level tags into line breaks,
 * strips remaining tags, decodes a handful of common entities, and collapses
 * whitespace. Good enough to turn a noisy page into readable evidence text; the
 * result is still treated as untrusted data downstream.
 */
export function htmlToText(html: string): string {
  let text = html;

  // Remove script/style/noscript/template blocks entirely (with content).
  text = text.replace(
    /<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi,
    ' ',
  );
  // Comments.
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  // Line breaks and paragraph/heading/list boundaries → newline.
  text = text.replace(/<\/?(br|p|div|li|tr|h[1-6]|section|article)\b[^>]*>/gi, '\n');
  // Any remaining tag → space.
  text = text.replace(/<[^>]+>/g, ' ');

  text = decodeEntities(text);

  // Collapse intra-line whitespace, trim, and drop empty lines so the result is
  // compact readable text (one line per block).
  const lines = text
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter((line) => line !== '');

  return lines.join('\n').trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  copy: '©',
  reg: '®',
  trade: '™',
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isNaN(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? match;
  });
}
