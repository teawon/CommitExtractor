const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "..", "public", "manifest.json");
const packagePath = path.join(__dirname, "..", "package.json");

const manifest = require(manifestPath);
const package = require(packagePath);

manifest.version = package.version;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`Updated manifest.json version to ${package.version}`);
