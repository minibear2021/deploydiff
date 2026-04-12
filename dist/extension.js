"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode15 = __toESM(require("vscode"));

// src/commands/applyDiffHunk.ts
var vscode7 = __toESM(require("vscode"));

// src/config/deploymentConfiguration.ts
var path3 = __toESM(require("node:path"));
var vscode5 = __toESM(require("vscode"));

// src/deployment/mapping.ts
var path = __toESM(require("node:path"));
function resolveMappingForFile(localFilePath, workspaceFolder, mappings) {
  const normalizedFilePath = path.normalize(localFilePath);
  const matchingMapping = [...mappings].sort((left, right) => right.localRoot.length - left.localRoot.length).find((mapping) => {
    const normalizedRoot = ensureTrailingSeparator(path.normalize(mapping.localRoot));
    return normalizedFilePath.startsWith(normalizedRoot) || normalizedFilePath === path.normalize(mapping.localRoot);
  });
  if (!matchingMapping) {
    throw new Error(
      "No deployment mapping matched this file. Add deploydiff.mappings in workspace settings first."
    );
  }
  const relativePath = path.relative(matchingMapping.localRoot, normalizedFilePath);
  const remoteFilePath = toRemoteFilePath(matchingMapping, normalizedFilePath);
  return {
    workspaceFolder,
    mapping: matchingMapping,
    localFilePath: normalizedFilePath,
    relativePath,
    remoteFilePath
  };
}
function toRemoteFilePath(mapping, localFilePath) {
  const relativePath = path.relative(mapping.localRoot, path.normalize(localFilePath));
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`The selected file is outside the mapping root ${mapping.localRoot}.`);
  }
  return joinRemotePath(mapping.remoteRoot, relativePath);
}
function ensureTrailingSeparator(inputPath) {
  return inputPath.endsWith(path.sep) ? inputPath : `${inputPath}${path.sep}`;
}
function joinRemotePath(remoteRoot, relativePath) {
  const remoteSegments = relativePath.split(path.sep).filter(Boolean);
  const sanitizedRoot = remoteRoot.replace(/\/+$/, "");
  return [sanitizedRoot, ...remoteSegments].join("/");
}

// src/diff/remoteDiffDocumentProvider.ts
var vscode4 = __toESM(require("vscode"));

// src/errors/DeployDiffError.ts
var DeployDiffError = class extends Error {
  constructor(message, actions = []) {
    super(message);
    this.actions = actions;
    this.name = "DeployDiffError";
  }
};
function isDeployDiffError(error) {
  return error instanceof DeployDiffError;
}

// src/remote/RemoteFileProvider.ts
var vscode3 = __toESM(require("vscode"));

// src/remote/MockRemoteFileProvider.ts
var vscode = __toESM(require("vscode"));
var MockRemoteFileProvider = class {
  constructor(workspaceFolder) {
    this.workspaceFolder = workspaceFolder;
  }
  exists(remotePath) {
    return Promise.resolve(this.getRemoteFiles()[remotePath] !== void 0);
  }
  stat(remotePath) {
    const content = this.getRemoteFiles()[remotePath];
    if (content === void 0) {
      return Promise.reject(
        new Error(`Mock remote file not found for ${remotePath}. Add deploydiff.mockRemoteFiles in workspace settings.`)
      );
    }
    return Promise.resolve({
      size: Buffer.byteLength(content, "utf8")
    });
  }
  readFile(remotePath) {
    const files = this.getRemoteFiles();
    const content = files[remotePath];
    if (content === void 0) {
      return Promise.reject(new Error(
        `Mock remote file not found for ${remotePath}. Add deploydiff.mockRemoteFiles in workspace settings.`
      ));
    }
    return Promise.resolve(content);
  }
  async writeFile(remotePath, content) {
    const files = this.getRemoteFiles();
    files[remotePath] = content;
    const configuration = vscode.workspace.getConfiguration("deploydiff", this.workspaceFolder.uri);
    await configuration.update("mockRemoteFiles", files, vscode.ConfigurationTarget.WorkspaceFolder);
  }
  getRemoteFiles() {
    const configuration = vscode.workspace.getConfiguration("deploydiff", this.workspaceFolder.uri);
    return {
      ...configuration.get("mockRemoteFiles", {})
    };
  }
};

