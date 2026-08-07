import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";

function copyDir(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = resolve(src, entry);
    const destPath = resolve(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

const EXTRA_COPY_DIRS = ["js", "assets", "images"];

function copyExtensionFiles() {
  return {
    name: "copy-extension-files",
    closeBundle() {
      const srcDir = resolve(__dirname, "src");
      const distDir = resolve(__dirname, "dist");
      copyDir(srcDir, distDir);
      const manifest = resolve(__dirname, "manifest.json");
      if (existsSync(manifest)) {
        copyFileSync(manifest, resolve(distDir, "manifest.json"));
      }
      const iconsDir = resolve(__dirname, "icons");
      if (existsSync(iconsDir)) {
        copyDir(iconsDir, resolve(distDir, "icons"));
      }
      for (const dirName of EXTRA_COPY_DIRS) {
        const dir = resolve(__dirname, dirName);
        if (existsSync(dir)) {
          copyDir(dir, resolve(distDir, dirName));
        }
      }
      const extraFiles = ["merged-background.js", "lift-worker.js", "career-worker.js", "service-worker.js", "popup.html"];
      for (const file of extraFiles) {
        const srcFile = resolve(__dirname, file);
        if (existsSync(srcFile)) {
          copyFileSync(srcFile, resolve(distDir, file));
        }
      }
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist",
    emptyDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/noop.js"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
  plugins: [copyExtensionFiles()],
});
