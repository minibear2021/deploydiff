import { PassThrough, Readable } from 'node:stream';
import { Client, FileType } from 'basic-ftp';
import { enterPassiveModeIPv4_forceControlHostIP } from 'basic-ftp/dist/transfer';
import { DeployDiffLogger } from '../logging/outputLogger';
import { RemoteDirectoryEntry, RemoteFileMetadata, RemoteFileProvider } from './RemoteFileProvider';
import { FtpConnectionOptions } from './ftpConfiguration';
import { getRemoteFileName, getRemoteParentDirectory } from './remotePath';

export class FtpRemoteFileProvider implements RemoteFileProvider {
  public constructor(
    private readonly options: FtpConnectionOptions,
    private readonly logger: DeployDiffLogger
  ) {}

  public async createDirectory(remotePath: string): Promise<void> {
    await this.withClient('createDirectory', remotePath, async (client) => {
      await client.ensureDir(remotePath);
    });
  }

  public async exists(remotePath: string): Promise<boolean> {
    return this.withClient('exists', remotePath, async (client) => {
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

  public async listDirectory(remotePath: string): Promise<RemoteDirectoryEntry[]> {
    return this.withClient('listDirectory', remotePath, async (client) => {
      const entries = await client.list(remotePath);
      return entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory || entry.type === FileType.Directory ? 'directory' : 'file',
        size: entry.size,
        modifiedAt: entry.modifiedAt
      }));
    });
  }

  public async stat(remotePath: string): Promise<RemoteFileMetadata> {
    return this.withClient('stat', remotePath, async (client) => {
      if (remotePath === '/') {
        return {
          type: 'directory',
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
        type: entry.isDirectory || entry.type === FileType.Directory ? 'directory' : 'file',
        size: entry.size,
        modifiedAt: entry.modifiedAt
      };
    });
  }

  public async readFile(remotePath: string): Promise<string> {
    return this.withClient('readFile', remotePath, async (client) => {
      const stream = new PassThrough();
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      await client.downloadTo(stream, remotePath);
      return Buffer.concat(chunks).toString('utf8');
    });
  }

  public async writeFile(remotePath: string, content: string): Promise<void> {
    await this.withClient('writeFile', remotePath, async (client) => {
      const parentDirectory = getRemoteParentDirectory(remotePath);

      if (parentDirectory !== '/') {
        await client.ensureDir(parentDirectory);
      }

      await client.uploadFrom(Readable.from([Buffer.from(content, 'utf8')]), remotePath);
    });
  }

  private async withClient<T>(
    operationName: string,
    remotePath: string,
    operation: (client: Client) => Promise<T>
  ): Promise<T> {
    const client = new Client(this.options.timeoutMs);

    if (this.options.passiveModeStrategy === 'ignorePasvAddress') {
      client.prepareTransfer = enterPassiveModeIPv4_forceControlHostIP;
    }

    try {
      this.logger.info('FTP operation started', {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      await client.access(this.options);
      const result = await operation(client);
      this.logger.info('FTP operation completed', {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      return result;
    } catch (error) {
      this.logger.error('FTP operation failed', error, {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      const message = error instanceof Error ? error.message : 'Unknown FTP error.';
      throw new Error(`DeployDiff FTP operation failed: ${message}`);
    } finally {
      client.close();
    }
  }
}

function isMissingPathError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /550|not found|no such file|cannot find/i.test(error.message);
}