// src/remote/SftpRemoteFileProvider.ts
var import_ssh2_sftp_client = __toESM(require("ssh2-sftp-client"));
var SftpRemoteFileProvider = class {
  constructor(options) {
    this.options = options;
  }
  async exists(remotePath) {
    return this.withClient(async (client) => Boolean(await client.exists(remotePath)));
  }
  async stat(remotePath) {
    return this.withClient(async (client) => {
      const stats = await client.stat(remotePath);
      return {
        size: stats.size,
        modifiedAt: typeof stats.modifyTime === "number" ? new Date(stats.modifyTime) : void 0
      };
    });
  }
  async readFile(remotePath) {
    return this.withClient(async (client) => {
      const content = await client.get(remotePath);
      if (typeof content === "string") {
        return content;
      }
      if (Buffer.isBuffer(content)) {
        return content.toString("utf8");
      }
      throw new Error(`DeployDiff SFTP returned an unsupported payload type for ${remotePath}.`);
    });
  }
  async writeFile(remotePath, content) {
    await this.withClient(async (client) => {
      const parentDirectory = getRemoteParentDirectory(remotePath);
      if (parentDirectory !== "/") {
        const parentExists = await client.exists(parentDirectory);
        if (!parentExists) {
          await client.mkdir(parentDirectory, true);
        }
      }
      await client.put(Buffer.from(content, "utf8"), remotePath);
    });
  }
  async withClient(operation) {
    const client = new import_ssh2_sftp_client.default("DeployDiff");
    try {
      await client.connect(this.options);
      return await operation(client);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown SFTP error.";
      throw new Error(`DeployDiff SFTP operation failed: ${message}`);
    } finally {
      await client.end().catch(() => void 0);
    }
  }
};
function getRemoteParentDirectory(remotePath) {
  const normalizedPath = remotePath.replace(/\/+/g, "/");
  const lastSlashIndex = normalizedPath.lastIndexOf("/");
  if (lastSlashIndex <= 0) {
    return "/";
  }
  return normalizedPath.slice(0, lastSlashIndex) || "/";
}

// src/remote/sftpConfiguration.ts
var import_promises = require("node:fs/promises");
var path2 = __toESM(require("node:path"));
var vscode2 = __toESM(require("vscode"));
var DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY = "deploydiff.sftp.password";
async function getSftpConnectionOptions(workspaceFolder, secrets) {
  const configuration = vscode2.workspace.getConfiguration("deploydiff", workspaceFolder.uri);
  const host = configuration.get("sftp.host", "").trim();
  const port = configuration.get("sftp.port", 22);
  const username = configuration.get("sftp.username", "").trim();
  const privateKeyPath = configuration.get("sftp.privateKeyPath", "").trim();
  const password = await secrets.get(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY);
  if (!host) {
    throw new DeployDiffError("DeployDiff SFTP host is not configured. Add deploydiff.sftp.host in workspace settings.", [
      {
        label: "Open Workspace Settings",
        commandId: "workbench.action.openWorkspaceSettingsFile"
      }
    ]);
  }
  if (!username) {
    throw new DeployDiffError(
      "DeployDiff SFTP username is not configured. Add deploydiff.sftp.username in workspace settings.",
      [
        {
          label: "Open Workspace Settings",
          commandId: "workbench.action.openWorkspaceSettingsFile"
        }
      ]
    );
  }
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("DeployDiff SFTP port must be a positive integer.");
  }
  const baseOptions = {
    host,
    port,
    username,
    readyTimeout: 1e4
  };
  if (privateKeyPath) {
    const resolvedPrivateKeyPath = path2.isAbsolute(privateKeyPath) ? privateKeyPath : path2.resolve(workspaceFolder.uri.fsPath, privateKeyPath);
    return {
      ...baseOptions,
      privateKey: await (0, import_promises.readFile)(resolvedPrivateKeyPath, "utf8")
    };
  }
  if (password) {
    return {
      ...baseOptions,
      password
    };
  }
  throw new DeployDiffError(
    "DeployDiff SFTP authentication is not configured. Set a password with DeployDiff or configure deploydiff.sftp.privateKeyPath.",
    [
      {
        label: "Set SFTP Password",
        commandId: "deploydiff.setSftpPassword"
      },
      {
        label: "Open Workspace Settings",
        commandId: "workbench.action.openWorkspaceSettingsFile"
      }
    ]
  );
}

// src/remote/RemoteFileProvider.ts
async function createRemoteFileProvider(workspaceFolder, secrets) {
  const configuration = vscode3.workspace.getConfiguration("deploydiff", workspaceFolder.uri);
  const transport = configuration.get("transport", "mock");
  switch (transport) {
    case "mock":
      return new MockRemoteFileProvider(workspaceFolder);
    case "sftp":
      return new SftpRemoteFileProvider(await getSftpConnectionOptions(workspaceFolder, secrets));
    default:
      throw new Error(`Unsupported DeployDiff transport: ${transport}`);
  }
}

