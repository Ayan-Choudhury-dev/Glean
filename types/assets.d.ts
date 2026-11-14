// Side-effect CSS imports (NativeWind's global stylesheet).
//
// `expo-env.d.ts` normally declares these, but Expo generates that file and it
// is gitignored, so a fresh checkout — CI included — has no declaration and
// `import '@/global.css'` fails typecheck. This file is tracked, so it applies
// everywhere.

declare module '*.css';
