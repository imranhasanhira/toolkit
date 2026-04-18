/// <reference types="vite/client" />

// This is needed to properly support Vitest testing with jest-dom matchers.
// Types for jest-dom are not recognized automatically and Typescript complains
// about missing types e.g. when using `toBeInTheDocument` and other matchers.
// Reference: https://github.com/testing-library/jest-dom/issues/546#issuecomment-1889884843
import "@testing-library/jest-dom";

// Vite-injected build identifier used for cache-busting /locales/* fetches.
// See app/vite.config.ts and app/src/i18n/index.ts.
// Wrapped in `declare global` because this file has top-level imports and is
// therefore treated as a module; otherwise the declaration would not be
// visible outside this file.
declare global {
  const __BUILD_HASH__: string;
}
