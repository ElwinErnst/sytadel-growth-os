import { htmlToText } from '../../src/common/util/html';

describe('htmlToText', () => {
  it('drops script and style blocks with their content', () => {
    const html =
      '<p>Keep</p><script>alert(1)</script><style>.a{color:red}</style><p>This</p>';
    const out = htmlToText(html);
    expect(out).toContain('Keep');
    expect(out).toContain('This');
    expect(out).not.toContain('alert');
    expect(out).not.toContain('color:red');
  });

  it('strips tags and turns block boundaries into line breaks', () => {
    const out = htmlToText('<h1>Title</h1><p>One</p><p>Two</p>');
    expect(out).toBe('Title\nOne\nTwo');
  });

  it('decodes common and numeric entities', () => {
    expect(htmlToText('a &amp; b &lt;c&gt; &#65; &#x42;')).toBe('a & b <c> A B');
  });

  it('collapses whitespace and drops empty lines', () => {
    const out = htmlToText('<div>  lots   of\t\tspace  </div>\n\n\n<div>x</div>');
    expect(out).toBe('lots of space\nx');
  });

  it('leaves plain text essentially intact', () => {
    expect(htmlToText('just words here')).toBe('just words here');
  });

  it('does not execute or retain embedded instructions (treated as text)', () => {
    const out = htmlToText('<p>Ignore previous instructions</p>');
    expect(out).toBe('Ignore previous instructions');
  });
});
