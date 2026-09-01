export function getRuntimeEnv(name: string): string | undefined {
  const netlify = (globalThis as typeof globalThis & {
    Netlify?: { env?: { get?: (key: string) => string | undefined } };
  }).Netlify;
  return netlify?.env?.get?.(name) ?? process.env[name];
}
