import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { build, Platform } from "electron-builder";

const projectRoot = resolve(import.meta.dirname, "..");
const tempOutput = join(tmpdir(), "accio-switch-release");
const releaseOutput = join(projectRoot, "release");

rmSync(tempOutput, { recursive: true, force: true });

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";
if (!isWindows && !isMac) {
  throw new Error(
    `electron:build currently supports Windows (portable exe) and macOS (.app + zip). Detected platform: ${process.platform}`,
  );
}

const platformConfig = isWindows
  ? {
      win: {
        target: "portable",
        icon: "assets/accio-switch.ico",
        artifactName: "Accio-Switch-${version}.exe",
      },
    }
  : {
      mac: {
        target: ["dir", "zip"],
        icon: "build/icon.icns",
        category: "public.app-category.utilities",
        artifactName: "Accio-Switch-${version}-macos-${arch}.${ext}",
      },
    };

const targets = isWindows
  ? Platform.WINDOWS.createTarget("portable")
  : Platform.MAC.createTarget(["dir", "zip"]);

const artifacts = await build({
  targets,
  config: {
    directories: {
      output: tempOutput,
    },
    ...platformConfig,
  },
});

mkdirSync(releaseOutput, { recursive: true });

if (isWindows) {
  const portable = artifacts.find(
    (artifact) => artifact.endsWith(".exe") && basename(artifact).startsWith("Accio-Switch-"),
  );
  if (!portable) {
    throw new Error(`Portable executable was not produced. Artifacts: ${artifacts.join(", ")}`);
  }
  const destination = join(releaseOutput, basename(portable));
  copyFileSync(portable, destination);
  console.log(`Windows portable executable: ${destination}`);
} else {
  const zipFile = artifacts.find(
    (artifact) => artifact.endsWith(".zip") && basename(artifact).startsWith("Accio-Switch-"),
  );
  if (!zipFile) {
    throw new Error(`macOS zip was not produced. Artifacts: ${artifacts.join(", ")}`);
  }
  const destination = join(releaseOutput, basename(zipFile));
  copyFileSync(zipFile, destination);
  console.log(`macOS release archive: ${destination}`);

  // Also keep the ready-to-run .app in release/ so contributors can launch it directly.
  // electron-builder places the unpacked bundle under a <platform>-<arch> directory.
  let builtApp = null;
  for (const entry of readdirSync(tempOutput, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nested = join(tempOutput, entry.name, "Accio Switch.app");
    if (fs.existsSync(nested)) builtApp = nested;
  }
  const appSource = builtApp || join(tempOutput, "Accio Switch.app");
  const appDestination = join(releaseOutput, "Accio Switch.app");
  try {
    cpSync(appSource, appDestination, { recursive: true });
    console.log(`macOS app bundle: ${appDestination}`);
  } catch (error) {
    console.warn(`App bundle copy skipped: ${error.message}`);
  }
}
