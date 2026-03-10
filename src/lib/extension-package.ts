import { promises as fs } from "fs";
import path from "path";

const EXTENSION_ROOT_DIR = "CareerPilotLinkedInExtension";
const EXTENSION_INCLUDE_ENTRIES = ["manifest.json", "icons", "src"] as const;
const EXTENSION_PACKAGE_PREFIX = "AutoApplyCVExtensionVersion";

type ExtensionManifest = {
  name?: string;
  version?: string;
};

export type ExtensionRelease = {
  version: string;
  displayName: string;
  zipBaseName: string;
  zipFileName: string;
  rootDirName: string;
  rootPath: string;
  includeEntries: string[];
};

export async function getExtensionRelease(): Promise<ExtensionRelease> {
  const rootPath = path.join(process.cwd(), EXTENSION_ROOT_DIR);
  const manifestPath = path.join(rootPath, "manifest.json");
  let manifest: ExtensionManifest = {};

  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as ExtensionManifest;
  } catch {
    manifest = {};
  }

  const version = String(manifest.version || "").trim() || "0.0.0";
  const displayName = String(manifest.name || "").trim() || "AutoApply CV LinkedIn Copilot";
  const zipBaseName = `${EXTENSION_PACKAGE_PREFIX}${version}`;

  return {
    version,
    displayName,
    zipBaseName,
    zipFileName: `${zipBaseName}.zip`,
    rootDirName: zipBaseName,
    rootPath,
    includeEntries: [...EXTENSION_INCLUDE_ENTRIES],
  };
}
