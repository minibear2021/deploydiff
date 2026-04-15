"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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

// node_modules/basic-ftp/dist/parseControlResponse.js
var require_parseControlResponse = __commonJS({
  "node_modules/basic-ftp/dist/parseControlResponse.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseControlResponse = parseControlResponse;
    exports2.isSingleLine = isSingleLine;
    exports2.isMultiline = isMultiline;
    exports2.positiveCompletion = positiveCompletion;
    exports2.positiveIntermediate = positiveIntermediate;
    var LF = "\n";
    function parseControlResponse(text) {
      const lines = text.split(/\r?\n/).filter(isNotBlank);
      const messages = [];
      let startAt = 0;
      let tokenRegex;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!tokenRegex) {
          if (isMultiline(line)) {
            const token = line.substr(0, 3);
            tokenRegex = new RegExp(`^${token}(?:$| )`);
            startAt = i;
          } else if (isSingleLine(line)) {
            messages.push(line);
          }
        } else if (tokenRegex.test(line)) {
          tokenRegex = void 0;
          messages.push(lines.slice(startAt, i + 1).join(LF));
        }
      }
      const rest = tokenRegex ? lines.slice(startAt).join(LF) + LF : "";
      return { messages, rest };
    }
    function isSingleLine(line) {
      return /^\d\d\d(?:$| )/.test(line);
    }
    function isMultiline(line) {
      return /^\d\d\d-/.test(line);
    }
    function positiveCompletion(code) {
      return code >= 200 && code < 300;
    }
    function positiveIntermediate(code) {
      return code >= 300 && code < 400;
    }
    function isNotBlank(str) {
      return str.trim() !== "";
    }
  }
});

// node_modules/basic-ftp/dist/FtpContext.js
var require_FtpContext = __commonJS({
  "node_modules/basic-ftp/dist/FtpContext.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.FTPContext = exports2.FTPError = void 0;
    var net_1 = require("net");
    var parseControlResponse_1 = require_parseControlResponse();
    var FTPError = class extends Error {
      constructor(res) {
        super(res.message);
        this.name = this.constructor.name;
        this.code = res.code;
      }
    };
    exports2.FTPError = FTPError;
    function doNothing() {
    }
    var FTPContext = class {
      /**
       * Instantiate an FTP context.
       *
       * @param timeout - Timeout in milliseconds to apply to control and data connections. Use 0 for no timeout.
       * @param encoding - Encoding to use for control connection. UTF-8 by default. Use "latin1" for older servers.
       */
      constructor(timeout = 0, encoding = "utf8") {
        this.timeout = timeout;
        this.verbose = false;
        this.ipFamily = void 0;
        this.tlsOptions = {};
        this._partialResponse = "";
        this._encoding = encoding;
        this._socket = this.socket = this._newSocket();
        this._dataSocket = void 0;
      }
      /**
       * Close the context.
       */
      close() {
        const message = this._task ? "User closed client during task" : "User closed client";
        const err = new Error(message);
        this.closeWithError(err);
      }
      /**
       * Close the context with an error.
       */
      closeWithError(err) {
        if (this._closingError) {
          return;
        }
        this._closingError = err;
        this._closeControlSocket();
        this._closeSocket(this._dataSocket);
        this._passToHandler(err);
        this._stopTrackingTask();
      }
      /**
       * Returns true if this context has been closed or hasn't been connected yet. You can reopen it with `access`.
       */
      get closed() {
        return this.socket.remoteAddress === void 0 || this._closingError !== void 0;
      }
      /**
       * Reset this contex and all of its state.
       */
      reset() {
        this.socket = this._newSocket();
      }
      /**
       * Get the FTP control socket.
       */
      get socket() {
        return this._socket;
      }
      /**
       * Set the socket for the control connection. This will only close the current control socket
       * if the new one is not an upgrade to the current one.
       */
      set socket(socket) {
        this.dataSocket = void 0;
        this.tlsOptions = {};
        this._partialResponse = "";
        if (this._socket) {
          const newSocketUpgradesExisting = socket.localPort === this._socket.localPort;
          if (newSocketUpgradesExisting) {
            this._removeSocketListeners(this.socket);
          } else {
            this._closeControlSocket();
          }
        }
        if (socket) {
          this._closingError = void 0;
          socket.setTimeout(0);
          socket.setEncoding(this._encoding);
          socket.setKeepAlive(true);
          socket.on("data", (data) => this._onControlSocketData(data));
          socket.on("end", () => this.closeWithError(new Error("Server sent FIN packet unexpectedly, closing connection.")));
          socket.on("close", (hadError) => {
            if (!hadError)
              this.closeWithError(new Error("Server closed connection unexpectedly."));
          });
          this._setupDefaultErrorHandlers(socket, "control socket");
        }
        this._socket = socket;
      }
      /**
       * Get the current FTP data connection if present.
       */
      get dataSocket() {
        return this._dataSocket;
      }
      /**
       * Set the socket for the data connection. This will automatically close the former data socket.
       */
      set dataSocket(socket) {
        this._closeSocket(this._dataSocket);
        if (socket) {
          socket.setTimeout(0);
          this._setupDefaultErrorHandlers(socket, "data socket");
        }
        this._dataSocket = socket;
      }
      /**
       * Get the currently used encoding.
       */
      get encoding() {
        return this._encoding;
      }
      /**
       * Set the encoding used for the control socket.
       *
       * See https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings for what encodings
       * are supported by Node.
       */
      set encoding(encoding) {
        this._encoding = encoding;
        if (this.socket) {
          this.socket.setEncoding(encoding);
        }
      }
      /**
       * Send an FTP command without waiting for or handling the result.
       */
      send(command) {
        if (/[\r\n\0]/.test(command)) {
          throw new Error(`Invalid command: Contains control characters. (${command})`);
        }
        const containsPassword = command.startsWith("PASS");
        const message = containsPassword ? "> PASS ###" : `> ${command}`;
        this.log(message);
        this._socket.write(command + "\r\n", this.encoding);
      }
      /**
       * Send an FTP command and handle the first response. Use this if you have a simple
       * request-response situation.
       */
      request(command) {
        return this.handle(command, (res, task) => {
          if (res instanceof Error) {
            task.reject(res);
          } else {
            task.resolve(res);
          }
        });
      }
      /**
       * Send an FTP command and handle any response until you resolve/reject. Use this if you expect multiple responses
       * to a request. This returns a Promise that will hold whatever the response handler passed on when resolving/rejecting its task.
       */
      handle(command, responseHandler) {
        if (this._task) {
          const err = new Error("User launched a task while another one is still running. Forgot to use 'await' or '.then()'?");
          err.stack += `
Running task launched at: ${this._task.stack}`;
          this.closeWithError(err);
        }
        return new Promise((resolveTask, rejectTask) => {
          this._task = {
            stack: new Error().stack || "Unknown call stack",
            responseHandler,
            resolver: {
              resolve: (arg) => {
                this._stopTrackingTask();
                resolveTask(arg);
              },
              reject: (err) => {
                this._stopTrackingTask();
                rejectTask(err);
              }
            }
          };
          if (this._closingError) {
            const err = new Error(`Client is closed because ${this._closingError.message}`);
            err.stack += `
Closing reason: ${this._closingError.stack}`;
            err.code = this._closingError.code !== void 0 ? this._closingError.code : "0";
            this._passToHandler(err);
            return;
          }
          this.socket.setTimeout(this.timeout);
          if (command) {
            this.send(command);
          }
        });
      }
      /**
       * Log message if set to be verbose.
       */
      log(message) {
        if (this.verbose) {
          console.log(message);
        }
      }
      /**
       * Return true if the control socket is using TLS. This does not mean that a session
       * has already been negotiated.
       */
      get hasTLS() {
        return "encrypted" in this._socket;
      }
      /**
       * Removes reference to current task and handler. This won't resolve or reject the task.
       * @protected
       */
      _stopTrackingTask() {
        this.socket.setTimeout(0);
        this._task = void 0;
      }
      /**
       * Handle incoming data on the control socket. The chunk is going to be of type `string`
       * because we let `socket` handle encoding with `setEncoding`.
       * @protected
       */
      _onControlSocketData(chunk) {
        this.log(`< ${chunk}`);
        const completeResponse = this._partialResponse + chunk;
        const parsed = (0, parseControlResponse_1.parseControlResponse)(completeResponse);
        this._partialResponse = parsed.rest;
        for (const message of parsed.messages) {
          const code = parseInt(message.substr(0, 3), 10);
          const response = { code, message };
          const err = code >= 400 ? new FTPError(response) : void 0;
          this._passToHandler(err ? err : response);
        }
      }
      /**
       * Send the current handler a response. This is usually a control socket response
       * or a socket event, like an error or timeout.
       * @protected
       */
      _passToHandler(response) {
        if (this._task) {
          this._task.responseHandler(response, this._task.resolver);
        }
      }
      /**
       * Setup all error handlers for a socket.
       * @protected
       */
      _setupDefaultErrorHandlers(socket, identifier) {
        socket.once("error", (error) => {
          error.message += ` (${identifier})`;
          this.closeWithError(error);
        });
        socket.once("close", (hadError) => {
          if (hadError) {
            this.closeWithError(new Error(`Socket closed due to transmission error (${identifier})`));
          }
        });
        socket.once("timeout", () => {
          socket.destroy();
          this.closeWithError(new Error(`Timeout (${identifier})`));
        });
      }
      /**
       * Close the control socket. Sends QUIT, then FIN, and ignores any response or error.
       */
      _closeControlSocket() {
        this._removeSocketListeners(this._socket);
        this._socket.on("error", doNothing);
        this.send("QUIT");
        this._closeSocket(this._socket);
      }
      /**
       * Close a socket, ignores any error.
       * @protected
       */
      _closeSocket(socket) {
        if (socket) {
          this._removeSocketListeners(socket);
          socket.on("error", doNothing);
          socket.destroy();
        }
      }
      /**
       * Remove all default listeners for socket.
       * @protected
       */
      _removeSocketListeners(socket) {
        socket.removeAllListeners();
        socket.removeAllListeners("timeout");
        socket.removeAllListeners("data");
        socket.removeAllListeners("end");
        socket.removeAllListeners("error");
        socket.removeAllListeners("close");
        socket.removeAllListeners("connect");
      }
      /**
       * Provide a new socket instance.
       *
       * Internal use only, replaced for unit tests.
       */
      _newSocket() {
        return new net_1.Socket();
      }
    };
    exports2.FTPContext = FTPContext;
  }
});

// node_modules/basic-ftp/dist/FileInfo.js
var require_FileInfo = __commonJS({
  "node_modules/basic-ftp/dist/FileInfo.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.FileInfo = exports2.FileType = void 0;
    var FileType5;
    (function(FileType6) {
      FileType6[FileType6["Unknown"] = 0] = "Unknown";
      FileType6[FileType6["File"] = 1] = "File";
      FileType6[FileType6["Directory"] = 2] = "Directory";
      FileType6[FileType6["SymbolicLink"] = 3] = "SymbolicLink";
    })(FileType5 || (exports2.FileType = FileType5 = {}));
    var FileInfo = class {
      constructor(name) {
        this.name = name;
        this.type = FileType5.Unknown;
        this.size = 0;
        this.rawModifiedAt = "";
        this.modifiedAt = void 0;
        this.permissions = void 0;
        this.hardLinkCount = void 0;
        this.link = void 0;
        this.group = void 0;
        this.user = void 0;
        this.uniqueID = void 0;
        this.name = name;
      }
      get isDirectory() {
        return this.type === FileType5.Directory;
      }
      get isSymbolicLink() {
        return this.type === FileType5.SymbolicLink;
      }
      get isFile() {
        return this.type === FileType5.File;
      }
      /**
       * Deprecated, legacy API. Use `rawModifiedAt` instead.
       * @deprecated
       */
      get date() {
        return this.rawModifiedAt;
      }
      set date(rawModifiedAt) {
        this.rawModifiedAt = rawModifiedAt;
      }
    };
    exports2.FileInfo = FileInfo;
    FileInfo.UnixPermission = {
      Read: 4,
      Write: 2,
      Execute: 1
    };
  }
});

// node_modules/basic-ftp/dist/parseListDOS.js
var require_parseListDOS = __commonJS({
  "node_modules/basic-ftp/dist/parseListDOS.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.testLine = testLine;
    exports2.parseLine = parseLine;
    exports2.transformList = transformList;
    var FileInfo_1 = require_FileInfo();
    var RE_LINE = new RegExp(
      "(\\S+)\\s+(\\S+)\\s+(?:(<DIR>)|([0-9]+))\\s+(\\S.*)"
      // First non-space followed by rest of line (name)
    );
    function testLine(line) {
      return /^\d{2}/.test(line) && RE_LINE.test(line);
    }
    function parseLine(line) {
      const groups = line.match(RE_LINE);
      if (groups === null) {
        return void 0;
      }
      const name = groups[5];
      if (name === "." || name === "..") {
        return void 0;
      }
      const file = new FileInfo_1.FileInfo(name);
      const fileType = groups[3];
      if (fileType === "<DIR>") {
        file.type = FileInfo_1.FileType.Directory;
        file.size = 0;
      } else {
        file.type = FileInfo_1.FileType.File;
        file.size = parseInt(groups[4], 10);
      }
      file.rawModifiedAt = groups[1] + " " + groups[2];
      return file;
    }
    function transformList(files) {
      return files;
    }
  }
});

