import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const CANDIDATE_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

function resolveProjectFile(basePath) {
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }

  for (const ext of CANDIDATE_EXTENSIONS) {
    const withExt = `${basePath}${ext}`;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return withExt;
    }
  }

  for (const ext of CANDIDATE_EXTENSIONS) {
    const indexFile = path.join(basePath, `index${ext}`);
    if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
      return indexFile;
    }
  }

  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Next.js bundles "server-only" internally; CLI scripts stub it as a no-op.
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export {};",
        shortCircuit: true,
      };
    }

    if (specifier.startsWith("@/")) {
      const target = resolveProjectFile(
        path.join(PROJECT_ROOT, specifier.slice(2)),
      );
      if (target) {
        return {
          url: pathToFileURL(target).href,
          shortCircuit: true,
        };
      }
    }

    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:") &&
      !context.parentURL.includes("/node_modules/")
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const target = resolveProjectFile(path.resolve(parentDir, specifier));
      if (target) {
        return {
          url: pathToFileURL(target).href,
          shortCircuit: true,
        };
      }
    }

    return nextResolve(specifier, context);
  },
});
