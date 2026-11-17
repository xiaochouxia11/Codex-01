const configuredPort = process.env.SIWC_TEST_PORT ?? '4318';
if (
  !/^\d+$/.test(configuredPort) ||
  Number(configuredPort) < 1024 ||
  Number(configuredPort) > 65535
) {
  throw new Error('SIWC_TEST_PORT must be an unprivileged TCP port between 1024 and 65535.');
}

export const testPort = Number(configuredPort);
export const testOrigin = `http://127.0.0.1:${testPort}`;
