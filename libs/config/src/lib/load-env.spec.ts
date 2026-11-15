import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { loadEnv } from './load-env';
import { ConfigValidationError } from './validate-env';

const schema = z.object({
  LOAD_ENV_TEST_A: z.string(),
  LOAD_ENV_TEST_B: z.string(),
});

describe('loadEnv', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ims-env-'));
    delete process.env['LOAD_ENV_TEST_A'];
    delete process.env['LOAD_ENV_TEST_B'];
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('merges files, with earlier files and the real environment winning', () => {
    const service = join(dir, 'service.env');
    const shared = join(dir, 'shared.env');
    writeFileSync(service, 'LOAD_ENV_TEST_A=from-service\n');
    writeFileSync(
      shared,
      'LOAD_ENV_TEST_A=from-shared\nLOAD_ENV_TEST_B=from-shared\n',
    );

    expect(loadEnv(schema, { files: [service, shared] })).toEqual({
      LOAD_ENV_TEST_A: 'from-service',
      LOAD_ENV_TEST_B: 'from-shared',
    });

    process.env['LOAD_ENV_TEST_B'] = 'from-environment';
    expect(loadEnv(schema, { files: [shared] }).LOAD_ENV_TEST_B).toBe(
      'from-environment',
    );
  });

  it('ignores missing files and still fails fast on invalid config', () => {
    expect(() =>
      loadEnv(schema, { files: [join(dir, 'does-not-exist.env')] }),
    ).toThrow(ConfigValidationError);
  });
});