// node_modules/basic-ftp/dist/parseListUnix.js
var require_parseListUnix = __commonJS({
  "node_modules/basic-ftp/dist/parseListUnix.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.testLine = testLine;
    exports2.parseLine = parseLine;
    exports2.transformList = transformList;
    var FileInfo_1 = require_FileInfo();
    var JA_MONTH = "\u6708";
    var JA_DAY = "\u65E5";
    var JA_YEAR = "\u5E74";
    var RE_LINE = new RegExp("([bcdelfmpSs-])(((r|-)(w|-)([xsStTL-]))((r|-)(w|-)([xsStTL-]))((r|-)(w|-)([xsStTL-]?)))\\+?\\s*(\\d+)\\s+(?:(\\S+(?:\\s\\S+)*?)\\s+)?(?:(\\S+(?:\\s\\S+)*)\\s+)?(\\d+(?:,\\s*\\d+)?)\\s+((?:\\d+[-/]\\d+[-/]\\d+)|(?:\\S{3}\\s+\\d{1,2})|(?:\\d{1,2}\\s+\\S{3})|(?:\\d{1,2}" + JA_MONTH + "\\s+\\d{1,2}" + JA_DAY + "))\\s+((?:\\d+(?::\\d+)?)|(?:\\d{4}" + JA_YEAR + "))\\s(.*)");
    function testLine(line) {
      return RE_LINE.test(line);
    }
    function parseLine(line) {
      const groups = line.match(RE_LINE);
      if (groups === null) {
        return void 0;
      }
      const name = groups[21];
      if (name === "." || name === "..") {
        return void 0;
      }
      const file = new FileInfo_1.FileInfo(name);
      file.size = parseInt(groups[18], 10);
      file.user = groups[16];
      file.group = groups[17];
      file.hardLinkCount = parseInt(groups[15], 10);
      file.rawModifiedAt = groups[19] + " " + groups[20];
      file.permissions = {
        user: parseMode(groups[4], groups[5], groups[6]),
        group: parseMode(groups[8], groups[9], groups[10]),
        world: parseMode(groups[12], groups[13], groups[14])
      };
      switch (groups[1].charAt(0)) {
        case "d":
          file.type = FileInfo_1.FileType.Directory;
          break;
        case "e":
          file.type = FileInfo_1.FileType.SymbolicLink;
          break;
        case "l":
          file.type = FileInfo_1.FileType.SymbolicLink;
          break;
        case "b":
        case "c":
          file.type = FileInfo_1.FileType.File;
          break;
        case "f":
        case "-":
          file.type = FileInfo_1.FileType.File;
          break;
        default:
          file.type = FileInfo_1.FileType.Unknown;
      }
      if (file.isSymbolicLink) {
        const end = name.indexOf(" -> ");
        if (end !== -1) {
          file.name = name.substring(0, end);
          file.link = name.substring(end + 4);
        }
      }
      return file;
    }
    function transformList(files) {
      return files;
    }
    function parseMode(r, w, x) {
      let value = 0;
      if (r !== "-") {
        value += FileInfo_1.FileInfo.UnixPermission.Read;
      }
      if (w !== "-") {
        value += FileInfo_1.FileInfo.UnixPermission.Write;
      }
      const execToken = x.charAt(0);
      if (execToken !== "-" && execToken.toUpperCase() !== execToken) {
        value += FileInfo_1.FileInfo.UnixPermission.Execute;
      }
      return value;
    }
  }
});

// node_modules/basic-ftp/dist/parseListMLSD.js
var require_parseListMLSD = __commonJS({
  "node_modules/basic-ftp/dist/parseListMLSD.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.testLine = testLine;
    exports2.parseLine = parseLine;
    exports2.transformList = transformList;
    exports2.parseMLSxDate = parseMLSxDate;
    var FileInfo_1 = require_FileInfo();
    function parseSize(value, info) {
      info.size = parseInt(value, 10);
    }
    var factHandlersByName = {
      "size": parseSize,
      // File size
      "sizd": parseSize,
      // Directory size
      "unique": (value, info) => {
        info.uniqueID = value;
      },
      "modify": (value, info) => {
        info.modifiedAt = parseMLSxDate(value);
        info.rawModifiedAt = info.modifiedAt.toISOString();
      },
      "type": (value, info) => {
        if (value.startsWith("OS.unix=slink")) {
          info.type = FileInfo_1.FileType.SymbolicLink;
          info.link = value.substr(value.indexOf(":") + 1);
          return 1;
        }
        switch (value) {
          case "file":
            info.type = FileInfo_1.FileType.File;
            break;
          case "dir":
            info.type = FileInfo_1.FileType.Directory;
            break;
          case "OS.unix=symlink":
            info.type = FileInfo_1.FileType.SymbolicLink;
            break;
          case "cdir":
          // Current directory being listed
          case "pdir":
            return 2;
          // Don't include these entries in the listing
          default:
            info.type = FileInfo_1.FileType.Unknown;
        }
        return 1;
      },
      "unix.mode": (value, info) => {
        const digits = value.substr(-3);
        info.permissions = {
          user: parseInt(digits[0], 10),
          group: parseInt(digits[1], 10),
          world: parseInt(digits[2], 10)
        };
      },
      "unix.ownername": (value, info) => {
        info.user = value;
      },
      "unix.owner": (value, info) => {
        if (info.user === void 0)
          info.user = value;
      },
      get "unix.uid"() {
        return this["unix.owner"];
      },
      "unix.groupname": (value, info) => {
        info.group = value;
      },
      "unix.group": (value, info) => {
        if (info.group === void 0)
          info.group = value;
      },
      get "unix.gid"() {
        return this["unix.group"];
      }
      // Regarding the fact "perm":
      // We don't handle permission information stored in "perm" because its information is conceptually
      // different from what users of FTP clients usually associate with "permissions". Those that have
      // some expectations (and probably want to edit them with a SITE command) often unknowingly expect
      // the Unix permission system. The information passed by "perm" describes what FTP commands can be
      // executed with a file/directory. But even this can be either incomplete or just meant as a "guide"
      // as the spec mentions. From https://tools.ietf.org/html/rfc3659#section-7.5.5: "The permissions are
      // described here as they apply to FTP commands. They may not map easily into particular permissions
      // available on the server's operating system." The parser by Apache Commons tries to translate these
      // to Unix permissions – this is misleading users and might not even be correct.
    };
    function splitStringOnce(str, delimiter) {
      const pos = str.indexOf(delimiter);
      const a = str.substr(0, pos);
      const b = str.substr(pos + delimiter.length);
      return [a, b];
    }
    function testLine(line) {
      return /^\S+=\S+;/.test(line) || line.startsWith(" ");
    }
    function parseLine(line) {
      const [packedFacts, name] = splitStringOnce(line, " ");
      if (name === "" || name === "." || name === "..") {
        return void 0;
      }
      const info = new FileInfo_1.FileInfo(name);
      const facts = packedFacts.split(";");
      for (const fact of facts) {
        const [factName, factValue] = splitStringOnce(fact, "=");
        if (!factValue) {
          continue;
        }
        const factHandler = factHandlersByName[factName.toLowerCase()];
        if (!factHandler) {
          continue;
        }
        const result = factHandler(factValue, info);
        if (result === 2) {
          return void 0;
        }
      }
      return info;
    }
    function transformList(files) {
      const nonLinksByID = /* @__PURE__ */ new Map();
      for (const file of files) {
        if (!file.isSymbolicLink && file.uniqueID !== void 0) {
          nonLinksByID.set(file.uniqueID, file);
        }
      }
      const resolvedFiles = [];
      for (const file of files) {
        if (file.isSymbolicLink && file.uniqueID !== void 0 && file.link === void 0) {
          const target = nonLinksByID.get(file.uniqueID);
          if (target !== void 0) {
            file.link = target.name;
          }
        }
        const isPartOfDirectory = !file.name.includes("/");
        if (isPartOfDirectory) {
          resolvedFiles.push(file);
        }
      }
      return resolvedFiles;
    }
    function parseMLSxDate(fact) {
      return new Date(Date.UTC(
        +fact.slice(0, 4),
        // Year
        +fact.slice(4, 6) - 1,
        // Month
        +fact.slice(6, 8),
        // Date
        +fact.slice(8, 10),
        // Hours
        +fact.slice(10, 12),
        // Minutes
        +fact.slice(12, 14),
        // Seconds
        +fact.slice(15, 18)
        // Milliseconds
      ));
    }
  }
});

// node_modules/basic-ftp/dist/parseList.js
var require_parseList = __commonJS({
  "node_modules/basic-ftp/dist/parseList.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseList = parseList;
    var dosParser = __importStar(require_parseListDOS());
    var unixParser = __importStar(require_parseListUnix());
    var mlsdParser = __importStar(require_parseListMLSD());
    var availableParsers = [
      dosParser,
      unixParser,
      mlsdParser
      // Keep MLSD last, may accept filename only
    ];
    function firstCompatibleParser(line, parsers) {
      return parsers.find((parser) => parser.testLine(line) === true);
    }
    function isNotBlank(str) {
      return str.trim() !== "";
    }
    function isNotMeta(str) {
      return !str.startsWith("total");
    }
    var REGEX_NEWLINE = /\r?\n/;
    function parseList(rawList) {
      const lines = rawList.split(REGEX_NEWLINE).filter(isNotBlank).filter(isNotMeta);
      if (lines.length === 0) {
        return [];
      }
      const testLine = lines[lines.length - 1];
      const parser = firstCompatibleParser(testLine, availableParsers);
      if (!parser) {
        throw new Error("This library only supports MLSD, Unix- or DOS-style directory listing. Your FTP server seems to be using another format. You can see the transmitted listing when setting `client.ftp.verbose = true`. You can then provide a custom parser to `client.parseList`, see the documentation for details.");
      }
      const files = lines.map(parser.parseLine).filter((info) => info !== void 0);
      return parser.transformList(files);
    }
  }
});

// node_modules/basic-ftp/dist/ProgressTracker.js
var require_ProgressTracker = __commonJS({
  "node_modules/basic-ftp/dist/ProgressTracker.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ProgressTracker = void 0;
    var ProgressTracker = class {
      constructor() {
        this.bytesOverall = 0;
        this.intervalMs = 500;
        this.onStop = noop;
        this.onHandle = noop;
      }
      /**
       * Register a new handler for progress info. Use `undefined` to disable reporting.
       */
      reportTo(onHandle = noop) {
        this.onHandle = onHandle;
      }
      /**
       * Start tracking transfer progress of a socket.
       *
       * @param socket  The socket to observe.
       * @param name  A name associated with this progress tracking, e.g. a filename.
       * @param type  The type of the transfer, typically "upload" or "download".
       */
      start(socket, name, type) {
        let lastBytes = 0;
        this.onStop = poll(this.intervalMs, () => {
          const bytes = socket.bytesRead + socket.bytesWritten;
          this.bytesOverall += bytes - lastBytes;
          lastBytes = bytes;
          this.onHandle({
            name,
            type,
            bytes,
            bytesOverall: this.bytesOverall
          });
        });
      }
      /**
       * Stop tracking transfer progress.
       */
      stop() {
        this.onStop(false);
      }
      /**
       * Call the progress handler one more time, then stop tracking.
       */
      updateAndStop() {
        this.onStop(true);
      }
    };
    exports2.ProgressTracker = ProgressTracker;
    function poll(intervalMs, updateFunc) {
      const id = setInterval(updateFunc, intervalMs);
      const stopFunc = (stopWithUpdate) => {
        clearInterval(id);
        if (stopWithUpdate) {
          updateFunc();
        }
        updateFunc = noop;
      };
      updateFunc();
      return stopFunc;
    }
    function noop() {
    }
  }
});

// node_modules/basic-ftp/dist/StringWriter.js
var require_StringWriter = __commonJS({
  "node_modules/basic-ftp/dist/StringWriter.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.StringWriter = void 0;
    var stream_1 = require("stream");
    var StringWriter = class extends stream_1.Writable {
      constructor() {
        super(...arguments);
        this.buf = Buffer.alloc(0);
      }
      _write(chunk, _, callback) {
        if (chunk instanceof Buffer) {
          this.buf = Buffer.concat([this.buf, chunk]);
          callback(null);
        } else {
          callback(new Error("StringWriter expects chunks of type 'Buffer'."));
        }
      }
      getText(encoding) {
        return this.buf.toString(encoding);
      }
    };
    exports2.StringWriter = StringWriter;
  }
});

// node_modules/basic-ftp/dist/netUtils.js
var require_netUtils = __commonJS({
  "node_modules/basic-ftp/dist/netUtils.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.describeTLS = describeTLS;
    exports2.describeAddress = describeAddress;
    exports2.upgradeSocket = upgradeSocket;
    exports2.ipIsPrivateV4Address = ipIsPrivateV4Address;
    var tls_1 = require("tls");
    function describeTLS(socket) {
      if (socket instanceof tls_1.TLSSocket) {
        const protocol = socket.getProtocol();
        return protocol ? protocol : "Server socket or disconnected client socket";
      }
      return "No encryption";
    }
    function describeAddress(socket) {
      if (socket.remoteFamily === "IPv6") {
        return `[${socket.remoteAddress}]:${socket.remotePort}`;
      }
      return `${socket.remoteAddress}:${socket.remotePort}`;
    }
    function upgradeSocket(socket, options) {
      return new Promise((resolve3, reject) => {
        const tlsOptions = Object.assign({}, options, {
          socket
        });
        const tlsSocket = (0, tls_1.connect)(tlsOptions, () => {
          const expectCertificate = tlsOptions.rejectUnauthorized !== false;
          if (expectCertificate && !tlsSocket.authorized) {
            reject(tlsSocket.authorizationError);
          } else {
            tlsSocket.removeAllListeners("error");
            resolve3(tlsSocket);
          }
        }).once("error", (error) => {
          reject(error);
        });
      });
    }
    function ipIsPrivateV4Address(ip = "") {
      if (ip.startsWith("::ffff:")) {
        ip = ip.substr(7);
      }
      const octets = ip.split(".").map((o) => parseInt(o, 10));
      return octets[0] === 10 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 || octets[0] === 192 && octets[1] === 168 || ip === "127.0.0.1";
    }
  }
});

