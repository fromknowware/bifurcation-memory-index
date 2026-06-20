export interface Env {
  RAM_FEED_AGENT: DurableObjectNamespace;
  CONFIG: KVNamespace;

  // Secrets — set via: wrangler secret put <NAME>
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN: string;
  RAINDROP_API_TOKEN: string;
  RAINDROP_COLLECTION_ID: string;
}
