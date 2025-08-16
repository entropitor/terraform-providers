import { parseArgs } from "jsr:@std/cli/parse-args";
import { copy, ensureDir, exists, expandGlob } from "jsr:@std/fs";
import { join } from "jsr:@std/path";

const {
  "releases-dir": releasesDir,
  "registry-dir": registryDir,
  "gpg-armor-file": gpgArmorFileName,
  provider,
} = parseArgs(Deno.args, {
  string: ["releases-dir", "registry-dir", "gpg-armor-file", "provider"],
});

const error = (reason: string) => {
  console.error(`ERROR: ${reason}`);
  process.exit(1);
};

if (
  releasesDir == null ||
  registryDir == null ||
  gpgArmorFileName == null ||
  provider == null
) {
  error(
    "You need to set all of --releases-dir, --registry-dir, --provider and --gpg-armor-file",
  );
}

const { namespace, name } = provider.match(
  /(?<namespace>[a-zA-Z0-9]+)\/(?<name>[a-zA-Z0-9]+)/,
).groups;

if (namespace == null || name == null) {
  error("You need to pass provider as namespace/name");
}

let gpgArmor;
try {
  gpgArmor = await Deno.readTextFile(gpgArmorFileName);
} catch {
  error("Could not read the gpg armor key");
}

const REGEX =
  /terraform-provider-(?<name>[a-zA-Z0-9]+)_(?<version>(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?)_(?<os>[a-zA-Z0-9]+)_(?<arch>[a-zA-Z0-9]+)\.zip/;

type Version = {
  version: string;
  protocols: string[];
  platforms: Array<{ os: string; arch: string }>;
};
type Download = {
  version: string;
  os: string;
  arch: string;
};

const parseShasums = (shasums: string): Record<string, string> => {
  return Object.fromEntries(
    shasums
      .trim()
      .split("\n")
      .map((line) => {
        const [sum, filename] = line.split("  ");
        return [filename, sum];
      }),
  );
};

const VERSIONS: Record<string, Version> = {};
const SHASUMS: Record<string, Record<string, string>> = {};
const DOWNLOADS: Download[] = [];
for await (const entry of expandGlob(
  `${releasesDir}/terraform-provider-${name}_*.zip`,
)) {
  const { version, os, arch } = entry.name.match(REGEX).groups;

  if (VERSIONS[version] == null) {
    const manifest = JSON.parse(
      await Deno.readTextFile(
        join(
          releasesDir,
          `terraform-provider-${name}_${version}_manifest.json`,
        ),
      ),
    );

    try {
      const shasums = await Deno.readTextFile(
        join(releasesDir, `terraform-provider-${name}_${version}_SHA256SUMS`),
      );
      SHASUMS[version] = parseShasums(shasums);
    } catch {
      error("Could not find the SHASUMS file");
    }

    if (
      !(await exists(
        join(
          releasesDir,
          `terraform-provider-${name}_${version}_SHA256SUMS.sig`,
        ),
      ))
    ) {
      error("Could not find the SHASUMS.sig file");
    }

    VERSIONS[version] = {
      version,
      protocols: manifest.metadata.protocol_versions ?? [],
      platforms: [],
    };
  }
  VERSIONS[version].platforms.push({ os, arch });
  DOWNLOADS.push({ os, arch, version });
}

if (Object.keys(VERSIONS).length === 0) {
  error("Did not find any versions");
}

await ensureDir(join(registryDir, ".well-known"));
await Deno.writeTextFile(
  join(registryDir, ".well-known", "terraform.json"),
  JSON.stringify({ "providers.v1": "/v1/providers/" }),
);

const registryProviderDir = join(
  registryDir,
  "v1",
  "providers",
  namespace,
  name,
);
await ensureDir(registryProviderDir);
await Deno.writeTextFile(
  join(registryProviderDir, "versions"),
  JSON.stringify({ versions: Object.values(VERSIONS) }),
);

for (const version of Object.values(VERSIONS)) {
  const versionDir = join(registryProviderDir, version.version);
  await ensureDir(versionDir);
  const SHASUMS = `terraform-provider-${name}_${version.version}_SHA256SUMS`;
  await Promise.all([
    copy(join(releasesDir, SHASUMS), join(versionDir, SHASUMS), {
      overwrite: true,
    }),
    copy(
      join(releasesDir, `${SHASUMS}.sig`),
      join(versionDir, `${SHASUMS}.sig`),
      {
        overwrite: true,
      },
    ),
  ]);
}
for (const download of DOWNLOADS) {
  const downloadDir = join(
    registryProviderDir,
    download.version,
    "download",
    download.os,
  );
  await ensureDir(downloadDir);
  const zipName = `terraform-provider-${name}_${download.version}_${download.os}_${download.arch}.zip`;
  await Deno.writeTextFile(
    join(downloadDir, download.arch),
    JSON.stringify({
      protocols: VERSIONS[download.version]!.protocols,
      os: download.os,
      arch: download.arch,
      filename: zipName,
      download_url: `../../${zipName}`,
      shasums_url: `../../terraform-provider-${name}_${download.version}_SHA256SUMS`,
      shasum: SHASUMS[download.version]![zipName] ?? "",
      shasums_signature_url: `../../terraform-provider-${name}_${download.version}_SHA256SUMS.sig`,
      signing_keys: {
        gpg_public_keys: [{ ascii_armor: gpgArmor }],
      },
    }),
  );
  await copy(
    join(releasesDir, zipName),
    join(registryProviderDir, download.version, zipName),
    { overwrite: true },
  );
}