// node_modules/basic-ftp/dist/transfer.js
var require_transfer = __commonJS({
  "node_modules/basic-ftp/dist/transfer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.enterPassiveModeIPv6 = enterPassiveModeIPv6;
    exports2.parseEpsvResponse = parseEpsvResponse;
    exports2.enterPassiveModeIPv4 = enterPassiveModeIPv4;
    exports2.enterPassiveModeIPv4_forceControlHostIP = enterPassiveModeIPv4_forceControlHostIP2;
    exports2.parsePasvResponse = parsePasvResponse;
    exports2.connectForPassiveTransfer = connectForPassiveTransfer;
    exports2.uploadFrom = uploadFrom;
    exports2.downloadTo = downloadTo;
    var netUtils_1 = require_netUtils();
    var stream_1 = require("stream");
    var tls_1 = require("tls");
    var parseControlResponse_1 = require_parseControlResponse();
    async function enterPassiveModeIPv6(ftp) {
      const res = await ftp.request("EPSV");
      const port = parseEpsvResponse(res.message);
      if (!port) {
        throw new Error("Can't parse EPSV response: " + res.message);
      }
      const controlHost = ftp.socket.remoteAddress;
      if (controlHost === void 0) {
        throw new Error("Control socket is disconnected, can't get remote address.");
      }
      await connectForPassiveTransfer(controlHost, port, ftp);
      return res;
    }
    function parseEpsvResponse(message) {
      const groups = message.match(/[|!]{3}(.+)[|!]/);
      if (groups === null || groups[1] === void 0) {
        throw new Error(`Can't parse response to 'EPSV': ${message}`);
      }
      const port = parseInt(groups[1], 10);
      if (Number.isNaN(port)) {
        throw new Error(`Can't parse response to 'EPSV', port is not a number: ${message}`);
      }
      return port;
    }
    async function enterPassiveModeIPv4(ftp) {
      const res = await ftp.request("PASV");
      const target = parsePasvResponse(res.message);
      if (!target) {
        throw new Error("Can't parse PASV response: " + res.message);
      }
      const controlHost = ftp.socket.remoteAddress;
      if ((0, netUtils_1.ipIsPrivateV4Address)(target.host) && controlHost && !(0, netUtils_1.ipIsPrivateV4Address)(controlHost)) {
        target.host = controlHost;
      }
      await connectForPassiveTransfer(target.host, target.port, ftp);
      return res;
    }
    async function enterPassiveModeIPv4_forceControlHostIP2(ftp) {
      const res = await ftp.request("PASV");
      const target = parsePasvResponse(res.message);
      if (!target) {
        throw new Error("Can't parse PASV response: " + res.message);
      }
      const controlHost = ftp.socket.remoteAddress;
      if (controlHost === void 0) {
        throw new Error("Control socket is disconnected, can't get remote address.");
      }
      await connectForPassiveTransfer(controlHost, target.port, ftp);
      return res;
    }
    function parsePasvResponse(message) {
      const groups = message.match(/([-\d]+,[-\d]+,[-\d]+,[-\d]+),([-\d]+),([-\d]+)/);
      if (groups === null || groups.length !== 4) {
        throw new Error(`Can't parse response to 'PASV': ${message}`);
      }
      return {
        host: groups[1].replace(/,/g, "."),
        port: (parseInt(groups[2], 10) & 255) * 256 + (parseInt(groups[3], 10) & 255)
      };
    }
    function connectForPassiveTransfer(host, port, ftp) {
      return new Promise((resolve3, reject) => {
        let socket = ftp._newSocket();
        const handleConnErr = function(err) {
          err.message = "Can't open data connection in passive mode: " + err.message;
          reject(err);
        };
        const handleTimeout = function() {
          socket.destroy();
          reject(new Error(`Timeout when trying to open data connection to ${host}:${port}`));
        };
        socket.setTimeout(ftp.timeout);
        socket.on("error", handleConnErr);
        socket.on("timeout", handleTimeout);
        socket.connect({ port, host, family: ftp.ipFamily }, () => {
          if (ftp.socket instanceof tls_1.TLSSocket) {
            socket = (0, tls_1.connect)(Object.assign({}, ftp.tlsOptions, {
              socket,
              // Reuse the TLS session negotiated earlier when the control connection
              // was upgraded. Servers expect this because it provides additional
              // security: If a completely new session would be negotiated, a hacker
              // could guess the port and connect to the new data connection before we do
              // by just starting his/her own TLS session.
              session: ftp.socket.getSession()
            }));
          }
          socket.removeListener("error", handleConnErr);
          socket.removeListener("timeout", handleTimeout);
          ftp.dataSocket = socket;
          resolve3();
        });
      });
    }
    var TransferResolver = class {
      /**
       * Instantiate a TransferResolver
       */
      constructor(ftp, progress) {
        this.ftp = ftp;
        this.progress = progress;
        this.response = void 0;
        this.dataTransferDone = false;
      }
      /**
       * Mark the beginning of a transfer.
       *
       * @param name - Name of the transfer, usually the filename.
       * @param type - Type of transfer, usually "upload" or "download".
       */
      onDataStart(name, type) {
        if (this.ftp.dataSocket === void 0) {
          throw new Error("Data transfer should start but there is no data connection.");
        }
        this.ftp.socket.setTimeout(0);
        this.ftp.dataSocket.setTimeout(this.ftp.timeout);
        this.progress.start(this.ftp.dataSocket, name, type);
      }
      /**
       * The data connection has finished the transfer.
       */
      onDataDone(task) {
        this.progress.updateAndStop();
        this.ftp.socket.setTimeout(this.ftp.timeout);
        if (this.ftp.dataSocket) {
          this.ftp.dataSocket.setTimeout(0);
        }
        this.dataTransferDone = true;
        this.tryResolve(task);
      }
      /**
       * The control connection reports the transfer as finished.
       */
      onControlDone(task, response) {
        this.response = response;
        this.tryResolve(task);
      }
      /**
       * An error has been reported and the task should be rejected.
       */
      onError(task, err) {
        this.progress.updateAndStop();
        this.ftp.socket.setTimeout(this.ftp.timeout);
        this.ftp.dataSocket = void 0;
        task.reject(err);
      }
      /**
       * Control connection sent an unexpected request requiring a response from our part. We
       * can't provide that (because unknown) and have to close the contrext with an error because
       * the FTP server is now caught up in a state we can't resolve.
       */
      onUnexpectedRequest(response) {
        const err = new Error(`Unexpected FTP response is requesting an answer: ${response.message}`);
        this.ftp.closeWithError(err);
      }
      tryResolve(task) {
        const canResolve = this.dataTransferDone && this.response !== void 0;
        if (canResolve) {
          this.ftp.dataSocket = void 0;
          task.resolve(this.response);
        }
      }
    };
    function uploadFrom(source, config) {
      const resolver = new TransferResolver(config.ftp, config.tracker);
      const fullCommand = `${config.command} ${config.remotePath}`;
      return config.ftp.handle(fullCommand, (res, task) => {
        if (res instanceof Error) {
          resolver.onError(task, res);
        } else if (res.code === 150 || res.code === 125) {
          const dataSocket = config.ftp.dataSocket;
          if (!dataSocket) {
            resolver.onError(task, new Error("Upload should begin but no data connection is available."));
            return;
          }
          const canUpload = "getCipher" in dataSocket ? dataSocket.getCipher() !== void 0 : true;
          onConditionOrEvent(canUpload, dataSocket, "secureConnect", () => {
            config.ftp.log(`Uploading to ${(0, netUtils_1.describeAddress)(dataSocket)} (${(0, netUtils_1.describeTLS)(dataSocket)})`);
            resolver.onDataStart(config.remotePath, config.type);
            (0, stream_1.pipeline)(source, dataSocket, (err) => {
              if (err) {
                resolver.onError(task, err);
              } else {
                resolver.onDataDone(task);
              }
            });
          });
        } else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) {
          resolver.onControlDone(task, res);
        } else if ((0, parseControlResponse_1.positiveIntermediate)(res.code)) {
          resolver.onUnexpectedRequest(res);
        }
      });
    }
    function downloadTo(destination, config) {
      if (!config.ftp.dataSocket) {
        throw new Error("Download will be initiated but no data connection is available.");
      }
      const resolver = new TransferResolver(config.ftp, config.tracker);
      return config.ftp.handle(config.command, (res, task) => {
        if (res instanceof Error) {
          resolver.onError(task, res);
        } else if (res.code === 150 || res.code === 125) {
          const dataSocket = config.ftp.dataSocket;
          if (!dataSocket) {
            resolver.onError(task, new Error("Download should begin but no data connection is available."));
            return;
          }
          config.ftp.log(`Downloading from ${(0, netUtils_1.describeAddress)(dataSocket)} (${(0, netUtils_1.describeTLS)(dataSocket)})`);
          resolver.onDataStart(config.remotePath, config.type);
          (0, stream_1.pipeline)(dataSocket, destination, (err) => {
            if (err) {
              resolver.onError(task, err);
            } else {
              resolver.onDataDone(task);
            }
          });
        } else if (res.code === 350) {
          config.ftp.send("RETR " + config.remotePath);
        } else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) {
          resolver.onControlDone(task, res);
        } else if ((0, parseControlResponse_1.positiveIntermediate)(res.code)) {
          resolver.onUnexpectedRequest(res);
        }
      });
    }
    function onConditionOrEvent(condition, emitter, eventName, action) {
      if (condition === true) {
        action();
      } else {
        emitter.once(eventName, () => action());
      }
    }
  }
});

