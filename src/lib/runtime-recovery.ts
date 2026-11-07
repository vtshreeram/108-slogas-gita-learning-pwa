/** Re-rendering cannot repair a client runtime whose module graph has gone stale. */
export function requiresPageReload(error: Error): boolean {
  return /module factory is not available|ChunkLoadError|Loading (?:CSS )?chunk .+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(`${error.name}: ${error.message}`);
}
