import SftpClient from 'ssh2-sftp-client';
import { DeployDiffLogger } from '../logging/outputLogger';
import { RemoteDirectoryEntry, RemoteFileMetadata, RemoteFileProvider } from './RemoteFileProvider';
import { getRemoteParentDirectory } from './remotePath';
import { SftpConnectionOptions } from './sftpConfiguration';

export class SftpRemoteFileProvider implements RemoteFileProvider {
  public constructor(
    private readonly options: SftpConnectionOptions,
    private readonly logger: DeployDiffLogger
  ) {}

  public async createDirectory(remotePath: string): Promise<void> {
    await this.withClient('createDirectory', remotePath, async (client) => {
      await client.mkdir(remotePath, true);
    });
  }

  public async exists(remotePath: string): Promise<boolean> {
    return this.withClient('exists', remotePath, async (client) => Boolean(await client.exists(remotePath)));
  }

  public async listDirectory(remotePath: string): Promise<RemoteDirectoryEntry[]> {
    return this.withClient('listDirectory', remotePath, async (client) => {
      const entries = await client.list(remotePath);
      return entries.map((entry) => ({
        name: entry.name,
        type: entry.type === 'd' ? 'directory' : 'file',
        size: entry.size,
        modifiedAt: typeof entry.modifyTime === 'number' ? new Date(entry.modifyTime) : undefined
      }));
    });
  }

  public async stat(remotePath: string): Promise<RemoteFileMetadata> {
    return this.withClient('stat', remotePath, async (client) => {
      const stats = await client.stat(remotePath);
      const entryType = await client.exists(remotePath);

      return {
        type: entryType === 'd' ? 'directory' : 'file',
        size: stats.size,
        modifiedAt: typeof stats.modifyTime === 'number' ? new Date(stats.modifyTime) : undefined
      };
    });
  }

  public async readFile(remotePath: string): Promise<string> {
    return this.withClient('readFile', remotePath, async (client) => {
      const content = await client.get(remotePath);

      if (typeof content === 'string') {
        return content;
      }

      if (Buffer.isBuffer(content)) {
        return content.toString('utf8');
      }

      throw new Error(`DeployDiff SFTP returned an unsupported payload type for ${remotePath}.`);
    });
  }

  public async writeFile(remotePath: string, content: string): Promise<void> {
    await this.withClient('writeFile', remotePath, async (client) => {
      const parentDirectory = getRemoteParentDirectory(remotePath);

      if (parentDirectory !== '/') {
        const parentExists = await client.exists(parentDirectory);
        if (!parentExists) {
          await client.mkdir(parentDirectory, true);
        }
      }

      await client.put(Buffer.from(content, 'utf8'), remotePath);
    });
  }

  private async withClient<T>(
    operationName: string,
    remotePath: string,
    operation: (client: SftpClient) => Promise<T>
  ): Promise<T> {
    const client = new SftpClient('DeployDiff');

    try {
      this.logger.info('SFTP operation started', {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      await client.connect(this.options);
      const result = await operation(client);
      this.logger.info('SFTP operation completed', {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      return result;
    } catch (error) {
      this.logger.error('SFTP operation failed', error, {
        operation: operationName,
        remotePath,
        host: this.options.host,
        port: this.options.port
      });
      const message = error instanceof Error ? error.message : 'Unknown SFTP error.';
      throw new Error(`DeployDiff SFTP operation failed: ${message}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
