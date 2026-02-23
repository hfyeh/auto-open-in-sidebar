import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

if (!targetVersion) {
  throw new Error("Missing version number");
}

const manifestPath = "manifest.json";
const versionsPath = "versions.json";

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const versions = JSON.parse(readFileSync(versionsPath, "utf8"));

manifest.version = targetVersion;
versions[targetVersion] = manifest.minAppVersion;

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
writeFileSync(versionsPath, JSON.stringify(versions, null, 2));
