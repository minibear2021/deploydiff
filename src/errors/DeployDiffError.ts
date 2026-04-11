export type DeployDiffErrorAction = {
  label: string;
  commandId: string;
  arguments?: unknown[];
};

export class DeployDiffError extends Error {
  public constructor(
    message: string,
    public readonly actions: DeployDiffErrorAction[] = []
  ) {
    super(message);
    this.name = 'DeployDiffError';
  }
}

export function isDeployDiffError(error: unknown): error is DeployDiffError {
  return error instanceof DeployDiffError;
}