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
var vscode13 = __toESM(require("vscode"));

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
  didChangeEmitter = new vscode4.EventEmitter();
  cache = /* @__PURE__ */ new Map();
  metadataCache = /* @__PURE__ */ new Map();
  onDidChange = this.didChangeEmitter.event;
  async provideTextDocumentContent(uri) {
    const cached = this.cache.get(uri.toString());
    if (cached !== void 0) {
      return cached;
    }
    await this.loadRemoteState(uri);
    return this.cache.get(uri.toString()) ?? "";
  }
  async preload(localFileUri) {
    const remoteUri = createRemoteDocumentUri(localFileUri);
    return this.loadRemoteState(remoteUri);
  }
  refresh(localFileUri) {
    const remoteUri = createRemoteDocumentUri(localFileUri);
    this.cache.delete(remoteUri.toString());
    this.metadataCache.delete(remoteUri.toString());
    this.didChangeEmitter.fire(remoteUri);
  }
  dispose() {
    this.cache.clear();
    this.metadataCache.clear();
    this.didChangeEmitter.dispose();
  }
  getCachedMetadata(localFileUri) {
    return this.metadataCache.get(createRemoteDocumentUri(localFileUri).toString());
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

// src/diff/openDeployedDiff.ts
var vscode6 = __toESM(require("vscode"));
async function openDeployedDiff(localFileUri, remoteDiffDocumentProvider) {
  const target = resolveDeploymentTarget(localFileUri);
  const remoteMetadata = await remoteDiffDocumentProvider.preload(localFileUri);
  const localDocument = await vscode6.workspace.openTextDocument(localFileUri);
  const remoteDocument = await vscode6.workspace.openTextDocument(createRemoteDocumentUri(localFileUri));
  if (remoteDocument.languageId !== localDocument.languageId) {
    await vscode6.languages.setTextDocumentLanguage(remoteDocument, localDocument.languageId);
  }
  const metadataSuffix = remoteMetadata.modifiedAt ? ` \u2022 ${remoteMetadata.modifiedAt.toISOString()}` : ` \u2022 ${remoteMetadata.size} bytes`;
  const title = `${target.relativePath} \u2194 ${target.mapping.name}${metadataSuffix}`;
  await vscode6.commands.executeCommand("vscode.diff", localFileUri, remoteDocument.uri, title, {
    preview: false
  });
}

// src/commands/runDeployCommand.ts
var vscode7 = __toESM(require("vscode"));
function registerDeployCommand(commandId, handler) {
  return vscode7.commands.registerCommand(commandId, async (resource) => {
    try {
      await handler(resource);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown DeployDiff error.";
      if (isDeployDiffError(error) && error.actions.length > 0) {
        const actionLabels = error.actions.map((action) => action.label);
        const selectedActionLabel = await vscode7.window.showErrorMessage(message, ...actionLabels);
        const selectedAction = error.actions.find((action) => action.label === selectedActionLabel);
        if (selectedAction) {
          await vscode7.commands.executeCommand(selectedAction.commandId, ...selectedAction.arguments ?? []);
        }
        return;
      }
      await vscode7.window.showErrorMessage(message);
    }
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
var vscode9 = __toESM(require("vscode"));

// src/sync/conflictDetection.ts
var vscode8 = __toESM(require("vscode"));
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
  const answer = await vscode8.window.showWarningMessage(
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
    const configuration = vscode9.workspace.getConfiguration("deploydiff", target.workspaceFolder.uri);
    const confirmSync = configuration.get("confirmSync", true);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets);
    if (confirmSync) {
      const answer = await vscode9.window.showWarningMessage(
        `Replace local file ${target.relativePath} with the deployed version from ${target.mapping.remoteRoot}?`,
        { modal: true },
        "Download"
      );
      if (answer !== "Download") {
        return;
      }
    }
    const localStat = await vscode9.workspace.fs.stat(localFileUri);
    const remoteMetadata = await provider.stat(target.remoteFilePath);
    const conflictMessage = detectSyncConflict("download", new Date(localStat.mtime), remoteMetadata);
    if (conflictMessage && !await confirmSyncConflict("download", conflictMessage, target.relativePath)) {
      return;
    }
    const content = await provider.readFile(target.remoteFilePath);
    await vscode9.workspace.fs.writeFile(localFileUri, Buffer.from(content, "utf8"));
    remoteDiffDocumentProvider.refresh(localFileUri);
    await vscode9.window.showInformationMessage(`Downloaded ${target.remoteFilePath} to ${target.relativePath}.`);
  });
}

// src/commands/manageSftpPassword.ts
var vscode10 = __toESM(require("vscode"));
function registerSetSftpPasswordCommand(context) {
  return registerDeployCommand("deploydiff.setSftpPassword", async () => {
    const password = await vscode10.window.showInputBox({
      title: "Set DeployDiff SFTP Password",
      prompt: "Password is stored in VS Code Secret Storage for this workspace session profile.",
      password: true,
      ignoreFocusOut: true
    });
    if (password === void 0) {
      return;
    }
    await context.secrets.store(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY, password);
    await vscode10.window.showInformationMessage("DeployDiff SFTP password stored in Secret Storage.");
  });
}
function registerClearSftpPasswordCommand(context) {
  return registerDeployCommand("deploydiff.clearSftpPassword", async () => {
    await context.secrets.delete(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY);
    await vscode10.window.showInformationMessage("DeployDiff SFTP password cleared from Secret Storage.");
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
var vscode11 = __toESM(require("vscode"));
function registerUploadToRemoteCommand(context, remoteDiffDocumentProvider) {
  return registerDeployCommand("deploydiff.uploadToRemote", async (resource) => {
    const localFileUri = getOrResolveResourceUri(resource);
    const target = resolveDeploymentTarget(localFileUri);
    const configuration = vscode11.workspace.getConfiguration("deploydiff", target.workspaceFolder.uri);
    const confirmSync = configuration.get("confirmSync", true);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets);
    if (confirmSync) {
      const answer = await vscode11.window.showWarningMessage(
        `Upload ${target.relativePath} to ${target.mapping.remoteRoot}?`,
        { modal: true },
        "Upload"
      );
      if (answer !== "Upload") {
        return;
      }
    }
    const localStat = await vscode11.workspace.fs.stat(localFileUri);
    if (await provider.exists(target.remoteFilePath)) {
      const remoteMetadata = await provider.stat(target.remoteFilePath);
      const conflictMessage = detectSyncConflict("upload", new Date(localStat.mtime), remoteMetadata);
      if (conflictMessage && !await confirmSyncConflict("upload", conflictMessage, target.relativePath)) {
        return;
      }
    }
    const contentBytes = await vscode11.workspace.fs.readFile(localFileUri);
    const content = Buffer.from(contentBytes).toString("utf8");
    await provider.writeFile(target.remoteFilePath, content);
    remoteDiffDocumentProvider.refresh(localFileUri);
    await vscode11.window.showInformationMessage(`Uploaded ${target.relativePath} to ${target.remoteFilePath}.`);
  });
}

// src/status/deploymentStatusIndicator.ts
var vscode12 = __toESM(require("vscode"));
var DeploymentStatusIndicator = class {
  constructor(remoteDiffDocumentProvider) {
    this.remoteDiffDocumentProvider = remoteDiffDocumentProvider;
    this.statusBarItem.name = "DeployDiff Target";
    this.statusBarItem.command = "deploydiff.compareWithDeployedVersion";
    this.update();
  }
  statusBarItem = vscode12.window.createStatusBarItem(vscode12.StatusBarAlignment.Left, 100);
  update() {
    const activeUri = vscode12.window.activeTextEditor?.document.uri;
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

// src/extension.ts
function activate(context) {
  const remoteDiffDocumentProvider = new RemoteDiffDocumentProvider(context.secrets);
  const deploymentStatusIndicator = new DeploymentStatusIndicator(remoteDiffDocumentProvider);
  context.subscriptions.push(
    deploymentStatusIndicator,
    vscode13.window.onDidChangeActiveTextEditor(() => deploymentStatusIndicator.update()),
    vscode13.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("deploydiff")) {
        deploymentStatusIndicator.update();
      }
    }),
    vscode13.workspace.registerTextDocumentContentProvider(
      DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
      remoteDiffDocumentProvider
    ),
    registerCompareWithDeployedCommand(remoteDiffDocumentProvider),
    registerUploadToRemoteCommand(context, remoteDiffDocumentProvider),
    registerDownloadFromRemoteCommand(context, remoteDiffDocumentProvider),
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
