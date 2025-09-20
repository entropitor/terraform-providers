import { mkdir, rm, writeFile } from "node:fs/promises";

import { $ } from "bun";

const providerName = process.argv[2];
if (!providerName) {
  throw new Error("Please provide a provider name as the first argument");
}
const fullProviderUrl = `registry.terraform.io/entropitor/${providerName}`;
const providerDir = `providers/${providerName}`;

const distDir = `dist`;
const distDocsDir = `dist/docs`;
const terraformTempDir = `${distDir}/temp/schema-${providerName}-tf`;

await mkdir(terraformTempDir, { recursive: true });

await writeFile(
  `${terraformTempDir}/main.tf`,
  `
terraform {
  required_providers {
    provider = {
      source = "${fullProviderUrl}"
    }
  }
}
`,
);

await $`terraform providers schema -json | sed "s/${fullProviderUrl.replaceAll("/", "\\/")}/${providerName}/" > schema.json`.cwd(
  terraformTempDir,
);
// go install github.com/hashicorp/terraform-plugin-docs/cmd/tfplugindocs@latest
await $`tfplugindocs generate --provider-name ${providerName} --providers-schema ${terraformTempDir}/schema.json --rendered-website-dir ${distDocsDir} --provider-dir ${providerDir}`;

await rm(terraformTempDir, { recursive: true, force: true });
