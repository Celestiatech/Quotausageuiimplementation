import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const workspaceRoot = 'e:\\Autoapply';

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Package LinkedIn Copilot Extension
console.log('Packaging LinkedIn Copilot Extension...');
const stagingLinkedin = path.join(workspaceRoot, '.ext_staging_linkedin');
if (fs.existsSync(stagingLinkedin)) {
  fs.rmSync(stagingLinkedin, { recursive: true, force: true });
}
fs.mkdirSync(stagingLinkedin, { recursive: true });

fs.copyFileSync(
  path.join(workspaceRoot, 'CareerPilotLinkedInExtension', 'manifest.json'),
  path.join(stagingLinkedin, 'manifest.json')
);
copyDirRecursive(
  path.join(workspaceRoot, 'CareerPilotLinkedInExtension', 'icons'),
  path.join(stagingLinkedin, 'icons')
);
copyDirRecursive(
  path.join(workspaceRoot, 'CareerPilotLinkedInExtension', 'src'),
  path.join(stagingLinkedin, 'src')
);

const zip1 = path.join(workspaceRoot, 'AutoApplyCV-LinkedIn-Copilot-v2.6.0-ChromeStore.zip');
const zip2 = path.join(workspaceRoot, 'CareerPilotLinkedInExtension.zip');
const zip3 = path.join(workspaceRoot, 'AutoApplyCV-Copilot-v2.6.0-chrome-store.zip');

[zip1, zip2, zip3].forEach((z) => {
  if (fs.existsSync(z)) fs.unlinkSync(z);
  execSync(`powershell -Command "Compress-Archive -Path '${stagingLinkedin}\\*' -DestinationPath '${z}' -CompressionLevel Optimal"`);
  const stats = fs.statSync(z);
  console.log(`✓ Created: ${path.basename(z)} (${(stats.size / 1024).toFixed(1)} KB)`);
});

fs.rmSync(stagingLinkedin, { recursive: true, force: true });

// 2. Package HR Outreach Extension
console.log('\nPackaging HR Direct Outreach Extension...');
const stagingHR = path.join(workspaceRoot, '.ext_staging_hroutreach');
if (fs.existsSync(stagingHR)) {
  fs.rmSync(stagingHR, { recursive: true, force: true });
}
fs.mkdirSync(stagingHR, { recursive: true });

fs.copyFileSync(
  path.join(workspaceRoot, 'HROutreachExtension', 'manifest.json'),
  path.join(stagingHR, 'manifest.json')
);
copyDirRecursive(
  path.join(workspaceRoot, 'HROutreachExtension', 'icons'),
  path.join(stagingHR, 'icons')
);
copyDirRecursive(
  path.join(workspaceRoot, 'HROutreachExtension', 'popup'),
  path.join(stagingHR, 'popup')
);
copyDirRecursive(
  path.join(workspaceRoot, 'HROutreachExtension', 'src'),
  path.join(stagingHR, 'src')
);

const zipHR1 = path.join(workspaceRoot, 'AutoApplyCV-HROutreach-v1.1.0-ChromeStore.zip');
const zipHR2 = path.join(workspaceRoot, 'HROutreachExtension.zip');

[zipHR1, zipHR2].forEach((z) => {
  if (fs.existsSync(z)) fs.unlinkSync(z);
  execSync(`powershell -Command "Compress-Archive -Path '${stagingHR}\\*' -DestinationPath '${z}' -CompressionLevel Optimal"`);
  const stats = fs.statSync(z);
  console.log(`✓ Created: ${path.basename(z)} (${(stats.size / 1024).toFixed(1)} KB)`);
});

fs.rmSync(stagingHR, { recursive: true, force: true });
console.log('\nAll Chrome Web Store zip packages ready!');