// src/diff/remoteDiffDocumentProvider.ts
var DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME = "deploydiff-remote";
function isRemoteDocumentUri(uri) {
  return uri.scheme === DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME;
}
function createRemoteDocumentUri(localFileUri) {
  return vscode4.Uri.from({
    scheme: DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
    path: localFileUri.path,
    query: encodeURIComponent(localFileUri.toString())
  });
}
function getLocalFileUriFromRemoteDocumentUri(remoteUri) {
  if (!isRemoteDocumentUri(remoteUri)) {
    throw new Error("The provided URI is not a DeployDiff remote document.");
  }
  const localUri = decodeURIComponent(remoteUri.query);
  return vscode4.Uri.parse(localUri);
}
var RemoteDiffDocumentProvider = class {
  constructor(secrets) {
    this.secrets = secrets;
  }
  didChangeFileEmitter = new vscode4.EventEmitter();
  cache = /* @__PURE__ */ new Map();
  metadataCache = /* @__PURE__ */ new Map();
  onDidChangeFile = this.didChangeFileEmitter.event;
  watch() {
    return new vscode4.Disposable(() => void 0);
  }
  async stat(uri) {
    const metadata = await this.loadRemoteState(uri);
    return {
      type: vscode4.FileType.File,
      ctime: 0,
      mtime: metadata.modifiedAt?.getTime() ?? Date.now(),
      size: metadata.size
    };
  }
  async readFile(uri) {
    const cached = this.cache.get(uri.toString());
    if (cached !== void 0) {
      return Buffer.from(cached, "utf8");
    }
    await this.loadRemoteState(uri);
    return Buffer.from(this.cache.get(uri.toString()) ?? "", "utf8");
  }
  async writeFile(uri, content) {
    const localFileUri = getLocalFileUriFromRemoteDocumentUri(uri);
    const target = resolveDeploymentTarget(localFileUri);
    const provider = await createRemoteFileProvider(target.workspaceFolder, this.secrets);
    const nextContent = Buffer.from(content).toString("utf8");
    await provider.writeFile(target.remoteFilePath, nextContent);
    const metadata = await provider.stat(target.remoteFilePath);
    this.cache.set(uri.toString(), nextContent);
    this.metadataCache.set(uri.toString(), metadata);
    this.didChangeFileEmitter.fire([{ type: vscode4.FileChangeType.Changed, uri }]);
  }
  readDirectory() {
    return [];
  }
  createDirectory() {
    throw vscode4.FileSystemError.NoPermissions("DeployDiff remote documents do not support directory creation here.");
  }
  delete() {
    throw vscode4.FileSystemError.NoPermissions("DeployDiff remote documents do not support delete from the editor.");
  }
  rename() {
    throw vscode4.FileSystemError.NoPermissions("DeployDiff remote documents do not support rename from the editor.");
  }
  async preload(localFileUri) {
    const remoteUri = createRemoteDocumentUri(localFileUri);
    return this.loadRemoteState(remoteUri);
  }
  refresh(localFileUri) {
    const remoteUri = createRemoteDocumentUri(localFileUri);
    this.cache.delete(remoteUri.toString());
    this.metadataCache.delete(remoteUri.toString());
    this.didChangeFileEmitter.fire([{ type: vscode4.FileChangeType.Changed, uri: remoteUri }]);
  }
  dispose() {
    this.cache.clear();
    this.metadataCache.clear();
    this.didChangeFileEmitter.dispose();
  }
  getCachedMetadata(localFileUri) {
    return this.metadataCache.get(createRemoteDocumentUri(localFileUri).toString());
  }
  getCachedContent(localFileUri) {
    return this.cache.get(createRemoteDocumentUri(localFileUri).toString());
  }
  async loadRemoteState(uri) {
    const localFileUri = getLocalFileUriFromRemoteDocumentUri(uri);
    const target = resolveDeploymentTarget(localFileUri);
    const provider = await createRemoteFileProvider(target.workspaceFolder, this.secrets);
    if (!await provider.exists(target.remoteFilePath)) {
      throw new DeployDiffError(
        `No deployed file exists at ${target.remoteFilePath}. Upload the local file first to create it.`,
        [
          {
            label: "Upload to Remote",
            commandId: "deploydiff.uploadToRemote",
            arguments: [localFileUri]
          }
        ]
      );
    }
    const metadata = await provider.stat(target.remoteFilePath);
    const content = await provider.readFile(target.remoteFilePath);
    this.cache.set(uri.toString(), content);
    this.metadataCache.set(uri.toString(), metadata);
    return metadata;
  }
};

// src/config/deploymentConfiguration.ts
function parseDeploymentMapping(workspaceFolder, mapping, index) {
  const name = mapping.name?.trim();
  const localPath = mapping.localPath?.trim();
  const remotePath = mapping.remotePath?.trim();
  const label = name || `mapping #${index + 1}`;
  if (!name) {
    throw new Error(`DeployDiff ${label} must define a non-empty name.`);
  }
  if (!localPath) {
    throw new Error(`DeployDiff ${label} must define a non-empty localPath.`);
  }
  if (!remotePath) {
    throw new Error(`DeployDiff ${label} must define a non-empty remotePath.`);
  }
  if (!remotePath.startsWith("/")) {
    throw new Error(`DeployDiff ${label} remotePath must be an absolute POSIX path.`);
  }
  return {
    name,
    localRoot: path3.resolve(workspaceFolder.uri.fsPath, localPath),
    remoteRoot: remotePath.replace(/\/+$/, "") || "/"
  };
}
function getOrResolveResourceUri(resource) {
  if (resource?.scheme === "file") {
    return resource;
  }
  if (resource && isRemoteDocumentUri(resource)) {
    return getLocalFileUriFromRemoteDocumentUri(resource);
  }
  const activeUri = vscode5.window.activeTextEditor?.document.uri;
  if (activeUri?.scheme === "file") {
    return activeUri;
  }
  if (activeUri && isRemoteDocumentUri(activeUri)) {
    return getLocalFileUriFromRemoteDocumentUri(activeUri);
  }
  throw new Error("Select a local file in the explorer or open one in the editor first.");
}
function getDeploymentMappings(workspaceFolder) {
  const configuration = vscode5.workspace.getConfiguration("deploydiff", workspaceFolder.uri);
  const mappings = configuration.get("mappings", []);
  return mappings.map((mapping, index) => parseDeploymentMapping(workspaceFolder, mapping, index));
}
function resolveDeploymentTarget(localFileUri) {
  const workspaceFolder = vscode5.workspace.getWorkspaceFolder(localFileUri);
  if (!workspaceFolder) {
    throw new Error("The selected file is not inside an open workspace folder.");
  }
  const mappings = getDeploymentMappings(workspaceFolder);
  return resolveMappingForFile(localFileUri.fsPath, workspaceFolder, mappings);
}

