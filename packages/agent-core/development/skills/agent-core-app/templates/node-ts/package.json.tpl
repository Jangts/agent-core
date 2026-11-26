{
  "name": __PACKAGE_NAME__,
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "exports": { ".": { "types": "./dist/app.d.ts", "import": "./dist/app.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "npm run build && node --test test/*.test.mjs",
    "knowledge:check": "node scripts/knowledge.mjs",
    "example": "node --env-file=.env examples/ask.mjs"
  },
  "dependencies": { "@jangts/agent-core": __SDK_VERSION__ },
  "devDependencies": { "typescript": __TYPESCRIPT_VERSION__ }
}
