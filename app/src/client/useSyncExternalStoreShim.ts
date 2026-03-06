/**
 * Re-export React's built-in useSyncExternalStore so packages that import
 * from 'use-sync-external-store/shim' work with React 18+ (Vite can't use the CJS shim as ESM).
 */
export { useSyncExternalStore } from "react";
