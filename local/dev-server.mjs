import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const cliArgs = new Set(process.argv.slice(2));
const watchOnly = cliArgs.has("--watch-only");
const onceOnly = cliArgs.has("--once");
const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || "8080";

function runExecFile(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err && typeof err.code === "number" ? err.code : err ? 1 : 0;
      resolve({ code, stdout: stdout || "", stderr: stderr || "" });
    });
  });
}

function readPackageVersion() {
  const pkgPath = path.join(rootDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return String(pkg.version || "0.0.0");
}

function formatTime() {
  return new Date().toTimeString().slice(0, 8);
}

async function buildOnce(reason) {
  const t0 = Date.now();
  const tscBin = path.join(rootDir, "node_modules", ".bin", "tsc");
  const tscRes = await runExecFile(tscBin, [
    "--incremental",
    "--tsBuildInfoFile",
    path.join("dist", ".tsbuildinfo"),
    "-p",
    "src",
  ]);
  if (tscRes.code !== 0) {
    console.error(`[${formatTime()}] [watch] TypeScript compile failed (${reason}):`);
    if (tscRes.stdout.trim()) console.error(tscRes.stdout.trim());
    if (tscRes.stderr.trim()) console.error(tscRes.stderr.trim());
    return false;
  }

  const tmpOut = path.join(rootDir, "tichu.js.tmp");
  const finalOut = path.join(rootDir, "tichu.js");
  try {
    const version = readPackageVersion();
    const [es5Res, es6Res] = await Promise.all([
      esbuild.build({
        entryPoints: [path.join(rootDir, "dist", "tichu.js")],
        bundle: true,
        write: false,
        target: "es5",
        define: {
          __TICHU_CODE_VERSION__: JSON.stringify(version),
        },
        logLevel: "silent",
      }),
      esbuild.build({
        entryPoints: [path.join(rootDir, "src", "elements", "elements.ts")],
        bundle: true,
        write: false,
        logLevel: "silent",
      }),
    ]);

    const es5Text = es5Res.outputFiles[0].text;
    const es6Text = es6Res.outputFiles[0].text;
    const separator = es5Text.endsWith("\n") ? "" : "\n";
    const combined = es5Text + separator + es6Text;

    fs.writeFileSync(tmpOut, combined, "utf8");
    fs.renameSync(tmpOut, finalOut);

    const kb = (Buffer.byteLength(combined, "utf8") / 1024).toFixed(1);
    const ms = Date.now() - t0;
    console.log(`[${formatTime()}] [watch] Rebuilt tichu.js (${kb} KB) in ${ms}ms [${reason}]`);
    return true;
  } catch (err) {
    try {
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    } catch (_cleanupErr) {
      // ignore temp cleanup errors
    }
    console.error(`[${formatTime()}] [watch] esbuild bundle failed (${reason}):`, err);
    return false;
  }
}

let building = false;
let pendingReason = null;

async function triggerBuild(reason) {
  if (building) {
    pendingReason = reason;
    return true;
  }
  building = true;
  let ok = true;
  let currentReason = reason;
  try {
    while (currentReason !== null) {
      const activeReason = currentReason;
      pendingReason = null;
      ok = await buildOnce(activeReason);
      currentReason = pendingReason;
    }
  } finally {
    building = false;
  }
  return ok;
}

async function main() {
  if (onceOnly) {
    const ok = await triggerBuild("once");
    process.exit(ok ? 0 : 1);
  }

  if (!watchOnly) {
    const mysqlRes = await runExecFile("bash", ["local/mysql-ctl.sh", "ensure"]);
    if (mysqlRes.stdout.trim()) console.log(mysqlRes.stdout.trim());
    if (mysqlRes.code !== 0) {
      if (mysqlRes.stderr.trim()) console.error(mysqlRes.stderr.trim());
      process.exit(mysqlRes.code);
    }
  }

  const initialOk = await triggerBuild("initial");
  if (!initialOk && !fs.existsSync(path.join(rootDir, "tichu.js"))) {
    process.exit(1);
  }

  let phpProc = null;
  if (!watchOnly) {
    phpProc = spawn("php", ["-S", `${host}:${port}`, "local/router.php"], {
      cwd: rootDir,
      stdio: "inherit",
    });
    phpProc.on("exit", (code, signal) => {
      if (!shuttingDown) {
        console.error(
          `[${formatTime()}] [dev] PHP server exited unexpectedly (code=${code}, signal=${signal})`,
        );
        cleanup(typeof code === "number" ? code : 1);
      }
    });
  }

  const srcDir = path.join(rootDir, "src");
  let debounceTimer = null;
  const watcher = fs.watch(srcDir, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    const rel = String(filename).replace(/\\/g, "/");
    if (!/\.(tsx?|json)$/.test(rel) || rel.endsWith("~") || rel.includes(".tmp")) {
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void triggerBuild(rel);
    }, 100);
  });

  console.log(
    `[${formatTime()}] [watch] Watching src/ for TypeScript changes${watchOnly ? " (watch-only)" : ` alongside http://${host}:${port}`}`,
  );

  let shuttingDown = false;
  function cleanup(exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    try {
      watcher.close();
    } catch (_e) {
      // ignore watcher close errors
    }
    if (phpProc && !phpProc.killed) {
      try {
        phpProc.kill("SIGTERM");
      } catch (_e) {
        // ignore kill errors
      }
    }
    process.exit(exitCode);
  }

  process.on("SIGINT", () => cleanup(0));
  process.on("SIGTERM", () => cleanup(0));
}

void main();
