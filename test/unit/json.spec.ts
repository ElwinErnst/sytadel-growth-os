import { z } from 'zod';
import {
  InvalidModelOutputError,
  parseModelJson,
} from '../../src/common/util/json';

const schema = z.object({ a: z.number(), b: z.string() });

describe('parseModelJson', () => {
  it('parses a clean JSON object', () => {
    expect(parseModelJson('{"a":1,"b":"x"}', schema)).toEqual({ a: 1, b: 'x' });
  });

  it('tolerates prose around the object', () => {
    const text = 'Here is the result:\n{"a":2,"b":"y"}\nThanks!';
    expect(parseModelJson(text, schema)).toEqual({ a: 2, b: 'y' });
  });

  it('tolerates ```json fences', () => {
    const text = '```json\n{"a":3,"b":"z"}\n```';
    expect(parseModelJson(text, schema)).toEqual({ a: 3, b: 'z' });
  });

  it('rejects output with no JSON object', () => {
    expect(() => parseModelJson('no json here', schema)).toThrow(
      InvalidModelOutputError,
    );
  });

  it('rejects malformed JSON', () => {
    expect(() => parseModelJson('{"a":1,', schema)).toThrow(
      InvalidModelOutputError,
    );
  });

  it('rejects JSON that violates the schema', () => {
    expect(() => parseModelJson('{"a":"nope","b":"x"}', schema)).toThrow(
      InvalidModelOutputError,
    );
  });
});
