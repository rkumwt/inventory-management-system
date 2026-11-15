import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig, type UserConfig } from 'vite';

const workspaceRoot = resolve(import.meta.dirname, '../..');

/** `@ims/*` aliases, read from tsconfig.base.json so they are defined once. */
function workspaceAliases(): Record<string, string> {
  const tsconfig = JSON.parse(
    readFileSync(join(workspaceRoot, 'tsconfig.base.json'), 'utf8'),
  ) as { compilerOptions: { paths: Record<string, string[]> } };

  return Object.fromEntries(
    Object.entries(tsconfig.compilerOptions.paths).map(([alias, [target]]) => [
      alias,
      join(workspaceRoot, target ?? ''),
    ]),
  );
}

/**
 * Shared Vite config for every NestJS app in the workspace.
 *
 * - Builds a single Node bundle (`dist/apps/<app>/main.js`) from `src/main.ts`
 *   using Vite's SSR mode: the app and the `@ims/*` libs are bundled, while
 *   packages from node_modules stay external and are loaded at runtime.
 * - TypeScript is compiled by SWC rather than Vite's default esbuild, because
 *   NestJS dependency injection needs `emitDecoratorMetadata`, which esbuild
 *   does not support.
 * - The build does not type-check; the `typecheck` target (tsc) does that.
 */
export function defineNestApp(appName: string): UserConfig {
  const appRoot = join(workspaceRoot, 'apps', appName);

  return defineConfig(({ mode }) => ({
    root: appRoot,
    cacheDir: join(workspaceRoot, 'node_modules/.vite', appName),
    resolve: { alias: workspaceAliases() },
    plugins: [
      swc.vite({
        jsc: {
          target: 'es2022',
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          keepClassNames: true,
        },
      }),
    ],
    build: {
      ssr: 'src/main.ts',
      target: 'node22',
      outDir: join(workspaceRoot, 'dist/apps', appName),
      // In watch mode keep the old bundle in place until the new one is
      // written, so the running process never sees a missing file.
      emptyOutDir: mode !== 'development',
      sourcemap: true,
      minify: false,
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: 'main.js' },
      },
    },
  })) as UserConfig;
}
