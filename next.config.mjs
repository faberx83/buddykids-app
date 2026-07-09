/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Nota: Next 16 non lancia più ESLint durante "next build" (non supporta
  // più la chiave "eslint" qui) — il build di produzione quindi non è mai
  // toccato dai file di test/report Playwright. Il lint resta comunque
  // pulito grazie agli ignore in eslint.config.mjs, per chi lancia
  // "npm run lint" manualmente.
};

export default nextConfig;