// node_modules/diff/libesm/diff/base.js
var Diff = class {
  diff(oldStr, newStr, options = {}) {
    let callback;
    if (typeof options === "function") {
      callback = options;
      options = {};
    } else if ("callback" in options) {
      callback = options.callback;
    }
    const oldString = this.castInput(oldStr, options);
    const newString = this.castInput(newStr, options);
    const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
    const newTokens = this.removeEmpty(this.tokenize(newString, options));
    return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
  }
  diffWithOptionsObj(oldTokens, newTokens, options, callback) {
    var _a;
    const done = (value) => {
      value = this.postProcess(value, options);
      if (callback) {
        setTimeout(function() {
          callback(value);
        }, 0);
        return void 0;
      } else {
        return value;
      }
    };
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let editLength = 1;
    let maxEditLength = newLen + oldLen;
    if (options.maxEditLength != null) {
      maxEditLength = Math.min(maxEditLength, options.maxEditLength);
    }
    const maxExecutionTime = (_a = options.timeout) !== null && _a !== void 0 ? _a : Infinity;
    const abortAfterTimestamp = Date.now() + maxExecutionTime;
    const bestPath = [{ oldPos: -1, lastComponent: void 0 }];
    let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
    if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
      return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
    }
    let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
    const execEditLength = () => {
      for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
        let basePath;
        const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
        if (removePath) {
          bestPath[diagonalPath - 1] = void 0;
        }
        let canAdd = false;
        if (addPath) {
          const addPathNewPos = addPath.oldPos - diagonalPath;
          canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
        }
        const canRemove = removePath && removePath.oldPos + 1 < oldLen;
        if (!canAdd && !canRemove) {
          bestPath[diagonalPath] = void 0;
          continue;
        }
        if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) {
          basePath = this.addToPath(addPath, true, false, 0, options);
        } else {
          basePath = this.addToPath(removePath, false, true, 1, options);
        }
        newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
        if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
          return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
        } else {
          bestPath[diagonalPath] = basePath;
          if (basePath.oldPos + 1 >= oldLen) {
            maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
          }
          if (newPos + 1 >= newLen) {
            minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
          }
        }
      }
      editLength++;
    };
    if (callback) {
      (function exec() {
        setTimeout(function() {
          if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
            return callback(void 0);
          }
          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
        const ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }
  }
  addToPath(path4, added, removed, oldPosInc, options) {
    const last = path4.lastComponent;
    if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) {
      return {
        oldPos: path4.oldPos + oldPosInc,
        lastComponent: { count: last.count + 1, added, removed, previousComponent: last.previousComponent }
      };
    } else {
      return {
        oldPos: path4.oldPos + oldPosInc,
        lastComponent: { count: 1, added, removed, previousComponent: last }
      };
    }
  }
  extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
      newPos++;
      oldPos++;
      commonCount++;
      if (options.oneChangePerToken) {
        basePath.lastComponent = { count: 1, previousComponent: basePath.lastComponent, added: false, removed: false };
      }
    }
    if (commonCount && !options.oneChangePerToken) {
      basePath.lastComponent = { count: commonCount, previousComponent: basePath.lastComponent, added: false, removed: false };
    }
    basePath.oldPos = oldPos;
    return newPos;
  }
  equals(left, right, options) {
    if (options.comparator) {
      return options.comparator(left, right);
    } else {
      return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
    }
  }
  removeEmpty(array) {
    const ret = [];
    for (let i = 0; i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }
    return ret;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  castInput(value, options) {
    return value;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tokenize(value, options) {
    return Array.from(value);
  }
  join(chars) {
    return chars.join("");
  }
  postProcess(changeObjects, options) {
    return changeObjects;
  }
  get useLongestToken() {
    return false;
  }
  buildValues(lastComponent, newTokens, oldTokens) {
    const components = [];
    let nextComponent;
    while (lastComponent) {
      components.push(lastComponent);
      nextComponent = lastComponent.previousComponent;
      delete lastComponent.previousComponent;
      lastComponent = nextComponent;
    }
    components.reverse();
    const componentLen = components.length;
    let componentPos = 0, newPos = 0, oldPos = 0;
    for (; componentPos < componentLen; componentPos++) {
      const component = components[componentPos];
      if (!component.removed) {
        if (!component.added && this.useLongestToken) {
          let value = newTokens.slice(newPos, newPos + component.count);
          value = value.map(function(value2, i) {
            const oldValue = oldTokens[oldPos + i];
            return oldValue.length > value2.length ? oldValue : value2;
          });
          component.value = this.join(value);
        } else {
          component.value = this.join(newTokens.slice(newPos, newPos + component.count));
        }
        newPos += component.count;
        if (!component.added) {
          oldPos += component.count;
        }
      } else {
        component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
        oldPos += component.count;
      }
    }
    return components;
  }
};

// node_modules/diff/libesm/diff/line.js
var LineDiff = class extends Diff {
  constructor() {
    super(...arguments);
    this.tokenize = tokenize;
  }
  equals(left, right, options) {
    if (options.ignoreWhitespace) {
      if (!options.newlineIsToken || !left.includes("\n")) {
        left = left.trim();
      }
      if (!options.newlineIsToken || !right.includes("\n")) {
        right = right.trim();
      }
    } else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
      if (left.endsWith("\n")) {
        left = left.slice(0, -1);
      }
      if (right.endsWith("\n")) {
        right = right.slice(0, -1);
      }
    }
    return super.equals(left, right, options);
  }
};
var lineDiff = new LineDiff();
function diffLines(oldStr, newStr, options) {
  return lineDiff.diff(oldStr, newStr, options);
}
function tokenize(value, options) {
  if (options.stripTrailingCr) {
    value = value.replace(/\r\n/g, "\n");
  }
  const retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop();
  }
  for (let i = 0; i < linesAndNewlines.length; i++) {
    const line = linesAndNewlines[i];
    if (i % 2 && !options.newlineIsToken) {
      retLines[retLines.length - 1] += line;
    } else {
      retLines.push(line);
    }
  }
  return retLines;
}

