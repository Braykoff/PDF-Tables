import { copyFile, unlink, access } from "fs/promises";
import path from "path";
import process from "process";
import esbuild from "esbuild";

/**
 * Tries to delete a file if it exists.
 * @param {string} path The path of the file to delete.
 * @returns Whether the file was deleted.
 */
async function deleteIfExists(path) {
  try {
    await access(path); // check file exists
    await unlink(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds with esbuild and copies the worker pdfjs file over. 
 * --sourcemap flag will include the sourcemap.
 */
async function build() {
  // Build with ESBuild
  await esbuild.build({
    entryPoints: ["src/main.js"],
    bundle: true,
    minify: true,
    sourcemap: process.argv.includes("--sourcemap"),
    outfile: "dist/bundled.min.js",
    target: "esnext",
    format: "esm",
    logLevel: "info",
  });
  console.log("Compiled bundle");

  // Try to remove old sourcemaps
  if (!process.argv.includes("--sourcemap")) {
    const bundleMap = path.resolve("dist/bundled.min.js.map");
    const deletedMap = await deleteIfExists(bundleMap);

    if (deletedMap) { console.log("Deleted old source map"); }
  }

  // Copy pdf.js worker file over
  const workerSource = path.resolve("node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
  const workerDest = path.resolve("dist/pdf.worker.min.mjs");
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
