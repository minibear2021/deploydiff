import SftpClient from 'ssh2-sftp-client';
import { RemoteFileProvider } from './RemoteFileProvider';
import { SftpConnectionOptions } from './sftpConfiguration';

export class SftpRemoteFileProvider implements RemoteFileProvider {
  public constructor(private readonly options: SftpConnectionOptions) {}

  public async exists(remotePath: string): Promise<boolean> {
    return this.withClient(async (client) => Boolean(await client.exists(remotePath)));
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

export function getRemoteParentDirectory(remotePath: string): string {
  const normalizedPath = remotePath.replace(/\/+/g, '/');
  const lastSlashIndex = normalizedPath.lastIndexOf('/');

  if (lastSlashIndex <= 0) {
    return '/';
  }

  return normalizedPath.slice(0, lastSlashIndex) || '/';
}