// src/diff/hunks.ts
function computeDiffHunks(localText, remoteText) {
  const changes = diffLines(localText, remoteText);
  const hunks = [];
  let localLine = 0;
  let remoteLine = 0;
  let currentHunk;
  for (const change of changes) {
    const lineCount = countLines(change.value);
    if (!change.added && !change.removed) {
      if (currentHunk) {
        hunks.push(currentHunk);
        currentHunk = void 0;
      }
      localLine += lineCount;
      remoteLine += lineCount;
      continue;
    }
    if (!currentHunk) {
      currentHunk = {
        localStartLine: localLine,
        localEndLine: localLine,
        remoteStartLine: remoteLine,
        remoteEndLine: remoteLine
      };
    }
    if (change.removed) {
      localLine += lineCount;
      currentHunk.localEndLine = localLine;
      continue;
    }
    remoteLine += lineCount;
    currentHunk.remoteEndLine = remoteLine;
  }
  if (currentHunk) {
    hunks.push(currentHunk);
  }
  return hunks;
}
function replaceLinesInText(text, startLine, endLine, replacement) {
  const offsets = getLineStartOffsets(text);
  const startOffset = getOffsetForLine(offsets, text, startLine);
  const endOffset = getOffsetForLine(offsets, text, endLine);
  return `${text.slice(0, startOffset)}${replacement}${text.slice(endOffset)}`;
}
function extractLines(text, startLine, endLine) {
  const offsets = getLineStartOffsets(text);
  const startOffset = getOffsetForLine(offsets, text, startLine);
  const endOffset = getOffsetForLine(offsets, text, endLine);
  return text.slice(startOffset, endOffset);
}
function countLines(value) {
  if (value.length === 0) {
    return 0;
  }
  const matches = value.match(/\r\n|\r|\n/g);
  const newlineCount = matches?.length ?? 0;
  return value.endsWith("\n") || value.endsWith("\r") ? newlineCount : newlineCount + 1;
}
function getLineStartOffsets(text) {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\n") {
      offsets.push(index + 1);
      continue;
    }
    if (character === "\r") {
      if (text[index + 1] === "\n") {
        offsets.push(index + 2);
        index += 1;
      } else {
        offsets.push(index + 1);
      }
    }
  }
  return offsets;
}
function getOffsetForLine(offsets, text, line) {
  if (line <= 0) {
    return 0;
  }
  if (line >= offsets.length) {
    return text.length;
  }
  return offsets[line];
}

// src/commands/runDeployCommand.ts
var vscode6 = __toESM(require("vscode"));
function registerDeployCommand(commandId, handler) {
  return vscode6.commands.registerCommand(commandId, async (resource) => {
    try {
      await handler(resource);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown DeployDiff error.";
      if (isDeployDiffError(error) && error.actions.length > 0) {
        const actionLabels = error.actions.map((action) => action.label);
        const selectedActionLabel = await vscode6.window.showErrorMessage(message, ...actionLabels);
        const selectedAction = error.actions.find((action) => action.label === selectedActionLabel);
        if (selectedAction) {
          await vscode6.commands.executeCommand(selectedAction.commandId, ...selectedAction.arguments ?? []);
        }
        return;
      }
      await vscode6.window.showErrorMessage(message);
    }
  });
}

