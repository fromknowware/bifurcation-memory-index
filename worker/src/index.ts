import { Env } from './types';
import { RamFeedAgent } from './ram-feed-agent';

export { RamFeedAgent };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/ram-feed')) {
      const id = env.RAM_FEED_AGENT.idFromName('ram-index');
      const stub = env.RAM_FEED_AGENT.get(id);
      const headers = new Headers(request.headers);
      headers.set('x-partykit-namespace', 'RAM_FEED_AGENT');
      headers.set('x-partykit-room', 'ram-index');
      return stub.fetch(new Request(request, { headers }));
    }

    if (path === '/health') {
      return Response.json({
        status: 'healthy',
        service: 'RAM Index Agent',
        agents: ['RamFeedAgent'],
        workerSeesToken: !!(env.RAINDROP_API_TOKEN),
        workerSeesGithub: !!(env.GITHUB_TOKEN),
        collectionId: env.RAINDROP_COLLECTION_ID,
      });
    }

    return new Response('RAM Index Agent', { status: 200 });
  },
};