// node_modules/basic-ftp/dist/Client.js
var require_Client = __commonJS({
  "node_modules/basic-ftp/dist/Client.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Client = void 0;
    var fs_1 = require("fs");
    var path_1 = require("path");
    var tls_1 = require("tls");
    var util_1 = require("util");
    var FtpContext_1 = require_FtpContext();
    var parseList_1 = require_parseList();
    var ProgressTracker_1 = require_ProgressTracker();
    var StringWriter_1 = require_StringWriter();
    var parseListMLSD_1 = require_parseListMLSD();
    var netUtils_1 = require_netUtils();
    var transfer_1 = require_transfer();
    var parseControlResponse_1 = require_parseControlResponse();
    var fsReadDir = (0, util_1.promisify)(fs_1.readdir);
    var fsMkDir = (0, util_1.promisify)(fs_1.mkdir);
    var fsStat = (0, util_1.promisify)(fs_1.stat);
    var fsOpen = (0, util_1.promisify)(fs_1.open);
    var fsClose = (0, util_1.promisify)(fs_1.close);
    var fsUnlink = (0, util_1.promisify)(fs_1.unlink);
    var defaultClientOptions = {
      allowSeparateTransferHost: true
    };
    var LIST_COMMANDS_DEFAULT = () => ["LIST -a", "LIST"];
    var LIST_COMMANDS_MLSD = () => ["MLSD", "LIST -a", "LIST"];
    var Client2 = class {
      /**
       * Instantiate an FTP client.
       *
       * @param timeout  Timeout in milliseconds, use 0 for no timeout. Optional, default is 30 seconds.
       */
      constructor(timeout = 3e4, options = defaultClientOptions) {
        this.availableListCommands = LIST_COMMANDS_DEFAULT();
        this.ftp = new FtpContext_1.FTPContext(timeout);
        this.prepareTransfer = this._enterFirstCompatibleMode([
          transfer_1.enterPassiveModeIPv6,
          options.allowSeparateTransferHost ? transfer_1.enterPassiveModeIPv4 : transfer_1.enterPassiveModeIPv4_forceControlHostIP
        ]);
        this.parseList = parseList_1.parseList;
        this._progressTracker = new ProgressTracker_1.ProgressTracker();
      }
      /**
       * Close the client and all open socket connections.
       *
       * Close the client and all open socket connections. The client can’t be used anymore after calling this method,
       * you have to either reconnect with `access` or `connect` or instantiate a new instance to continue any work.
       * A client is also closed automatically if any timeout or connection error occurs.
       */
      close() {
        this.ftp.close();
        this._progressTracker.stop();
      }
      /**
       * Returns true if the client is closed and can't be used anymore.
       */
      get closed() {
        return this.ftp.closed;
      }
      /**
       * Connect (or reconnect) to an FTP server.
       *
       * This is an instance method and thus can be called multiple times during the lifecycle of a `Client`
       * instance. Whenever you do, the client is reset with a new control connection. This also implies that
       * you can reopen a `Client` instance that has been closed due to an error when reconnecting with this
       * method. In fact, reconnecting is the only way to continue using a closed `Client`.
       *
       * @param host  Host the client should connect to. Optional, default is "localhost".
       * @param port  Port the client should connect to. Optional, default is 21.
       */
      connect(host = "localhost", port = 21) {
        this.ftp.reset();
        this.ftp.socket.connect({
          host,
          port,
          family: this.ftp.ipFamily
        }, () => this.ftp.log(`Connected to ${(0, netUtils_1.describeAddress)(this.ftp.socket)} (${(0, netUtils_1.describeTLS)(this.ftp.socket)})`));
        return this._handleConnectResponse();
      }
      /**
       * As `connect` but using implicit TLS. Implicit TLS is not an FTP standard and has been replaced by
       * explicit TLS. There are still FTP servers that support only implicit TLS, though.
       */
      connectImplicitTLS(host = "localhost", port = 21, tlsOptions = {}) {
        this.ftp.reset();
        this.ftp.socket = (0, tls_1.connect)(port, host, tlsOptions, () => this.ftp.log(`Connected to ${(0, netUtils_1.describeAddress)(this.ftp.socket)} (${(0, netUtils_1.describeTLS)(this.ftp.socket)})`));
        this.ftp.tlsOptions = tlsOptions;
        return this._handleConnectResponse();
      }
      /**
       * Handles the first reponse by an FTP server after the socket connection has been established.
       */
      _handleConnectResponse() {
        return this.ftp.handle(void 0, (res, task) => {
          if (res instanceof Error) {
            task.reject(res);
          } else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) {
            task.resolve(res);
          } else {
            task.reject(new FtpContext_1.FTPError(res));
          }
        });
      }
      /**
       * Send an FTP command and handle the first response.
       */
      send(command, ignoreErrorCodesDEPRECATED = false) {
        if (ignoreErrorCodesDEPRECATED) {
          this.ftp.log("Deprecated call using send(command, flag) with boolean flag to ignore errors. Use sendIgnoringError(command).");
          return this.sendIgnoringError(command);
        }
        return this.ftp.request(command);
      }
      /**
       * Send an FTP command and ignore an FTP error response. Any other kind of error or timeout will still reject the Promise.
       *
       * @param command
       */
      sendIgnoringError(command) {
        return this.ftp.handle(command, (res, task) => {
          if (res instanceof FtpContext_1.FTPError) {
            task.resolve({ code: res.code, message: res.message });
          } else if (res instanceof Error) {
            task.reject(res);
          } else {
            task.resolve(res);
          }
        });
      }
      /**
       * Upgrade the current socket connection to TLS.
       *
       * @param options  TLS options as in `tls.connect(options)`, optional.
       * @param command  Set the authentication command. Optional, default is "AUTH TLS".
       */
      async useTLS(options = {}, command = "AUTH TLS") {
        const ret = await this.send(command);
        this.ftp.socket = await (0, netUtils_1.upgradeSocket)(this.ftp.socket, options);
        this.ftp.tlsOptions = options;
        this.ftp.log(`Control socket is using: ${(0, netUtils_1.describeTLS)(this.ftp.socket)}`);
        return ret;
      }
      /**
       * Login a user with a password.
       *
       * @param user  Username to use for login. Optional, default is "anonymous".
       * @param password  Password to use for login. Optional, default is "guest".
       */
      login(user = "anonymous", password = "guest") {
        this.ftp.log(`Login security: ${(0, netUtils_1.describeTLS)(this.ftp.socket)}`);
        return this.ftp.handle("USER " + user, (res, task) => {
          if (res instanceof Error) {
            task.reject(res);
          } else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) {
            task.resolve(res);
          } else if (res.code === 331) {
            this.ftp.send("PASS " + password);
          } else {
            task.reject(new FtpContext_1.FTPError(res));
          }
        });
      }
      /**
       * Set the usual default settings.
       *
       * Settings used:
       * * Binary mode (TYPE I)
       * * File structure (STRU F)
       * * Additional settings for FTPS (PBSZ 0, PROT P)
       */
      async useDefaultSettings() {
        const features = await this.features();
        const supportsMLSD = features.has("MLST");
        this.availableListCommands = supportsMLSD ? LIST_COMMANDS_MLSD() : LIST_COMMANDS_DEFAULT();
        await this.send("TYPE I");
        await this.sendIgnoringError("STRU F");
        await this.sendIgnoringError("OPTS UTF8 ON");
        if (supportsMLSD) {
          await this.sendIgnoringError("OPTS MLST type;size;modify;unique;unix.mode;unix.owner;unix.group;unix.ownername;unix.groupname;");
        }
        if (this.ftp.hasTLS) {
          await this.sendIgnoringError("PBSZ 0");
          await this.sendIgnoringError("PROT P");
        }
      }
      /**
       * Convenience method that calls `connect`, `useTLS`, `login` and `useDefaultSettings`.
       *
       * This is an instance method and thus can be called multiple times during the lifecycle of a `Client`
       * instance. Whenever you do, the client is reset with a new control connection. This also implies that
       * you can reopen a `Client` instance that has been closed due to an error when reconnecting with this
       * method. In fact, reconnecting is the only way to continue using a closed `Client`.
       */
      async access(options = {}) {
        var _a, _b;
        const useExplicitTLS = options.secure === true;
        const useImplicitTLS = options.secure === "implicit";
        let welcome;
        if (useImplicitTLS) {
          welcome = await this.connectImplicitTLS(options.host, options.port, options.secureOptions);
        } else {
          welcome = await this.connect(options.host, options.port);
        }
        if (useExplicitTLS) {
          const secureOptions = (_a = options.secureOptions) !== null && _a !== void 0 ? _a : {};
          secureOptions.host = (_b = secureOptions.host) !== null && _b !== void 0 ? _b : options.host;
          await this.useTLS(secureOptions);
        }
        await this.sendIgnoringError("OPTS UTF8 ON");
        await this.login(options.user, options.password);
        await this.useDefaultSettings();
        return welcome;
      }
      /**
       * Get the current working directory.
       */
      async pwd() {
        const res = await this.send("PWD");
        const parsed = res.message.match(/"(.+)"/);
        if (parsed === null || parsed[1] === void 0) {
          throw new Error(`Can't parse response to command 'PWD': ${res.message}`);
        }
        return parsed[1];
      }
      /**
       * Get a description of supported features.
       *
       * This sends the FEAT command and parses the result into a Map where keys correspond to available commands
       * and values hold further information. Be aware that your FTP servers might not support this
       * command in which case this method will not throw an exception but just return an empty Map.
       */
      async features() {
        const res = await this.sendIgnoringError("FEAT");
        const features = /* @__PURE__ */ new Map();
        if (res.code < 400 && (0, parseControlResponse_1.isMultiline)(res.message)) {
          res.message.split("\n").slice(1, -1).forEach((line) => {
            const entry = line.trim().split(" ");
            features.set(entry[0], entry[1] || "");
          });
        }
        return features;
      }
      /**
       * Set the working directory.
       */
      async cd(path4) {
        const validPath = await this.protectWhitespace(path4);
        return this.send("CWD " + validPath);
      }
      /**
       * Switch to the parent directory of the working directory.
       */
      async cdup() {
        return this.send("CDUP");
      }
      /**
       * Get the last modified time of a file. This is not supported by every FTP server, in which case
       * calling this method will throw an exception.
       */
      async lastMod(path4) {
        const validPath = await this.protectWhitespace(path4);
        const res = await this.send(`MDTM ${validPath}`);
        const date = res.message.slice(4);
        return (0, parseListMLSD_1.parseMLSxDate)(date);
      }
      /**
       * Get the size of a file.
       */
      async size(path4) {
        const validPath = await this.protectWhitespace(path4);
        const command = `SIZE ${validPath}`;
        const res = await this.send(command);
        const size = parseInt(res.message.slice(4), 10);
        if (Number.isNaN(size)) {
          throw new Error(`Can't parse response to command '${command}' as a numerical value: ${res.message}`);
        }
        return size;
      }
      /**
       * Rename a file.
       *
       * Depending on the FTP server this might also be used to move a file from one
       * directory to another by providing full paths.
       */
      async rename(srcPath, destPath) {
        const validSrc = await this.protectWhitespace(srcPath);
        const validDest = await this.protectWhitespace(destPath);
        await this.send("RNFR " + validSrc);
        return this.send("RNTO " + validDest);
      }
      /**
       * Remove a file from the current working directory.
       *
       * You can ignore FTP error return codes which won't throw an exception if e.g.
       * the file doesn't exist.
       */
      async remove(path4, ignoreErrorCodes = false) {
        const validPath = await this.protectWhitespace(path4);
        if (ignoreErrorCodes) {
          return this.sendIgnoringError(`DELE ${validPath}`);
        }
        return this.send(`DELE ${validPath}`);
      }
      /**
       * Report transfer progress for any upload or download to a given handler.
       *
       * This will also reset the overall transfer counter that can be used for multiple transfers. You can
       * also call the function without a handler to stop reporting to an earlier one.
       *
       * @param handler  Handler function to call on transfer progress.
       */
      trackProgress(handler) {
        this._progressTracker.bytesOverall = 0;
        this._progressTracker.reportTo(handler);
      }
      /**
       * Upload data from a readable stream or a local file to a remote file.
       *
       * @param source  Readable stream or path to a local file.
       * @param toRemotePath  Path to a remote file to write to.
       */
      async uploadFrom(source, toRemotePath, options = {}) {
        return this._uploadWithCommand(source, toRemotePath, "STOR", options);
      }
      /**
       * Upload data from a readable stream or a local file by appending it to an existing file. If the file doesn't
       * exist the FTP server should create it.
       *
       * @param source  Readable stream or path to a local file.
       * @param toRemotePath  Path to a remote file to write to.
       */
      async appendFrom(source, toRemotePath, options = {}) {
        return this._uploadWithCommand(source, toRemotePath, "APPE", options);
      }
      /**
       * @protected
       */
      async _uploadWithCommand(source, remotePath, command, options) {
        if (typeof source === "string") {
          return this._uploadLocalFile(source, remotePath, command, options);
        }
        return this._uploadFromStream(source, remotePath, command);
      }
      /**
       * @protected
       */
      async _uploadLocalFile(localPath, remotePath, command, options) {
        const fd = await fsOpen(localPath, "r");
        const source = (0, fs_1.createReadStream)("", {
          fd,
          start: options.localStart,
          end: options.localEndInclusive,
          autoClose: false
        });
        try {
          return await this._uploadFromStream(source, remotePath, command);
        } finally {
          await ignoreError(() => fsClose(fd));
        }
      }
      /**
       * @protected
       */
      async _uploadFromStream(source, remotePath, command) {
        const onError = (err) => this.ftp.closeWithError(err);
        source.once("error", onError);
        try {
          const validPath = await this.protectWhitespace(remotePath);
          await this.prepareTransfer(this.ftp);
          return await (0, transfer_1.uploadFrom)(source, {
            ftp: this.ftp,
            tracker: this._progressTracker,
            command,
            remotePath: validPath,
            type: "upload"
          });
        } finally {
          source.removeListener("error", onError);
        }
      }
      /**
       * Download a remote file and pipe its data to a writable stream or to a local file.
       *
       * You can optionally define at which position of the remote file you'd like to start
       * downloading. If the destination you provide is a file, the offset will be applied
       * to it as well. For example: To resume a failed download, you'd request the size of
       * the local, partially downloaded file and use that as the offset. Assuming the size
       * is 23, you'd download the rest using `downloadTo("local.txt", "remote.txt", 23)`.
       *
       * @param destination  Stream or path for a local file to write to.
       * @param fromRemotePath  Path of the remote file to read from.
       * @param startAt  Position within the remote file to start downloading at. If the destination is a file, this offset is also applied to it.
       */
      async downloadTo(destination, fromRemotePath, startAt = 0) {
        if (typeof destination === "string") {
          return this._downloadToFile(destination, fromRemotePath, startAt);
        }
        return this._downloadToStream(destination, fromRemotePath, startAt);
      }
      /**
       * @protected
       */
      async _downloadToFile(localPath, remotePath, startAt) {
        const appendingToLocalFile = startAt > 0;
        const fileSystemFlags = appendingToLocalFile ? "r+" : "w";
        const fd = await fsOpen(localPath, fileSystemFlags);
        const destination = (0, fs_1.createWriteStream)("", {
          fd,
          start: startAt,
          autoClose: false
        });
        try {
          return await this._downloadToStream(destination, remotePath, startAt);
        } catch (err) {
          const localFileStats = await ignoreError(() => fsStat(localPath));
          const hasDownloadedData = localFileStats && localFileStats.size > 0;
          const shouldRemoveLocalFile = !appendingToLocalFile && !hasDownloadedData;
          if (shouldRemoveLocalFile) {
            await ignoreError(() => fsUnlink(localPath));
          }
          throw err;
        } finally {
          await ignoreError(() => fsClose(fd));
        }
      }
      /**
       * @protected
       */
      async _downloadToStream(destination, remotePath, startAt) {
        const onError = (err) => this.ftp.closeWithError(err);
        destination.once("error", onError);
        try {
          const validPath = await this.protectWhitespace(remotePath);
          await this.prepareTransfer(this.ftp);
          return await (0, transfer_1.downloadTo)(destination, {
            ftp: this.ftp,
            tracker: this._progressTracker,
            command: startAt > 0 ? `REST ${startAt}` : `RETR ${validPath}`,
            remotePath: validPath,
            type: "download"
          });
        } finally {
          destination.removeListener("error", onError);
          destination.end();
        }
      }
      /**
       * List files and directories in the current working directory, or from `path` if specified.
       *
       * @param [path]  Path to remote file or directory.
       */
      async list(path4 = "") {
        const validPath = await this.protectWhitespace(path4);
        let lastError;
        for (const candidate of this.availableListCommands) {
          const command = validPath === "" ? candidate : `${candidate} ${validPath}`;
          await this.prepareTransfer(this.ftp);
          try {
            const parsedList = await this._requestListWithCommand(command);
            this.availableListCommands = [candidate];
            return parsedList;
          } catch (err) {
            const shouldTryNext = err instanceof FtpContext_1.FTPError;
            if (!shouldTryNext) {
              throw err;
            }
            lastError = err;
          }
        }
        throw lastError;
      }
      /**
       * @protected
       */
      async _requestListWithCommand(command) {
        const buffer = new StringWriter_1.StringWriter();
        await (0, transfer_1.downloadTo)(buffer, {
          ftp: this.ftp,
          tracker: this._progressTracker,
          command,
          remotePath: "",
          type: "list"
        });
        const text = buffer.getText(this.ftp.encoding);
        this.ftp.log(text);
        return this.parseList(text);
      }
      /**
       * Remove a directory and all of its content.
       *
       * @param remoteDirPath  The path of the remote directory to delete.
       * @example client.removeDir("foo") // Remove directory 'foo' using a relative path.
       * @example client.removeDir("foo/bar") // Remove directory 'bar' using a relative path.
       * @example client.removeDir("/foo/bar") // Remove directory 'bar' using an absolute path.
       * @example client.removeDir("/") // Remove everything.
       */
      async removeDir(remoteDirPath) {
        return this._exitAtCurrentDirectory(async () => {
          await this.cd(remoteDirPath);
          const absoluteDirPath = await this.pwd();
          await this.clearWorkingDir();
          const dirIsRoot = absoluteDirPath === "/";
          if (!dirIsRoot) {
            await this.cdup();
            await this.removeEmptyDir(absoluteDirPath);
          }
        });
      }
      /**
       * Remove all files and directories in the working directory without removing
       * the working directory itself.
       */
      async clearWorkingDir() {
        for (const file of await this.list()) {
          if (file.isDirectory) {
            await this.cd(file.name);
            await this.clearWorkingDir();
            await this.cdup();
            await this.removeEmptyDir(file.name);
          } else {
            await this.remove(file.name);
          }
        }
      }
      /**
       * Upload the contents of a local directory to the remote working directory.
       *
       * This will overwrite existing files with the same names and reuse existing directories.
       * Unrelated files and directories will remain untouched. You can optionally provide a `remoteDirPath`
       * to put the contents inside a directory which will be created if necessary including all
       * intermediate directories. If you did provide a remoteDirPath the working directory will stay
       * the same as before calling this method.
       *
       * @param localDirPath  Local path, e.g. "foo/bar" or "../test"
       * @param [remoteDirPath]  Remote path of a directory to upload to. Working directory if undefined.
       */
      async uploadFromDir(localDirPath, remoteDirPath) {
        return this._exitAtCurrentDirectory(async () => {
          if (remoteDirPath) {
            await this.ensureDir(remoteDirPath);
          }
          return await this._uploadToWorkingDir(localDirPath);
        });
      }
      /**
       * @protected
       */
      async _uploadToWorkingDir(localDirPath) {
        const files = await fsReadDir(localDirPath);
        for (const file of files) {
          const fullPath = (0, path_1.join)(localDirPath, file);
          const stats = await fsStat(fullPath);
          if (stats.isFile()) {
            await this.uploadFrom(fullPath, file);
          } else if (stats.isDirectory()) {
            await this._openDir(file);
            await this._uploadToWorkingDir(fullPath);
            await this.cdup();
          }
        }
      }
      /**
       * Download all files and directories of the working directory to a local directory.
       *
       * @param localDirPath  The local directory to download to.
       * @param remoteDirPath  Remote directory to download. Current working directory if not specified.
       */
      async downloadToDir(localDirPath, remoteDirPath) {
        return this._exitAtCurrentDirectory(async () => {
          if (remoteDirPath) {
            await this.cd(remoteDirPath);
          }
          return await this._downloadFromWorkingDir(localDirPath);
        });
      }
      /**
       * @protected
       */
      async _downloadFromWorkingDir(localDirPath) {
        await ensureLocalDirectory(localDirPath);
        for (const file of await this.list()) {
          const hasInvalidName = !file.name || (0, path_1.basename)(file.name) !== file.name;
          if (hasInvalidName) {
            const safeName = JSON.stringify(file.name);
            this.ftp.log(`Invalid filename from server listing, will skip file. (${safeName})`);
            continue;
          }
          const localPath = (0, path_1.join)(localDirPath, file.name);
          if (file.isDirectory) {
            await this.cd(file.name);
            await this._downloadFromWorkingDir(localPath);
            await this.cdup();
          } else if (file.isFile) {
            await this.downloadTo(localPath, file.name);
          }
        }
      }
      /**
       * Make sure a given remote path exists, creating all directories as necessary.
       * This function also changes the current working directory to the given path.
       */
      async ensureDir(remoteDirPath) {
        if (remoteDirPath.startsWith("/")) {
          await this.cd("/");
        }
        const names = remoteDirPath.split("/").filter((name) => name !== "");
        for (const name of names) {
          await this._openDir(name);
        }
      }
      /**
       * Try to create a directory and enter it. This will not raise an exception if the directory
       * couldn't be created if for example it already exists.
       * @protected
       */
      async _openDir(dirName) {
        await this.sendIgnoringError("MKD " + dirName);
        await this.cd(dirName);
      }
      /**
       * Remove an empty directory, will fail if not empty.
       */
      async removeEmptyDir(path4) {
        const validPath = await this.protectWhitespace(path4);
        return this.send(`RMD ${validPath}`);
      }
      /**
       * FTP servers can't handle filenames that have leading whitespace. This method transforms
       * a given path to fix that issue for most cases.
       */
      async protectWhitespace(path4) {
        if (!path4.startsWith(" ")) {
          return path4;
        }
        const pwd = await this.pwd();
        const absolutePathPrefix = pwd.endsWith("/") ? pwd : pwd + "/";
        return absolutePathPrefix + path4;
      }
      async _exitAtCurrentDirectory(func) {
        const userDir = await this.pwd();
        try {
          return await func();
        } finally {
          if (!this.closed) {
            await ignoreError(() => this.cd(userDir));
          }
        }
      }
      /**
       * Try all available transfer strategies and pick the first one that works. Update `client` to
       * use the working strategy for all successive transfer requests.
       *
       * @returns a function that will try the provided strategies.
       */
      _enterFirstCompatibleMode(strategies) {
        return async (ftp) => {
          ftp.log("Trying to find optimal transfer strategy...");
          let lastError = void 0;
          for (const strategy of strategies) {
            try {
              const res = await strategy(ftp);
              ftp.log("Optimal transfer strategy found.");
              this.prepareTransfer = strategy;
              return res;
            } catch (err) {
              lastError = err;
            }
          }
          throw new Error(`None of the available transfer strategies work. Last error response was '${lastError}'.`);
        };
      }
      /**
       * DEPRECATED, use `uploadFrom`.
       * @deprecated
       */
      async upload(source, toRemotePath, options = {}) {
        this.ftp.log("Warning: upload() has been deprecated, use uploadFrom().");
        return this.uploadFrom(source, toRemotePath, options);
      }
      /**
       * DEPRECATED, use `appendFrom`.
       * @deprecated
       */
      async append(source, toRemotePath, options = {}) {
        this.ftp.log("Warning: append() has been deprecated, use appendFrom().");
        return this.appendFrom(source, toRemotePath, options);
      }
      /**
       * DEPRECATED, use `downloadTo`.
       * @deprecated
       */
      async download(destination, fromRemotePath, startAt = 0) {
        this.ftp.log("Warning: download() has been deprecated, use downloadTo().");
        return this.downloadTo(destination, fromRemotePath, startAt);
      }
      /**
       * DEPRECATED, use `uploadFromDir`.
       * @deprecated
       */
      async uploadDir(localDirPath, remoteDirPath) {
        this.ftp.log("Warning: uploadDir() has been deprecated, use uploadFromDir().");
        return this.uploadFromDir(localDirPath, remoteDirPath);
      }
      /**
       * DEPRECATED, use `downloadToDir`.
       * @deprecated
       */
      async downloadDir(localDirPath) {
        this.ftp.log("Warning: downloadDir() has been deprecated, use downloadToDir().");
        return this.downloadToDir(localDirPath);
      }
    };
    exports2.Client = Client2;
    async function ensureLocalDirectory(path4) {
      try {
        await fsStat(path4);
      } catch (_a) {
        await fsMkDir(path4, { recursive: true });
      }
    }
    async function ignoreError(func) {
      try {
        return await func();
      } catch (_a) {
        return void 0;
      }
    }
  }
});

