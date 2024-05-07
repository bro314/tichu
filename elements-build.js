const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["src/elements/elements.ts"],
    bundle: true,
    outfile: "dist/bundle.js",
    minify: false,
  })
  .catch(() => process.exit(1));
