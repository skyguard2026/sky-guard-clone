import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fonty a logo pro PDF se čtou ze souborů za běhu, takže je Next musí
  // přibalit do serverless funkce — sám je jako závislost nevidí.
  outputFileTracingIncludes: {
    "/**": ["./lib/pdf/fonts/**", "./lib/pdf/assets/**"],
  },
  // @react-pdf/renderer je Node knihovna, do klientského bundlu nepatří.
  serverExternalPackages: ["@react-pdf/renderer"],

  /**
   * Veřejný web je statický export v public/. Next z public/ neumí
   * directory index, takže čisté adresy, které dřív obstaral `cleanUrls`
   * na Vercelu, se skládají tady. Aplikace žije jen pod /hub.
   */
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    return [
      // stejné chování jako dřív s cleanUrls
      { source: "/index.html", destination: "/", permanent: true },
      // stará přihlašovací stránka webu → skutečné přihlášení Hubu
      { source: "/hub/login", destination: "/hub/prihlaseni", permanent: true },
      { source: "/hub/login.html", destination: "/hub/prihlaseni", permanent: true },
    ];
  },
};

export default nextConfig;
