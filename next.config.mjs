/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // TRAMA — TEST PIPELINE NUOVO ACCOUNT (30/09/2026): commit e ora della
  // build, letti da lib/build-info.ts per la BuildInfoBubble (temporanea,
  // dietro BUILD_INFO_BUBBLE_ENABLED). Inlined a build time.
  env: {
    TRAMA_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA || "",
    TRAMA_BUILD_TIME: new Date().toISOString(),
  },
  // Nota: Next 16 non lancia più ESLint durante "next build" (non supporta
  // più la chiave "eslint" qui) — il build di produzione quindi non è mai
  // toccato dai file di test/report Playwright. Il lint resta comunque
  // pulito grazie agli ignore in eslint.config.mjs, per chi lancia
  // "npm run lint" manualmente.
};

export default nextConfig;