// src/commands/applyDiffHunk.ts
function registerApplyHunkToRemoteCommand(context, remoteDiffDocumentProvider) {
  return registerDeployCommand("deploydiff.applyHunkToRemote", async (resource) => {
    const argumentsPayload = await resolveHunkArguments(resource, remoteDiffDocumentProvider);
    const localFileUri = vscode7.Uri.parse(argumentsPayload.localFileUri);
    const target = resolveDeploymentTarget(localFileUri);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets);
    const localBytes = await vscode7.workspace.fs.readFile(localFileUri);
    const localText = Buffer.from(localBytes).toString("utf8");
    const remoteText = await provider.readFile(target.remoteFilePath);
    const replacement = extractLines(localText, argumentsPayload.hunk.localStartLine, argumentsPayload.hunk.localEndLine);
    const nextRemoteText = replaceLinesInText(
      remoteText,
      argumentsPayload.hunk.remoteStartLine,
      argumentsPayload.hunk.remoteEndLine,
      replacement
    );
    await provider.writeFile(target.remoteFilePath, nextRemoteText);
    remoteDiffDocumentProvider.refresh(localFileUri);
  });
}
function registerApplyHunkToLocalCommand(context, remoteDiffDocumentProvider) {
  return registerDeployCommand("deploydiff.applyHunkToLocal", async (resource) => {
    const argumentsPayload = await resolveHunkArguments(resource, remoteDiffDocumentProvider);
    const localFileUri = vscode7.Uri.parse(argumentsPayload.localFileUri);
    const target = resolveDeploymentTarget(localFileUri);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets);
    const localBytes = await vscode7.workspace.fs.readFile(localFileUri);
    const localText = Buffer.from(localBytes).toString("utf8");
    const remoteText = await provider.readFile(target.remoteFilePath);
    const replacement = extractLines(remoteText, argumentsPayload.hunk.remoteStartLine, argumentsPayload.hunk.remoteEndLine);
    const nextLocalText = replaceLinesInText(
      localText,
      argumentsPayload.hunk.localStartLine,
      argumentsPayload.hunk.localEndLine,
      replacement
    );
    await vscode7.workspace.fs.writeFile(localFileUri, Buffer.from(nextLocalText, "utf8"));
    remoteDiffDocumentProvider.refresh(localFileUri);
  });
}
async function resolveHunkArguments(resource, remoteDiffDocumentProvider) {
  const candidate = resource;
  if (candidate?.localFileUri && candidate.hunk) {
    return candidate;
  }
  const activeEditor = vscode7.window.activeTextEditor;
  if (!activeEditor) {
    throw new Error("Open a diff editor and place the cursor inside a changed block first.");
  }
  const localFileUri = getOrResolveResourceUri(resource ?? activeEditor.document.uri);
  await remoteDiffDocumentProvider.preload(localFileUri);
  const remoteText = remoteDiffDocumentProvider.getCachedContent(localFileUri);
  if (remoteText === void 0) {
    throw new Error("The deployed diff content is not loaded yet. Open Compare with Deployed Version first.");
  }
  const localBytes = await vscode7.workspace.fs.readFile(localFileUri);
  const localText = Buffer.from(localBytes).toString("utf8");
  const hunks = computeDiffHunks(localText, remoteText);
  const activeLine = activeEditor.selection.active.line;
  const isLocalSide = activeEditor.document.uri.scheme === "file";
  const hunk = hunks.find(
    (item) => isLineInsideHunk(
      activeLine,
      isLocalSide ? item.localStartLine : item.remoteStartLine,
      isLocalSide ? item.localEndLine : item.remoteEndLine
    )
  );
  if (!hunk) {
    throw new Error("Place the cursor inside a changed block in the diff editor first.");
  }
  return {
    localFileUri: localFileUri.toString(),
    hunk
  };
}
function isLineInsideHunk(line, startLine, endLine) {
  if (startLine === endLine) {
    return line === startLine;
  }
  return line >= startLine && line < endLine;
}

// src/diff/openDeployedDiff.ts
var vscode8 = __toESM(require("vscode"));
async function openDeployedDiff(localFileUri, remoteDiffDocumentProvider) {
  await remoteDiffDocumentProvider.preload(localFileUri);
  const localDocument = await vscode8.workspace.openTextDocument(localFileUri);
  const remoteDocument = await vscode8.workspace.openTextDocument(createRemoteDocumentUri(localFileUri));
  const fileName = localFileUri.path.split("/").pop() ?? localFileUri.toString();
  const title = `${fileName} \u2194 ${fileName}`;
  if (remoteDocument.languageId !== localDocument.languageId) {
    await vscode8.languages.setTextDocumentLanguage(remoteDocument, localDocument.languageId);
  }
  await vscode8.commands.executeCommand("vscode.diff", localFileUri, remoteDocument.uri, title, {
    preview: false
  });
}

// src/commands/compareWithDeployed.ts
function registerCompareWithDeployedCommand(remoteDiffDocumentProvider) {
  return registerDeployCommand("deploydiff.compareWithDeployedVersion", async (resource) => {
    const localFileUri = getOrResolveResourceUri(resource);
    await openDeployedDiff(localFileUri, remoteDiffDocumentProvider);
  });
}

// src/commands/downloadFromRemote.ts
var vscode10 = __toESM(require("vscode"));

