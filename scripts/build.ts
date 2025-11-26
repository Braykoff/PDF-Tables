import { exec } from "node:child_process";
import type { ExecException } from "node:child_process";
import { copyFile, unlink, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import esbuild from "esbuild";

/**
 * Tries to delete a file if it exists.
 * @param path The path of the file to delete.
 * @returns Whether the file was deleted.
 */
async function deleteIfExists(path: string): Promise<boolean> {
  try {
    await access(path); // check file exists
    await unlink(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type checks the whole project.
 * @returns A promise that resolves or rejects once typechecking finishes.
 */
async function typeCheck(): Promise<boolean> {
  return new Promise((
    resolve: (value: boolean | PromiseLike<boolean>) => void,
    reject: (reason?: unknown) => void,
  ) => {
    exec("npm run typecheck", (
      err: ExecException | null,
      stdout: string, stderr: string,
    ) => {
      if (err) {
        console.error(stderr);
        reject(new Error("Typecheck failed"));
      } else {
        console.log(stdout || "Typecheck passed");
        resolve(true);
      }
    });
  });
}

/**
 * Builds with esbuild and copies the worker pdfjs file over. 
 * --sourcemap flag will include the sourcemap.
 */
async function build(): Promise<void> {
  // Typecheck
  await typeCheck();

  // Build with ESBuild
  const sourcemap: boolean = process.argv.includes("--sourcemap");

  await esbuild.build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    minify: true,
    sourcemap: sourcemap,
    outfile: "dist/bundled.min.js",
    target: "esnext",
    format: "esm",
    logLevel: "info",
  });
  console.log("Compiled bundle");

  // Try to remove old sourcemaps
  if (!sourcemap) {
    const bundleMap: string = path.resolve("dist/bundled.min.js.map");
    const deletedMap: boolean = await deleteIfExists(bundleMap);

    if (deletedMap) { console.log("Deleted old source map"); }
  }

  // Copy pdf.js worker file over
  const workerSource: string = path.resolve("node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
  const workerDest: string = path.resolve("dist/pdf.worker.min.mjs");
  await copyFile(workerSource, workerDest);
  console.log("Copied pdf.js worker");
}

// Run
try {
  await build();
  console.log("Built successfully");
} catch (err) {
  console.error("Build failed.", err);
  process.exit(1);
}
