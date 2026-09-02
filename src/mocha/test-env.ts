import { execFileSync } from 'node:child_process';
import { TestWorkflowEnvironment } from '@temporalio/testing';

function findTemporalCli(): string | undefined {
  if (process.env.TEMPORAL_CLI_PATH) {
    return process.env.TEMPORAL_CLI_PATH;
  }

  try {
    return execFileSync('where.exe', ['temporal'], {
      encoding: 'utf8',
    })
      .split(/\r?\n/)
      .map((path) => path.trim())
      .find(Boolean);
  } catch {
    return undefined;
  }
}

export function createLocalTestEnvironment() {
  const cliPath = findTemporalCli();

  return TestWorkflowEnvironment.createLocal(
    cliPath
      ? { server: { executable: { type: 'existing-path', path: cliPath } } }
      : undefined,
  );
}