// src/sync/conflictDetection.ts
var vscode9 = __toESM(require("vscode"));
function detectSyncConflict(direction, localModifiedAt, remoteMetadata) {
  if (!remoteMetadata.modifiedAt) {
    return void 0;
  }
  const localTime = localModifiedAt.getTime();
  const remoteTime = remoteMetadata.modifiedAt.getTime();
  if (direction === "upload" && remoteTime > localTime) {
    return `The deployed file was modified after the local file at ${remoteMetadata.modifiedAt.toISOString()}.`;
  }
  if (direction === "download" && localTime > remoteTime) {
    return `The local file was modified after the deployed file at ${localModifiedAt.toISOString()}.`;
  }
  return void 0;
}
async function confirmSyncConflict(direction, conflictMessage, relativePath) {
  const actionLabel = direction === "upload" ? "Overwrite Remote" : "Overwrite Local";
  const answer = await vscode9.window.showWarningMessage(
    `${conflictMessage} Continue syncing ${relativePath}?`,
    { modal: true },
    actionLabel
  );
  return answer === actionLabel;
}

// src/commands/downloadFromRemote.ts
function registerDownloadFromRemoteCommand(context, remoteDiffDocumentProvider) {
  return registerDeployCommand("deploydiff.downloadFromRemote", async (resource) => {
    const localFileUri = getOrResolveResourceUri(resource);
    const target = resolveDeploymentTarget(localFileUri);
    const configuration = vscode10.workspace.getConfiguration("deploydiff", target.workspaceFolder.uri);
    const confirmSync = configuration.get("confirmSync", true);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets);
    if (confirmSync) {
      const answer = await vscode10.window.showWarningMessage(
        `Replace local file ${target.relativePath} with the deployed version from ${target.mapping.remoteRoot}?`,
        { modal: true },
        "Download"
      );
      if (answer !== "Download") {
        return;
      }
    }
    const localStat = await vscode10.workspace.fs.stat(localFileUri);
    const remoteMetadata = await provider.stat(target.remoteFilePath);
    const conflictMessage = detectSyncConflict("download", new Date(localStat.mtime), remoteMetadata);
    if (conflictMessage && !await confirmSyncConflict("download", conflictMessage, target.relativePath)) {
      return;
    }
    const content = await provider.readFile(target.remoteFilePath);
    await vscode10.workspace.fs.writeFile(localFileUri, Buffer.from(content, "utf8"));
    remoteDiffDocumentProvider.refresh(localFileUri);
    await vscode10.window.showInformationMessage(`Downloaded ${target.remoteFilePath} to ${target.relativePath}.`);
  });
}

// src/commands/manageSftpPassword.ts
var vscode11 = __toESM(require("vscode"));
function registerSetSftpPasswordCommand(context) {
  return registerDeployCommand("deploydiff.setSftpPassword", async () => {
    const password = await vscode11.window.showInputBox({
      title: "Set DeployDiff SFTP Password",
      prompt: "Password is stored in VS Code Secret Storage for this workspace session profile.",
      password: true,
      ignoreFocusOut: true
    });
    if (password === void 0) {
      return;
    }
    await context.secrets.store(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY, password);
    await vscode11.window.showInformationMessage("DeployDiff SFTP password stored in Secret Storage.");
  });
}
function registerClearSftpPasswordCommand(context) {
  return registerDeployCommand("deploydiff.clearSftpPassword", async () => {
    await context.secrets.delete(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY);
    await vscode11.window.showInformationMessage("DeployDiff SFTP password cleared from Secret Storage.");
  });
}

// src/commands/refreshDeployedVersion.ts
function registerRefreshDeployedVersionCommand(remoteDiffDocumentProvider) {
  return registerDeployCommand("deploydiff.refreshDeployedVersion", async (resource) => {
    const localFileUri = getOrResolveResourceUri(resource);
    await remoteDiffDocumentProvider.preload(localFileUri);
    remoteDiffDocumentProvider.refresh(localFileUri);
  });
}

// src/commands/uploadToRemote.ts
var vscode12 = __toESM(require("vscode"));
function registerUploadToRemoteCommand(context, remoteDiffDocumentProvider) {
  return registerDeployCommand("deploydiff.uploadToRemote", async (resource) => {
    const localFileUri = getOrResolveResourceUri(resource);
    const target = resolveDeploymentTarget(localFileUri);
    const configuration = vscode12.workspace.getConfiguration("deploydiff", target.workspaceFolder.uri);
    const confirmSync = configuration.get("confirmSync", true);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets);
    if (confirmSync) {
      const answer = await vscode12.window.showWarningMessage(
        `Upload ${target.relativePath} to ${target.mapping.remoteRoot}?`,
        { modal: true },
        "Upload"
      );
      if (answer !== "Upload") {
        return;
      }
    }
    const localStat = await vscode12.workspace.fs.stat(localFileUri);
    if (await provider.exists(target.remoteFilePath)) {
      const remoteMetadata = await provider.stat(target.remoteFilePath);
      const conflictMessage = detectSyncConflict("upload", new Date(localStat.mtime), remoteMetadata);
      if (conflictMessage && !await confirmSyncConflict("upload", conflictMessage, target.relativePath)) {
        return;
      }
    }
    const contentBytes = await vscode12.workspace.fs.readFile(localFileUri);
    const content = Buffer.from(contentBytes).toString("utf8");
    await provider.writeFile(target.remoteFilePath, content);
    remoteDiffDocumentProvider.refresh(localFileUri);
    await vscode12.window.showInformationMessage(`Uploaded ${target.relativePath} to ${target.remoteFilePath}.`);
  });
}