// node_modules/basic-ftp/dist/StringEncoding.js
var require_StringEncoding = __commonJS({
  "node_modules/basic-ftp/dist/StringEncoding.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// node_modules/basic-ftp/dist/index.js
var require_dist = __commonJS({
  "node_modules/basic-ftp/dist/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.enterPassiveModeIPv6 = exports2.enterPassiveModeIPv4 = void 0;
    __exportStar(require_Client(), exports2);
    __exportStar(require_FtpContext(), exports2);
    __exportStar(require_FileInfo(), exports2);
    __exportStar(require_parseList(), exports2);
    __exportStar(require_StringEncoding(), exports2);
    var transfer_1 = require_transfer();
    Object.defineProperty(exports2, "enterPassiveModeIPv4", { enumerable: true, get: function() {
      return transfer_1.enterPassiveModeIPv4;
    } });
    Object.defineProperty(exports2, "enterPassiveModeIPv6", { enumerable: true, get: function() {
      return transfer_1.enterPassiveModeIPv6;
    } });
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode20 = __toESM(require("vscode"));

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

// src/remote/FtpRemoteFileProvider.ts
var import_node_stream = require("node:stream");
var import_basic_ftp = __toESM(require_dist());
var import_transfer = __toESM(require_transfer());

// src/remote/remotePath.ts
function getRemoteParentDirectory(remotePath) {
  const normalizedPath = remotePath.replace(/\/+/g, "/");
  const lastSlashIndex = normalizedPath.lastIndexOf("/");
  if (lastSlashIndex <= 0) {
    return "/";
  }
  return normalizedPath.slice(0, lastSlashIndex) || "/";
}
function getRemoteFileName(remotePath) {
  const normalizedPath = remotePath.replace(/\/+/g, "/");
  const fileName = normalizedPath.split("/").pop();
  if (!fileName) {
    throw new Error(`DeployDiff could not resolve a file name from remote path ${remotePath}.`);
  }
  return fileName;
}
function joinRemotePath2(remoteRoot, childName) {
  const sanitizedRoot = remoteRoot.replace(/\/+/g, "/").replace(/\/+$/, "") || "/";
  const sanitizedChild = childName.replace(/\/+/g, "/").replace(/^\/+/, "");
  if (!sanitizedChild) {
    return sanitizedRoot;
  }
  if (sanitizedRoot === "/") {
    return `/${sanitizedChild}`;
  }
  return `${sanitizedRoot}/${sanitizedChild}`;
}

// src/remote/FtpRemoteFileProvider.ts
var FtpRemoteFileProvider = class {
  constructor(options, logger) {
    this.options = options;
    this.logger = logger;
  }
  async createDirectory(remotePath) {
    await this.withClient("createDirectory", remotePath, async (client) => {
      await client.ensureDir(remotePath);
    });
  }
  async exists(remotePath) {
    return this.withClient("exists", remotePath, async (client) => {
      const parentDirectory = getRemoteParentDirectory(remotePath);
      const fileName = getRemoteFileName(remotePath);
      try {
        const entries = await client.list(parentDirectory);
        return entries.some((entry) => entry.name === fileName);
      } catch (error) {
        if (isMissingPathError(error)) {
          return false;
        }
        throw error;
      }
    });
  }
  async listDirectory(remotePath) {
    return this.withClient("listDirectory", remotePath, async (client) => {
      const entries = await client.list(remotePath);
      return entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory || entry.type === import_basic_ftp.FileType.Directory ? "directory" : "file",
        size: entry.size,
        modifiedAt: entry.modifiedAt
      }));
    });
  }
  async stat(remotePath) {
    return this.withClient("stat", remotePath, async (client) => {
      if (remotePath === "/") {
        return {
          type: "directory",
          size: 0
        };
      }
      const parentDirectory = getRemoteParentDirectory(remotePath);
      const fileName = getRemoteFileName(remotePath);
      const entries = await client.list(parentDirectory);
      const entry = entries.find((item) => item.name === fileName);
      if (!entry) {
        throw new Error(`DeployDiff FTP could not find ${remotePath}.`);
      }
      return {
        type: entry.isDirectory || entry.type === import_basic_ftp.FileType.Directory ? "directory" : "file",
        size: entry.size,
        modifiedAt: entry.modifiedAt
      };
    });
  }
  async readFile(remotePath) {
    return this.withClient("readFile", remotePath, async (client) => {
      const stream = new import_node_stream.PassThrough();
      const chunks = [];
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      await client.downloadTo(stream, remotePath);
      return Buffer.concat(chunks).toString("utf8");
    });
  }
  async writeFile(remotePath, content) {
    await this.withClient("writeFile", remotePath, async (client) => {
      const parentDirectory = getRemoteParentDirectory(remotePath);
      if (parentDirectory !== "/") {
        await client.ensureDir(parentDirectory);
      }
      await client.uploadFrom(import_node_stream.Readable.from([Buffer.from(content, "utf8")]), remotePath);
    });
  }
  async withClient(operationName, remotePath, operation) {
    const client = new import_basic_ftp.Client(this.options.timeoutMs);
    if (this.options.passiveModeStrategy === "ignorePasvAddress") {
      client.prepareTransfer = import_transfer.enterPassiveModeIPv4_forceControlHostIP;
    }
    try {
      this.logger.info("FTP operation started", {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      await client.access(this.options);
      const result = await operation(client);
      this.logger.info("FTP operation completed", {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      return result;
    } catch (error) {
      this.logger.error("FTP operation failed", error, {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      const message = error instanceof Error ? error.message : "Unknown FTP error.";
      throw new Error(`DeployDiff FTP operation failed: ${message}`);
    } finally {
      client.close();
    }
  }
};
function isMissingPathError(error) {
  if (!(error instanceof Error)) {
    return false;
  }
  return /550|not found|no such file|cannot find/i.test(error.message);
}

// src/remote/ftpConfiguration.ts
var vscode = __toESM(require("vscode"));
var DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY = "deploydiff.ftp.password";
async function getFtpConnectionOptions(workspaceFolder, secrets) {
  const configuration = vscode.workspace.getConfiguration("deploydiff", workspaceFolder.uri);
  const host = configuration.get("ftp.host", "").trim();
  const port = configuration.get("ftp.port", 21);
  const user = configuration.get("ftp.username", "").trim();
  const configuredSecurityMode = configuration.get("ftp.securityMode", "").trim();
  const secure = configuration.get("ftp.secure", false);
  const passiveModeStrategy = configuration.get("ftp.passiveModeStrategy", "default");
  const timeoutMs = configuration.get("ftp.timeoutMs", 1e4);
  const password = await secrets.get(DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY);
  if (!host) {
    throw new DeployDiffError("DeployDiff FTP host is not configured. Add deploydiff.ftp.host in workspace settings.", [
      {
        label: "Open Workspace Settings",
        commandId: "workbench.action.openWorkspaceSettingsFile"
      }
    ]);
  }
  if (!user) {
    throw new DeployDiffError("DeployDiff FTP username is not configured. Add deploydiff.ftp.username in workspace settings.", [
      {
        label: "Open Workspace Settings",
        commandId: "workbench.action.openWorkspaceSettingsFile"
      }
    ]);
  }
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("DeployDiff FTP port must be a positive integer.");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 0) {
    throw new Error("DeployDiff FTP timeout must be a non-negative integer in milliseconds.");
  }
  const securityMode = resolveSecurityMode(configuredSecurityMode, secure);
  if (!password) {
    throw new DeployDiffError("DeployDiff FTP authentication is not configured. Set a password with DeployDiff.", [
      {
        label: "Set FTP Password",
        commandId: "deploydiff.setFtpPassword"
      },
      {
        label: "Open Workspace Settings",
        commandId: "workbench.action.openWorkspaceSettingsFile"
      }
    ]);
  }
  return {
    host,
    port,
    user,
    password,
    secure: mapSecurityModeToSecureOption(securityMode),
    securityMode,
    passiveModeStrategy,
    timeoutMs
  };
}
function resolveSecurityMode(configuredSecurityMode, secure) {
  if (configuredSecurityMode === "off" || configuredSecurityMode === "explicit" || configuredSecurityMode === "implicit") {
    return configuredSecurityMode;
  }
  return secure ? "explicit" : "off";
}
function mapSecurityModeToSecureOption(securityMode) {
  switch (securityMode) {
    case "explicit":
      return true;
    case "implicit":
      return "implicit";
    case "off":
    default:
      return false;
  }
}

// src/remote/SftpRemoteFileProvider.ts
var import_ssh2_sftp_client = __toESM(require("ssh2-sftp-client"));
var SftpRemoteFileProvider = class {
  constructor(options, logger) {
    this.options = options;
    this.logger = logger;
  }
  async createDirectory(remotePath) {
    await this.withClient("createDirectory", remotePath, async (client) => {
      await client.mkdir(remotePath, true);
    });
  }
  async exists(remotePath) {
    return this.withClient("exists", remotePath, async (client) => Boolean(await client.exists(remotePath)));
  }
  async listDirectory(remotePath) {
    return this.withClient("listDirectory", remotePath, async (client) => {
      const entries = await client.list(remotePath);
      return entries.map((entry) => ({
        name: entry.name,
        type: entry.type === "d" ? "directory" : "file",
        size: entry.size,
        modifiedAt: typeof entry.modifyTime === "number" ? new Date(entry.modifyTime) : void 0
      }));
    });
  }
  async stat(remotePath) {
    return this.withClient("stat", remotePath, async (client) => {
      const stats = await client.stat(remotePath);
      const entryType = await client.exists(remotePath);
      return {
        type: entryType === "d" ? "directory" : "file",
        size: stats.size,
        modifiedAt: typeof stats.modifyTime === "number" ? new Date(stats.modifyTime) : void 0
      };
    });
  }
  async readFile(remotePath) {
    return this.withClient("readFile", remotePath, async (client) => {
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
    await this.withClient("writeFile", remotePath, async (client) => {
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
  async withClient(operationName, remotePath, operation) {
    const client = new import_ssh2_sftp_client.default("DeployDiff");
    try {
      this.logger.info("SFTP operation started", {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      await client.connect(this.options);
      const result = await operation(client);
      this.logger.info("SFTP operation completed", {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      return result;
    } catch (error) {
      this.logger.error("SFTP operation failed", error, {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      const message = error instanceof Error ? error.message : "Unknown SFTP error.";
      throw new Error(`DeployDiff SFTP operation failed: ${message}`);
    } finally {
      await client.end().catch(() => void 0);
    }
  }
};

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
async function createRemoteFileProvider(workspaceFolder, secrets, logger) {
  const configuration = vscode3.workspace.getConfiguration("deploydiff", workspaceFolder.uri);
  const transport = configuration.get("transport");
  logger.info("Creating remote file provider", {
    workspaceFolder: workspaceFolder.name,
    transport
  });
  if (!transport) {
    throw new DeployDiffError(
      'DeployDiff requires "deploydiff.transport" to be set explicitly. Choose "ftp" or "sftp" in workspace settings.',
      [
        {
          label: "Open Settings",
          commandId: "workbench.action.openSettings",
          arguments: ["deploydiff.transport"]
        }
      ]
    );
  }
  switch (transport) {
    case "ftp":
      return new FtpRemoteFileProvider(await getFtpConnectionOptions(workspaceFolder, secrets), logger);
    case "sftp":
      return new SftpRemoteFileProvider(await getSftpConnectionOptions(workspaceFolder, secrets), logger);
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
  constructor(secrets, logger) {
    this.secrets = secrets;
    this.logger = logger;
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
      this.logger.info("Serving deployed document from cache", {
        remoteDocument: uri.toString()
      });
      return Buffer.from(cached, "utf8");
    }
    await this.loadRemoteState(uri);
    return Buffer.from(this.cache.get(uri.toString()) ?? "", "utf8");
  }
  async writeFile(uri, content) {
    const localFileUri = getLocalFileUriFromRemoteDocumentUri(uri);
    const target = resolveDeploymentTarget(localFileUri);
    const provider = await createRemoteFileProvider(target.workspaceFolder, this.secrets, this.logger);
    const nextContent = Buffer.from(content).toString("utf8");
    this.logger.info("Writing remote diff editor changes", {
      localFile: localFileUri.fsPath,
      remotePath: target.remoteFilePath
    });
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
    this.logger.info("Cleared deployed document cache", {
      localFile: localFileUri.fsPath,
      remoteDocument: remoteUri.toString()
    });
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
    const provider = await createRemoteFileProvider(target.workspaceFolder, this.secrets, this.logger);
    this.logger.info("Loading deployed file state", {
      localFile: localFileUri.fsPath,
      remotePath: target.remoteFilePath
    });
    if (!await provider.exists(target.remoteFilePath)) {
      this.logger.warn("Deployed file is missing", {
        localFile: localFileUri.fsPath,
        remotePath: target.remoteFilePath
      });
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
    this.logger.info("Loaded deployed file state", {
      localFile: localFileUri.fsPath,
      remotePath: target.remoteFilePath,
      size: metadata.size,
      type: metadata.type
    });
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
async function openDeployedDiff(localFileUri, remoteDiffDocumentProvider, logger) {
  logger.info("Opening deployed diff", {
    localFile: localFileUri.fsPath
  });
  await remoteDiffDocumentProvider.preload(localFileUri);
  const localDocument = await vscode6.workspace.openTextDocument(localFileUri);
  const remoteDocument = await vscode6.workspace.openTextDocument(createRemoteDocumentUri(localFileUri));
  const fileName = localFileUri.path.split("/").pop() ?? localFileUri.toString();
  const title = `${fileName} \u2194 ${fileName}`;
  if (remoteDocument.languageId !== localDocument.languageId) {
    await vscode6.languages.setTextDocumentLanguage(remoteDocument, localDocument.languageId);
  }
  await vscode6.commands.executeCommand("vscode.diff", localFileUri, remoteDocument.uri, title, {
    preview: false
  });
  logger.info("Deployed diff opened", {
    localFile: localFileUri.fsPath,
    title
  });
}

// src/commands/runDeployCommand.ts
var vscode8 = __toESM(require("vscode"));

// src/commands/showOutput.ts
var vscode7 = __toESM(require("vscode"));
var DEPLOYDIFF_SHOW_OUTPUT_COMMAND_ID = "deploydiff.showOutput";
function registerShowOutputCommand(logger) {
  return vscode7.commands.registerCommand(DEPLOYDIFF_SHOW_OUTPUT_COMMAND_ID, () => {
    logger.info("Opening DeployDiff output channel");
    logger.show(false);
  });
}

// src/commands/runDeployCommand.ts
var SHOW_LOGS_ACTION_LABEL = "Show Logs";
function resourceToLogString(resource) {
  if (Array.isArray(resource)) {
    return `[${resource.map((uri) => uri.toString()).join(", ")}]`;
  }
  return resource?.toString();
}
function registerDeployCommand(commandId, logger, handler) {
  return vscode8.commands.registerCommand(commandId, async (resource, ...args) => {
    const selectedResources = args[0];
    const effectiveResource = Array.isArray(selectedResources) && selectedResources.length > 0 ? selectedResources : resource;
    const resourceLog = resourceToLogString(effectiveResource);
    logger.info("Command started", {
      commandId,
      resource: resourceLog
    });
    try {
      await handler(effectiveResource);
      logger.info("Command completed", {
        commandId,
        resource: resourceLog
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown DeployDiff error.";
      const userMessage = `${message} See the "DeployDiff" output channel for details.`;
      logger.error("Command failed", error, {
        commandId,
        resource: resourceLog
      });
      logger.show(false);
      if (isDeployDiffError(error) && error.actions.length > 0) {
        const actionLabels = [SHOW_LOGS_ACTION_LABEL, ...error.actions.map((action) => action.label)];
        const selectedActionLabel2 = await vscode8.window.showErrorMessage(userMessage, ...actionLabels);
        if (selectedActionLabel2 === SHOW_LOGS_ACTION_LABEL) {
          await vscode8.commands.executeCommand(DEPLOYDIFF_SHOW_OUTPUT_COMMAND_ID);
          return;
        }
        const selectedAction = error.actions.find((action) => action.label === selectedActionLabel2);
        if (selectedAction) {
          logger.info("Executing recovery action", {
            commandId,
            actionLabel: selectedAction.label,
            actionCommandId: selectedAction.commandId
          });
          await vscode8.commands.executeCommand(selectedAction.commandId, ...selectedAction.arguments ?? []);
        }
        return;
      }
      const selectedActionLabel = await vscode8.window.showErrorMessage(userMessage, SHOW_LOGS_ACTION_LABEL);
      if (selectedActionLabel === SHOW_LOGS_ACTION_LABEL) {
        await vscode8.commands.executeCommand(DEPLOYDIFF_SHOW_OUTPUT_COMMAND_ID);
      }
    }
  });
}

// src/commands/compareWithDeployed.ts
function registerCompareWithDeployedCommand(remoteDiffDocumentProvider, logger, diffSessionManager) {
  return registerDeployCommand("deploydiff.compareWithDeployedVersion", logger, async (resource) => {
    const uris = [];
    if (Array.isArray(resource)) {
      uris.push(...resource);
    } else if (resource) {
      uris.push(resource);
    } else {
      uris.push(getOrResolveResourceUri(void 0));
    }
    let openedCount = 0;
    const failedNames = [];
    for (const localFileUri of uris) {
      if (localFileUri.scheme !== "file") {
        continue;
      }
      try {
        await openDeployedDiff(localFileUri, remoteDiffDocumentProvider, logger);
        diffSessionManager.addOrUpdate({
          localUri: localFileUri,
          remoteUri: createRemoteDocumentUri(localFileUri)
        });
        openedCount++;
      } catch (error) {
        const name = localFileUri.path.split("/").pop() ?? localFileUri.toString();
        failedNames.push(name);
        logger.error("Failed to compare file", error, { localFile: localFileUri.fsPath });
      }
    }
    if (failedNames.length > 0 && openedCount === 0) {
      throw new Error(`Could not compare ${failedNames.join(", ")}. See the DeployDiff output channel for details.`);
    }
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
function registerDownloadFromRemoteCommand(context, remoteDiffDocumentProvider, logger) {
  return registerDeployCommand("deploydiff.downloadFromRemote", logger, async (resource) => {
    const uris = [];
    if (Array.isArray(resource)) {
      uris.push(...resource);
    } else if (resource) {
      uris.push(resource);
    } else {
      uris.push(getOrResolveResourceUri(void 0));
    }
    for (const localFileUri of uris) {
      if (localFileUri.scheme !== "file") {
        continue;
      }
      await downloadSingle(localFileUri, context, remoteDiffDocumentProvider, logger);
    }
  });
}
async function downloadSingle(localFileUri, context, remoteDiffDocumentProvider, logger) {
  const target = resolveDeploymentTarget(localFileUri);
  const configuration = vscode10.workspace.getConfiguration("deploydiff", target.workspaceFolder.uri);
  const confirmSync = configuration.get("confirmSync", true);
  const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets, logger);
  const remoteMetadata = await provider.stat(target.remoteFilePath);
  const isDirectory = remoteMetadata.type === "directory";
  logger.info("Preparing download", {
    localFile: localFileUri.fsPath,
    remotePath: target.remoteFilePath,
    isDirectory
  });
  if (confirmSync) {
    const answer = await vscode10.window.showWarningMessage(
      isDirectory ? `Replace local directory ${target.relativePath || "."} with the deployed contents from ${target.remoteFilePath}?` : `Replace local file ${target.relativePath} with the deployed version from ${target.mapping.remoteRoot}?`,
      { modal: true },
      "Download"
    );
    if (answer !== "Download") {
      logger.info("Download cancelled by user", {
        localFile: localFileUri.fsPath,
        remotePath: target.remoteFilePath
      });
      return;
    }
  }
  if (isDirectory) {
    const summary = { filesDownloaded: 0, directoriesCreated: 0 };
    await downloadDirectoryFromRemote(localFileUri, target.remoteFilePath, provider, summary, logger);
    logger.info("Download completed", {
      localFile: localFileUri.fsPath,
      remotePath: target.remoteFilePath,
      filesDownloaded: summary.filesDownloaded,
      directoriesCreated: summary.directoriesCreated
    });
    await vscode10.window.showInformationMessage(
      `Downloaded ${summary.filesDownloaded} file(s) from ${target.remoteFilePath} to ${target.relativePath || "."}.`
    );
    return;
  }
  await downloadFileFromRemote(localFileUri, target.remoteFilePath, provider, target.relativePath, logger);
  remoteDiffDocumentProvider.refresh(localFileUri);
  logger.info("Download completed", {
    localFile: localFileUri.fsPath,
    remotePath: target.remoteFilePath,
    filesDownloaded: 1
  });
  await vscode10.window.showInformationMessage(`Downloaded ${target.remoteFilePath} to ${target.relativePath}.`);
}
async function downloadDirectoryFromRemote(localDirectoryUri, remoteDirectoryPath, provider, summary, logger) {
  logger.info("Ensuring local directory exists", {
    localDirectory: localDirectoryUri.fsPath,
    remotePath: remoteDirectoryPath
  });
  await vscode10.workspace.fs.createDirectory(localDirectoryUri);
  summary.directoriesCreated += 1;
  const entries = await provider.listDirectory(remoteDirectoryPath);
  for (const entry of entries) {
    const childLocalUri = vscode10.Uri.joinPath(localDirectoryUri, entry.name);
    const childRemotePath = joinRemotePath2(remoteDirectoryPath, entry.name);
    if (entry.type === "directory") {
      await downloadDirectoryFromRemote(childLocalUri, childRemotePath, provider, summary, logger);
      continue;
    }
    await downloadFileFromRemote(childLocalUri, childRemotePath, provider, entry.name, logger);
    summary.filesDownloaded += 1;
  }
}
async function downloadFileFromRemote(localFileUri, remoteFilePath, provider, label, logger) {
  let localStat;
  try {
    localStat = await vscode10.workspace.fs.stat(localFileUri);
  } catch {
    localStat = void 0;
  }
  if (localStat) {
    const remoteMetadata = await provider.stat(remoteFilePath);
    const conflictMessage = detectSyncConflict("download", new Date(localStat.mtime), remoteMetadata);
    if (conflictMessage && !await confirmSyncConflict("download", conflictMessage, label)) {
      logger.warn("Download conflict declined by user", {
        localFile: localFileUri.fsPath,
        remotePath: remoteFilePath
      });
      return;
    }
  }
  logger.info("Downloading file", {
    localFile: localFileUri.fsPath,
    remotePath: remoteFilePath
  });
  const content = await provider.readFile(remoteFilePath);
  await vscode10.workspace.fs.writeFile(localFileUri, Buffer.from(content, "utf8"));
}

// src/commands/manageFtpPassword.ts
var vscode11 = __toESM(require("vscode"));
function registerSetFtpPasswordCommand(context, logger) {
  return registerDeployCommand("deploydiff.setFtpPassword", logger, async () => {
    const password = await vscode11.window.showInputBox({
      title: "Set DeployDiff FTP Password",
      prompt: "Password is stored in VS Code Secret Storage for this workspace session profile.",
      password: true,
      ignoreFocusOut: true
    });
    if (password === void 0) {
      return;
    }
    await context.secrets.store(DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY, password);
    await vscode11.window.showInformationMessage("DeployDiff FTP password stored in Secret Storage.");
  });
}
function registerClearFtpPasswordCommand(context, logger) {
  return registerDeployCommand("deploydiff.clearFtpPassword", logger, async () => {
    await context.secrets.delete(DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY);
    await vscode11.window.showInformationMessage("DeployDiff FTP password cleared from Secret Storage.");
  });
}

// src/commands/manageSftpPassword.ts
var vscode12 = __toESM(require("vscode"));
function registerSetSftpPasswordCommand(context, logger) {
  return registerDeployCommand("deploydiff.setSftpPassword", logger, async () => {
    const password = await vscode12.window.showInputBox({
      title: "Set DeployDiff SFTP Password",
      prompt: "Password is stored in VS Code Secret Storage for this workspace session profile.",
      password: true,
      ignoreFocusOut: true
    });
    if (password === void 0) {
      return;
    }
    await context.secrets.store(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY, password);
    await vscode12.window.showInformationMessage("DeployDiff SFTP password stored in Secret Storage.");
  });
}
function registerClearSftpPasswordCommand(context, logger) {
  return registerDeployCommand("deploydiff.clearSftpPassword", logger, async () => {
    await context.secrets.delete(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY);
    await vscode12.window.showInformationMessage("DeployDiff SFTP password cleared from Secret Storage.");
  });
}

// src/commands/uploadToRemote.ts
var vscode13 = __toESM(require("vscode"));
function registerUploadToRemoteCommand(context, remoteDiffDocumentProvider, logger) {
  return registerDeployCommand("deploydiff.uploadToRemote", logger, async (resource) => {
    const uris = [];
    if (Array.isArray(resource)) {
      uris.push(...resource);
    } else if (resource) {
      uris.push(resource);
    } else {
      uris.push(getOrResolveResourceUri(void 0));
    }
    for (const localFileUri of uris) {
      if (localFileUri.scheme !== "file") {
        continue;
      }
      await uploadSingle(localFileUri, context, remoteDiffDocumentProvider, logger);
    }
  });
}
async function uploadSingle(localFileUri, context, remoteDiffDocumentProvider, logger) {
  const target = resolveDeploymentTarget(localFileUri);
  const configuration = vscode13.workspace.getConfiguration("deploydiff", target.workspaceFolder.uri);
  const confirmSync = configuration.get("confirmSync", true);
  const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets, logger);
  const localStat = await vscode13.workspace.fs.stat(localFileUri);
  const isDirectory = (localStat.type & vscode13.FileType.Directory) !== 0;
  logger.info("Preparing upload", {
    localFile: localFileUri.fsPath,
    remotePath: target.remoteFilePath,
    isDirectory
  });
  if (confirmSync) {
    const answer = await vscode13.window.showWarningMessage(
      isDirectory ? `Upload directory ${target.relativePath || "."} to ${target.remoteFilePath}?` : `Upload ${target.relativePath} to ${target.mapping.remoteRoot}?`,
      { modal: true },
      "Upload"
    );
    if (answer !== "Upload") {
      logger.info("Upload cancelled by user", {
        localFile: localFileUri.fsPath,
        remotePath: target.remoteFilePath
      });
      return;
    }
  }
  if (isDirectory) {
    const summary = { filesUploaded: 0, directoriesCreated: 0 };
    await uploadDirectoryToRemote(localFileUri, target.remoteFilePath, provider, summary, logger);
    logger.info("Upload completed", {
      localFile: localFileUri.fsPath,
      remotePath: target.remoteFilePath,
      filesUploaded: summary.filesUploaded,
      directoriesCreated: summary.directoriesCreated
    });
    await vscode13.window.showInformationMessage(
      `Uploaded ${summary.filesUploaded} file(s) from ${target.relativePath || "."} to ${target.remoteFilePath}.`
    );
    return;
  }
  await uploadFileToRemote(localFileUri, target.remoteFilePath, provider, target.relativePath, logger);
  remoteDiffDocumentProvider.refresh(localFileUri);
  logger.info("Upload completed", {
    localFile: localFileUri.fsPath,
    remotePath: target.remoteFilePath,
    filesUploaded: 1
  });
  await vscode13.window.showInformationMessage(`Uploaded ${target.relativePath} to ${target.remoteFilePath}.`);
}
async function uploadDirectoryToRemote(localDirectoryUri, remoteDirectoryPath, provider, summary, logger) {
  logger.info("Ensuring remote directory exists", {
    localDirectory: localDirectoryUri.fsPath,
    remotePath: remoteDirectoryPath
  });
  await provider.createDirectory(remoteDirectoryPath);
  summary.directoriesCreated += 1;
  const entries = await vscode13.workspace.fs.readDirectory(localDirectoryUri);
  for (const [name, type] of entries) {
    const childLocalUri = vscode13.Uri.joinPath(localDirectoryUri, name);
    const childRemotePath = joinRemotePath2(remoteDirectoryPath, name);
    if ((type & vscode13.FileType.Directory) !== 0) {
      await uploadDirectoryToRemote(childLocalUri, childRemotePath, provider, summary, logger);
      continue;
    }
    if ((type & vscode13.FileType.File) !== 0) {
      await uploadFileToRemote(
        childLocalUri,
        childRemotePath,
        provider,
        childLocalUri.path.split("/").pop() ?? name,
        logger
      );
      summary.filesUploaded += 1;
      continue;
    }
    throw new Error(`DeployDiff cannot upload unsupported directory entry ${name}.`);
  }
}
async function uploadFileToRemote(localFileUri, remoteFilePath, provider, label, logger) {
  const localStat = await vscode13.workspace.fs.stat(localFileUri);
  if (await provider.exists(remoteFilePath)) {
    const remoteMetadata = await provider.stat(remoteFilePath);
    const conflictMessage = detectSyncConflict("upload", new Date(localStat.mtime), remoteMetadata);
    if (conflictMessage && !await confirmSyncConflict("upload", conflictMessage, label)) {
      logger.warn("Upload conflict declined by user", {
        localFile: localFileUri.fsPath,
        remotePath: remoteFilePath
      });
      return;
    }
  }
  logger.info("Uploading file", {
    localFile: localFileUri.fsPath,
    remotePath: remoteFilePath
  });
  const contentBytes = await vscode13.workspace.fs.readFile(localFileUri);
  const content = Buffer.from(contentBytes).toString("utf8");
  await provider.writeFile(remoteFilePath, content);
}

// src/logging/outputLogger.ts
var vscode14 = __toESM(require("vscode"));
function describeError(error) {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint" || typeof error === "symbol" || error === null || error === void 0) {
    return String(error);
  }
  if (typeof error === "function") {
    return `[Function ${error.name || "anonymous"}]`;
  }
  try {
    return JSON.stringify(error) ?? Object.prototype.toString.call(error);
  } catch {
    return Object.prototype.toString.call(error);
  }
}
function formatContextValue(value) {
  if (value instanceof vscode14.Uri) {
    return value.toString();
  }
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" || typeof value === "symbol" || value === null || value === void 0) {
    return String(value);
  }
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  try {
    return JSON.stringify(value) ?? Object.prototype.toString.call(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
function formatLogContext(context) {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }
  const parts = Object.entries(context).map(([key, value]) => `${key}=${formatContextValue(value)}`);
  return ` | ${parts.join(", ")}`;
}
var DeployDiffLogger = class {
  outputChannel = vscode14.window.createOutputChannel("DeployDiff");
  info(message, context) {
    this.write("INFO", message, context);
  }
  warn(message, context) {
    this.write("WARN", message, context);
  }
  error(message, error, context) {
    this.write("ERROR", message, context);
    if (error === void 0) {
      this.show(false);
      return;
    }
    const detailPrefix = `[${(/* @__PURE__ */ new Date()).toISOString()}] [ERROR] `;
    for (const line of describeError(error).split(/\r?\n/)) {
      this.outputChannel.appendLine(`${detailPrefix}${line}`);
    }
    this.show(false);
  }
  show(preserveFocus = false) {
    this.outputChannel.show(preserveFocus);
  }
  dispose() {
    this.outputChannel.dispose();
  }
  write(level, message, context) {
    this.outputChannel.appendLine(
      `[${(/* @__PURE__ */ new Date()).toISOString()}] [${level}] ${message}${formatLogContext(context)}`
    );
  }
};

// src/status/deploymentStatusIndicator.ts
var vscode15 = __toESM(require("vscode"));
var DeploymentStatusIndicator = class {
  constructor(remoteDiffDocumentProvider) {
    this.remoteDiffDocumentProvider = remoteDiffDocumentProvider;
    this.statusBarItem.name = "DeployDiff Target";
    this.statusBarItem.command = "deploydiff.compareWithDeployedVersion";
    this.update();
  }
  statusBarItem = vscode15.window.createStatusBarItem(vscode15.StatusBarAlignment.Left, 100);
  update() {
    const activeUri = vscode15.window.activeTextEditor?.document.uri;
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
var vscode16 = __toESM(require("vscode"));
var DiffDirectionIndicator = class {
  statusBarItem = vscode16.window.createStatusBarItem(vscode16.StatusBarAlignment.Left, 99);
  disposables = [];
  constructor() {
    this.statusBarItem.name = "DeployDiff Direction";
    this.disposables.push(
      vscode16.window.tabGroups.onDidChangeTabs(() => this.update()),
      vscode16.window.onDidChangeActiveTextEditor(() => this.update())
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
    const activeTab = vscode16.window.tabGroups.activeTabGroup.activeTab;
    if (!activeTab || !(activeTab.input instanceof vscode16.TabInputTextDiff)) {
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

// src/sidebar/diffSessionManager.ts
var vscode17 = __toESM(require("vscode"));
function isUriInDiffTabs(uri) {
  for (const group of vscode17.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode17.TabInputTextDiff) {
        if (tab.input.original.toString() === uri.toString() || tab.input.modified.toString() === uri.toString()) {
          return true;
        }
      }
    }
  }
  return false;
}
var DiffSessionManager = class {
  sessions = /* @__PURE__ */ new Map();
  didChangeEmitter = new vscode17.EventEmitter();
  onDidChange = this.didChangeEmitter.event;
  addOrUpdate(session) {
    const key = session.localUri.toString();
    this.sessions.set(key, session);
    this.didChangeEmitter.fire();
  }
  remove(localUri) {
    const removed = this.sessions.delete(localUri.toString());
    if (removed) {
      this.didChangeEmitter.fire();
    }
  }
  getAll() {
    return Array.from(this.sessions.values());
  }
  findByLocalUri(localUri) {
    return this.sessions.get(localUri.toString());
  }
  pruneClosedSessions() {
    const toRemove = [];
    for (const [key, session] of this.sessions) {
      const localOpen = isUriInDiffTabs(session.localUri);
      const remoteOpen = isUriInDiffTabs(session.remoteUri);
      if (!localOpen && !remoteOpen) {
        toRemove.push(key);
      }
    }
    if (toRemove.length === 0) {
      return;
    }
    for (const key of toRemove) {
      this.sessions.delete(key);
    }
    this.didChangeEmitter.fire();
  }
};

// src/sidebar/sidebarProvider.ts
var vscode18 = __toESM(require("vscode"));
var OPEN_DIFF_SESSION_COMMAND_ID = "deploydiff.openDiffSession";
function getSessionDirectionLabel(session) {
  let originalIsLocal = true;
  for (const group of vscode18.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode18.TabInputTextDiff) {
        const input = tab.input;
        const matchesSession = input.original.toString() === session.localUri.toString() && input.modified.toString() === session.remoteUri.toString();
        const matchesSwapped = input.original.toString() === session.remoteUri.toString() && input.modified.toString() === session.localUri.toString();
        if (matchesSession || matchesSwapped) {
          originalIsLocal = input.original.toString() === session.localUri.toString();
          break;
        }
      }
    }
  }
  const localDoc = vscode18.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === session.localUri.toString()
  );
  const remoteDoc = vscode18.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === session.remoteUri.toString()
  );
  const localDirty = localDoc?.isDirty ? "*" : "";
  const remoteDirty = remoteDoc?.isDirty ? "*" : "";
  return originalIsLocal ? `(local${localDirty} \u2194 remote${remoteDirty})` : `(remote${remoteDirty} \u2194 local${localDirty})`;
}
var DiffSessionTreeItem = class extends vscode18.TreeItem {
  constructor(session) {
    const fileName = session.localUri.path.split("/").pop() ?? session.localUri.toString();
    super(fileName, vscode18.TreeItemCollapsibleState.None);
    this.session = session;
    const directionLabel = getSessionDirectionLabel(session);
    this.description = `${vscode18.workspace.asRelativePath(session.localUri)} ${directionLabel}`;
    this.tooltip = session.localUri.fsPath;
    this.contextValue = "diffSession";
    this.iconPath = new vscode18.ThemeIcon("file");
    this.command = {
      command: OPEN_DIFF_SESSION_COMMAND_ID,
      title: "Open Diff Session",
      arguments: [session.localUri]
    };
  }
};
var DeployDiffSidebarProvider = class {
  constructor(manager) {
    this.manager = manager;
    this.manager.onDidChange(() => this.refresh());
    this.textDocumentChangeDisposable = vscode18.workspace.onDidChangeTextDocument(() => this.refresh());
    this.tabGroupsChangeDisposable = vscode18.window.tabGroups.onDidChangeTabs(() => this.refresh());
  }
  didChangeTreeDataEmitter = new vscode18.EventEmitter();
  textDocumentChangeDisposable;
  tabGroupsChangeDisposable;
  onDidChangeTreeData = this.didChangeTreeDataEmitter.event;
  dropMimeTypes = ["text/uri-list"];
  dragMimeTypes = [];
  dispose() {
    this.textDocumentChangeDisposable.dispose();
    this.tabGroupsChangeDisposable.dispose();
    this.didChangeTreeDataEmitter.dispose();
  }
  getTreeItem(element) {
    return element;
  }
  getChildren() {
    return this.manager.getAll().map((session) => new DiffSessionTreeItem(session));
  }
  refresh() {
    this.didChangeTreeDataEmitter.fire();
  }
  async collectFilesRecursively(uri, token) {
    const files = [];
    try {
      const stat = await vscode18.workspace.fs.stat(uri);
      if (stat.type === vscode18.FileType.File) {
        files.push(uri);
      } else if (stat.type === vscode18.FileType.Directory || stat.type === (vscode18.FileType.Directory | vscode18.FileType.SymbolicLink)) {
        const entries = await vscode18.workspace.fs.readDirectory(uri);
        for (const [name, type] of entries) {
          if (token.isCancellationRequested) {
            break;
          }
          const childUri = vscode18.Uri.joinPath(uri, name);
          if (type === vscode18.FileType.File) {
            files.push(childUri);
          } else if (type === vscode18.FileType.Directory || type === (vscode18.FileType.Directory | vscode18.FileType.SymbolicLink)) {
            const nested = await this.collectFilesRecursively(childUri, token);
            files.push(...nested);
          }
        }
      }
    } catch {
    }
    return files;
  }
  async handleDrop(_target, dataTransfer, token) {
    const uriListItem = dataTransfer.get("text/uri-list");
    if (!uriListItem) {
      return;
    }
    const uriListString = await uriListItem.asString();
    const uriStrings = uriListString.split("\n").map((s) => s.trim()).filter(Boolean);
    for (const uriString of uriStrings) {
      if (token.isCancellationRequested) {
        break;
      }
      try {
        const uri = vscode18.Uri.parse(uriString);
        if (uri.scheme === "file") {
          const files = await this.collectFilesRecursively(uri, token);
          for (const fileUri of files) {
            if (token.isCancellationRequested) {
              break;
            }
            await vscode18.commands.executeCommand("deploydiff.compareWithDeployedVersion", fileUri);
          }
        }
      } catch {
      }
    }
  }
};

// src/sidebar/diffSessionCommands.ts
var vscode19 = __toESM(require("vscode"));
var SAVE_ALL_DIFF_SESSIONS_COMMAND_ID = "deploydiff.saveAllDiffSessions";
var REMOVE_DIFF_SESSION_COMMAND_ID = "deploydiff.removeDiffSession";
function registerOpenDiffSessionCommand(manager, remoteDiffDocumentProvider, logger) {
  return vscode19.commands.registerCommand("deploydiff.openDiffSession", async (localUri) => {
    const session = manager.findByLocalUri(localUri);
    if (!session) {
      logger.warn("Diff session not found", { localFile: localUri.fsPath });
      return;
    }
    logger.info("Opening diff session from sidebar", { localFile: localUri.fsPath });
    const localDocument = await vscode19.workspace.openTextDocument(session.localUri);
    const remoteDocument = await vscode19.workspace.openTextDocument(session.remoteUri);
    const fileName = session.localUri.path.split("/").pop() ?? session.localUri.toString();
    const title = `${fileName} \u2194 ${fileName}`;
    if (remoteDocument.languageId !== localDocument.languageId) {
      await vscode19.languages.setTextDocumentLanguage(remoteDocument, localDocument.languageId);
    }
    await vscode19.commands.executeCommand("vscode.diff", session.localUri, session.remoteUri, title, {
      preview: false
    });
    logger.info("Diff session opened", { localFile: localUri.fsPath, title });
  });
}
function registerSaveAllDiffSessionsCommand(manager, logger) {
  return vscode19.commands.registerCommand(SAVE_ALL_DIFF_SESSIONS_COMMAND_ID, async () => {
    const sessions = manager.getAll();
    if (sessions.length === 0) {
      await vscode19.window.showInformationMessage("No active DeployDiff sessions to save.");
      return;
    }
    logger.info("Saving all diff sessions", { count: sessions.length });
    let savedCount = 0;
    let failedCount = 0;
    const failedFiles = [];
    for (const session of sessions) {
      const docs = vscode19.workspace.textDocuments.filter(
        (doc) => doc.uri.toString() === session.localUri.toString() || doc.uri.toString() === session.remoteUri.toString()
      );
      for (const doc of docs) {
        if (!doc.isDirty) {
          continue;
        }
        try {
          await doc.save();
          savedCount++;
          logger.info("Saved document", { uri: doc.uri.toString() });
        } catch (error) {
          failedCount++;
          const name = doc.uri.path.split("/").pop() ?? doc.uri.toString();
          failedFiles.push(name);
          logger.error("Failed to save document", error, { uri: doc.uri.toString() });
        }
      }
    }
    if (failedCount > 0) {
      await vscode19.window.showWarningMessage(
        `Saved ${savedCount} document(s). Failed to save ${failedCount}: ${failedFiles.join(", ")}`
      );
    } else if (savedCount > 0) {
      await vscode19.window.showInformationMessage(`Saved ${savedCount} document(s).`);
    } else {
      await vscode19.window.showInformationMessage("No unsaved changes in DeployDiff sessions.");
    }
    logger.info("Save all diff sessions completed", { savedCount, failedCount });
  });
}
function registerRemoveDiffSessionCommand(manager) {
  return vscode19.commands.registerCommand(REMOVE_DIFF_SESSION_COMMAND_ID, (localUri) => {
    manager.remove(localUri);
  });
}

// src/extension.ts
function activate(context) {
  const logger = new DeployDiffLogger();
  const remoteDiffDocumentProvider = new RemoteDiffDocumentProvider(context.secrets, logger);
  const deploymentStatusIndicator = new DeploymentStatusIndicator(remoteDiffDocumentProvider);
  const diffDirectionIndicator = new DiffDirectionIndicator();
  const diffSessionManager = new DiffSessionManager();
  const sidebarProvider = new DeployDiffSidebarProvider(diffSessionManager);
  logger.info("DeployDiff extension activated");
  const sidebarView = vscode20.window.createTreeView("deploydiff.diffSessions", {
    treeDataProvider: sidebarProvider,
    showCollapseAll: false,
    dragAndDropController: sidebarProvider
  });
  context.subscriptions.push(
    logger,
    deploymentStatusIndicator,
    diffDirectionIndicator,
    sidebarProvider,
    sidebarView,
    vscode20.window.onDidChangeActiveTextEditor(() => deploymentStatusIndicator.update()),
    vscode20.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("deploydiff")) {
        deploymentStatusIndicator.update();
      }
    }),
    vscode20.workspace.onDidCloseTextDocument(() => {
      diffSessionManager.pruneClosedSessions();
    }),
    vscode20.window.onDidChangeVisibleTextEditors(() => {
      diffSessionManager.pruneClosedSessions();
    }),
    vscode20.workspace.registerFileSystemProvider(
      DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
      remoteDiffDocumentProvider,
      {
        isCaseSensitive: true,
        isReadonly: false
      }
    ),
    registerCompareWithDeployedCommand(remoteDiffDocumentProvider, logger, diffSessionManager),
    registerUploadToRemoteCommand(context, remoteDiffDocumentProvider, logger),
    registerDownloadFromRemoteCommand(context, remoteDiffDocumentProvider, logger),
    registerShowOutputCommand(logger),
    registerSetFtpPasswordCommand(context, logger),
    registerClearFtpPasswordCommand(context, logger),
    registerSetSftpPasswordCommand(context, logger),
    registerClearSftpPasswordCommand(context, logger),
    registerOpenDiffSessionCommand(diffSessionManager, remoteDiffDocumentProvider, logger),
    registerSaveAllDiffSessionsCommand(diffSessionManager, logger),
    registerRemoveDiffSessionCommand(diffSessionManager)
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
