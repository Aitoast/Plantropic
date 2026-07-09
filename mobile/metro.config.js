// const { getDefaultConfig } = require("expo/metro-config");
// const path = require("path");

// const projectRoot = __dirname;                         // .../SCHEDULER/mobile
// const workspaceRoot = path.resolve(projectRoot, "..");  // .../SCHEDULER

// const config = getDefaultConfig(projectRoot);

// // 1) mobile 바깥(core, server 등)까지 Metro가 감시하도록
// config.watchFolders = [workspaceRoot];

// // 2) node_modules 탐색: mobile 먼저 → 없으면 루트
// config.resolver.nodeModulesPaths = [
//   path.resolve(projectRoot, "node_modules"),
//   path.resolve(workspaceRoot, "node_modules"),
// ];

// config.resolver.extraNodeModules = {
//   "@scheduler/core": path.resolve(workspaceRoot, "core"),
// };

// module.exports = config;



// mobile/metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, ".."); // scheduler/

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
module.exports = config;