// src/status/deploymentStatusIndicator.ts
var vscode13 = __toESM(require("vscode"));
var DeploymentStatusIndicator = class {
  constructor(remoteDiffDocumentProvider) {
    this.remoteDiffDocumentProvider = remoteDiffDocumentProvider;
    this.statusBarItem.name = "DeployDiff Target";
    this.statusBarItem.command = "deploydiff.compareWithDeployedVersion";
    this.update();
  }
  statusBarItem = vscode13.window.createStatusBarItem(vscode13.StatusBarAlignment.Left, 100);
  update() {
    const activeUri = vscode13.window.activeTextEditor?.document.uri;
    if (!activeUri || activeUri.scheme !== "file" && !isRemoteDocumentUri(activeUri)) {
      this.statusBarItem.hide();
      return;
    }
    try {
      const localFileUri = getOrResolveResourceUri(activeUri);
      const target = resolveDeploymentTarget(localFileUri);
      const remoteMetadata = this.remoteDiffDocumentProvider.getCachedMetadata(localFileUri);
      const metadataLine = remoteMetadata ? remoteMetadata.modifiedAt ? `Remote modified: ${remoteMetadata.modifiedAt.toISOString()}` : `Remote size: ${remoteMetadata.size} bytes` : "Remote metadata not loaded yet";
      this.statusBarItem.text = `DeployDiff $(arrow-right) ${target.mapping.name}`;
      this.statusBarItem.tooltip = `Remote path: ${target.remoteFilePath}
${metadataLine}`;
      this.statusBarItem.show();
    } catch {
      this.statusBarItem.hide();
    }
  }
  dispose() {
    this.statusBarItem.dispose();
  }
};

// src/status/diffDirectionIndicator.ts
var vscode14 = __toESM(require("vscode"));
var DiffDirectionIndicator = class {
  statusBarItem = vscode14.window.createStatusBarItem(vscode14.StatusBarAlignment.Left, 99);
  disposables = [];
  constructor() {
    this.statusBarItem.name = "DeployDiff Direction";
    this.disposables.push(
      vscode14.window.tabGroups.onDidChangeTabs(() => this.update()),
      vscode14.window.onDidChangeActiveTextEditor(() => this.update())
    );
    this.update();
  }
  update() {
    const diffInput = this.getActiveDiffInput();
    if (!diffInput) {
      this.statusBarItem.hide();
      return;
    }
    const leftIsRemote = isRemoteDocumentUri(diffInput.original);
    const leftRole = leftIsRemote ? "remote" : "local";
    const rightRole = leftIsRemote ? "local" : "remote";
    this.statusBarItem.text = `$(arrow-left) ${leftRole}  |  ${rightRole} $(arrow-right)`;
    this.statusBarItem.tooltip = `Left: ${leftRole}  \u2014  Right: ${rightRole}
Revert Block pushes right \u2192 left (${rightRole} \u2192 ${leftRole})`;
    this.statusBarItem.show();
  }
  getActiveDiffInput() {
    const activeTab = vscode14.window.tabGroups.activeTabGroup.activeTab;
    if (!activeTab || !(activeTab.input instanceof vscode14.TabInputTextDiff)) {
      return void 0;
    }
    const input = activeTab.input;
    if (isRemoteDocumentUri(input.original) || isRemoteDocumentUri(input.modified)) {
      return input;
    }
    return void 0;
  }
  dispose() {
    this.statusBarItem.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
};

// src/extension.ts
function activate(context) {
  const remoteDiffDocumentProvider = new RemoteDiffDocumentProvider(context.secrets);
  const deploymentStatusIndicator = new DeploymentStatusIndicator(remoteDiffDocumentProvider);
  const diffDirectionIndicator = new DiffDirectionIndicator();
  context.subscriptions.push(
    deploymentStatusIndicator,
    diffDirectionIndicator,
    vscode15.window.onDidChangeActiveTextEditor(() => deploymentStatusIndicator.update()),
    vscode15.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("deploydiff")) {
        deploymentStatusIndicator.update();
      }
    }),
    vscode15.workspace.registerFileSystemProvider(
      DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
      remoteDiffDocumentProvider,
      {
        isCaseSensitive: true,
        isReadonly: false
      }
    ),
    registerCompareWithDeployedCommand(remoteDiffDocumentProvider),
    registerUploadToRemoteCommand(context, remoteDiffDocumentProvider),
    registerDownloadFromRemoteCommand(context, remoteDiffDocumentProvider),
    registerApplyHunkToRemoteCommand(context, remoteDiffDocumentProvider),
    registerApplyHunkToLocalCommand(context, remoteDiffDocumentProvider),
    registerRefreshDeployedVersionCommand(remoteDiffDocumentProvider),
    registerSetSftpPasswordCommand(context),
    registerClearSftpPasswordCommand(context)
  );
  return {
    secrets: context.secrets
  };
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
