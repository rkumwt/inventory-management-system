#!/bin/sh
# Writes the Nx/TypeScript/Jest/Vite boilerplate for a NestJS app.
# Usage: tools/scaffold-app.sh <app-name>
set -eu
app="$1"
dir="apps/$app"
mkdir -p "$dir/src"

cat > "$dir/project.json" <<JSON
{
  "name": "$app",
  "\$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "$dir/src",
  "projectType": "application",
  "tags": ["type:app"],
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "outputs": ["{workspaceRoot}/dist/$dir"],
      "options": {
        "command": "vite build --config $dir/vite.config.mts"
      }
    },
    "serve": {
      "executor": "nx:run-commands",
      "continuous": true,
      "dependsOn": ["build"],
      "options": {
        "commands": [
          "vite build --config $dir/vite.config.mts --mode development --watch",
          "node --watch --enable-source-maps dist/$dir/main.js"
        ],
        "parallel": true
      }
    },
    "typecheck": {
      "executor": "nx:run-commands",
      "options": {
        "command": "tsc --noEmit -p $dir/tsconfig.json"
      }
    },
    "test-int": {
      "executor": "nx:run-commands",
      "options": {
        "command": "jest -c $dir/jest.int.config.js --runInBand --passWithNoTests"
      }
    }
  }
}
JSON

cat > "$dir/tsconfig.json" <<JSON
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node", "jest"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
JSON

cat > "$dir/vite.config.mts" <<TS
import { defineNestApp } from '../../tools/vite/nest-app';

export default defineNestApp('$app');
TS

cat > "$dir/jest.config.js" <<JS
module.exports = {
  displayName: '$app',
  preset: '../../jest.preset.js',
  coverageDirectory: '../../coverage/$dir',
};
JS

cat > "$dir/jest.int.config.js" <<JS
// Integration tests: run against real infrastructure (pnpm docker:up).
module.exports = {
  displayName: '$app-int',
  preset: '../../jest.preset.js',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testTimeout: 30000,
};
JS
echo "scaffolded $dir"
