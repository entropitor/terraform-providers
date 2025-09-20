import { mkdir, writeFile } from "node:fs/promises";

import { $ } from "bun";

const providerName = process.argv[2];
const version = process.argv[3];
if (!providerName || !version) {
  throw new Error(
    "Please provide a provider name as the first argument and version as the second argument",
  );
}

const distDir = "dist";
const releaseDir = `${distDir}/releases/${providerName}/v${version}`;
const versionName = `terraform-provider-${providerName}_${version}`;
const providerExecutableName = `terraform-provider-${providerName}_v${version}`; // Prefixed with a v

await mkdir(releaseDir, { recursive: true });

const osArchCombos = [
  { os: "darwin", arch: "arm64", bun: "darwin-arm64" },
  { os: "darwin", arch: "amd64", bun: "darwin-amd64" },
  { os: "linux", arch: "arm64", bun: "linux-x64" },
  { os: "linux", arch: "amd64", bun: "linux-amd64" },
  { os: "windows", arch: "amd64", bun: "windows-x64" },
];
for (const { os, arch, bun } of osArchCombos) {
  const osArchVersionName = `${versionName}_${os}_${arch}`;

  // 1. build the provider binary
  await $`bun build providers/${providerName}/src/index.ts --compile --outfile ${distDir}/${osArchVersionName}/${providerExecutableName} --minify --target bun-${bun}`;

  // on windows, rename the file to remove the .exe extension
  if (os === "windows") {
    await $`mv ${distDir}/${osArchVersionName}/${providerExecutableName}.exe ${distDir}/${osArchVersionName}/${providerExecutableName}`;
  }

  // 2. zip the provider binary
  await $`zip -jr ${releaseDir}/${osArchVersionName}.zip ${distDir}/${osArchVersionName}/${providerExecutableName}`;
}

// 3. create the manifest file
await writeFile(
  `${releaseDir}/${versionName}_manifest.json`,
  JSON.stringify({
    version: 1,
    metadata: {
      protocol_versions: ["6.0"],
    },
  }),
);

// 4. create the SHA256SUMS file
await $`shasum -a 256 *.zip ${versionName}_manifest.json > ${versionName}_SHA256SUMS`.cwd(
  releaseDir,
);
// 5. sign the SHA256SUMS file
await $`gpg --default-key info@entropitor.com --detach-sign ${versionName}_SHA256SUMS`.cwd(
  releaseDir,
);
