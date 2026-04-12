import { PassThrough, Readable } from 'node:stream';
import { Client } from 'basic-ftp';
import { RemoteFileMetadata, RemoteFileProvider } from './RemoteFileProvider';
import { FtpConnectionOptions } from './ftpConfiguration';
import { getRemoteFileName, getRemoteParentDirectory } from './remotePath';

export class FtpRemoteFileProvider implements RemoteFileProvider {
  public constructor(private readonly options: FtpConnectionOptions) {}

  public async exists(remotePath: string): Promise<boolean> {
    return this.withClient(async (client) => {
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

  public async stat(remotePath: string): Promise<RemoteFileMetadata> {
    return this.withClient(async (client) => {
      const size = await client.size(remotePath);
      const modifiedAt = await client.lastMod(remotePath).catch(() => undefined);

      return {
        size,
        modifiedAt
      };
    });
  }

  public async readFile(remotePath: string): Promise<string> {
    return this.withClient(async (client) => {
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
    await this.withClient(async (client) => {
      const parentDirectory = getRemoteParentDirectory(remotePath);

      if (parentDirectory !== '/') {
        await client.ensureDir(parentDirectory);
      }

      await client.uploadFrom(Readable.from([Buffer.from(content, 'utf8')]), remotePath);
    });
  }

  private async withClient<T>(operation: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client(10000);

    try {
      await client.access(this.options);
      return await operation(client);
    } catch (error) {
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