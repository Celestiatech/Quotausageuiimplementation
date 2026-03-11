import { promises as fs } from "fs";
import path from "path";
import {
  getExtensionProviderConfig,
  listExtensionProviderConfigs,
  type ExtensionProvider,
} from "src/lib/extension-providers";

const EXTENSION_INCLUDE_ENTRIES = ["manifest.json", "icons", "src"] as const;

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

export async function getExtensionRelease(provider: ExtensionProvider = "linkedin"): Promise<ExtensionRelease> {
  const config = getExtensionProviderConfig(provider);
  const rootPath = path.join(process.cwd(), config.rootDir);
  const manifestPath = path.join(rootPath, "manifest.json");
  let manifest: ExtensionManifest = {};

  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as ExtensionManifest;
  } catch {
    manifest = {};
  }

  const version = String(manifest.version || "").trim() || "0.0.0";
  const displayName = String(manifest.name || "").trim() || config.displayName;
  const zipBaseName = `${config.zipPrefix}${version}`;

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

export async function listExtensionReleases() {
  return Promise.all(
    listExtensionProviderConfigs().map(async (config) => ({
      provider: config.provider,
      shortLabel: config.shortLabel,
      ...(await getExtensionRelease(config.provider)),
    })),
  );
}
