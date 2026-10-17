// Preloaded by `pnpm test` before any test file. Node 21+ exposes a global
// `navigator` whose language follows the operating system, so UI tests that
// assert English markup rendered Portuguese on pt-BR machines. Pin the detected
// locale to English; tests that cover pt-BR call setLocale('pt-BR') explicitly.
Object.defineProperty(globalThis, 'navigator', {
  value: {language: 'en-US', languages: ['en-US']},
  configurable: true,
  writable: true,
});
