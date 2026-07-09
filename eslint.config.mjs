import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Output generato da Playwright (report HTML con JS di terze parti
    // minificato/bundlato, non codice sorgente nostro) — mai da lintare:
    // "npm run lint" (eslint .) altrimenti li scansiona e produce centinaia
    // di falsi errori/warning su codice che non abbiamo scritto noi.
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
