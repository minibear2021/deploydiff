import SftpClient from 'ssh2-sftp-client';
import { RemoteFileMetadata, RemoteFileProvider } from './RemoteFileProvider';
import { getRemoteParentDirectory } from './remotePath';
import { SftpConnectionOptions } from './sftpConfiguration';

export class SftpRemoteFileProvider implements RemoteFileProvider {
  public constructor(private readonly options: SftpConnectionOptions) {}

  public async createDirectory(remotePath: string): Promise<void> {
    await this.withClient(async (client) => {
      await client.mkdir(remotePath, true);
    });
  }

  public async exists(remotePath: string): Promise<boolean> {
    return this.withClient(async (client) => Boolean(await client.exists(remotePath)));
  }

  public async stat(remotePath: string): Promise<RemoteFileMetadata> {
    return this.withClient(async (client) => {
      const stats = await client.stat(remotePath);

      return {
        size: stats.size,
        modifiedAt: typeof stats.modifyTime === 'number' ? new Date(stats.modifyTime) : undefined
      };
    });
  }

  public async readFile(remotePath: string): Promise<string> {
    return this.withClient(async (client) => {
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
    await this.withClient(async (client) => {
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

  private async withClient<T>(operation: (client: SftpClient) => Promise<T>): Promise<T> {
    const client = new SftpClient('DeployDiff');

    try {
      await client.connect(this.options);
      return await operation(client);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SFTP error.';
      throw new Error(`DeployDiff SFTP operation failed: ${message}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}