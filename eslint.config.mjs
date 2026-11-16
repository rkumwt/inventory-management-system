import nx from '@nx/eslint-plugin';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Module boundaries (enforced by @nx/enforce-module-boundaries):
 *
 *   apps  ->  libs only (an app may never import another app)
 *   libs  ->  libs only, and only "downwards":
 *
 *     config    (leaf)
 *     events    (leaf)
 *     common    -> config, events
 *     database  -> config, common, events
 */
export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/coverage',
      '**/.next',
      '**/next-env.d.ts',
      '**/node_modules',
      '**/out-tsc',
      '.nx',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:lib'] },
            { sourceTag: 'type:lib', onlyDependOnLibsWithTags: ['type:lib'] },
            {
              sourceTag: 'lib:config',
              onlyDependOnLibsWithTags: ['lib:config'],
            },
            {
              sourceTag: 'lib:events',
              onlyDependOnLibsWithTags: ['lib:events'],
            },
            {
              sourceTag: 'lib:common',
              onlyDependOnLibsWithTags: [
                'lib:common',
                'lib:config',
                'lib:events',
              ],
            },
            {
              sourceTag: 'lib:database',
              onlyDependOnLibsWithTags: [
                'lib:database',
                'lib:config',
                'lib:common',
                'lib:events',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-console': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
  {
    // The frontend: React's rules of hooks, and no server code in the bundle.
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@ims/*'],
              message:
                'The @ims libs are server code (NestJS, TypeORM). The frontend keeps its own copy of the API contract in src/lib/api/types.ts.',
            },
          ],
        },
      ],
    },
  },
  prettier,
];
