/**
 * API endpoint for managing website configurations
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { prisma } from '../lib/prisma';

/**
 * GET /api/config - Fetch all configurations or a specific one by key
 * Query params: ?key=<config_key> (optional)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (key) {
      // Fetch specific configuration by key
      const config = await prisma.configuration.findUnique({
        where: { key },
      });

      if (!config) {
        return Response.json({ error: 'Configuration not found' }, { status: 404 });
      }

      return Response.json({ config });
    }

    // Fetch all configurations
    const configs = await prisma.configuration.findMany({
      orderBy: {
        key: 'asc',
      },
    });

    return Response.json({ configs });
  } catch (error) {
    console.error('Error fetching configurations:', error);
    return Response.json({ error: 'Failed to fetch configurations' }, { status: 500 });
  }
}

/**
 * POST /api/config - Create or update a configuration
 * Body: { key: string, value: string, type: string, description?: string }
 *
 * PUT /api/config - Update an existing configuration
 * Body: { key: string, value: string, type: string, description?: string }
 *
 * DELETE /api/config - Delete a configuration
 * Body: { key: string }
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const method = request.method;
    const body = await request.json();

    if (method === 'DELETE') {
      const { key } = body;

      if (!key) {
        return Response.json({ error: 'Key is required' }, { status: 400 });
      }

      await prisma.configuration.delete({
        where: { key },
      });

      return Response.json({ success: true, message: 'Configuration deleted' });
    }

    if (method === 'POST' || method === 'PUT') {
      const { key, value, type, description } = body;

      if (!key || !value || !type) {
        return Response.json(
          { error: 'Key, value, and type are required' },
          { status: 400 }
        );
      }

      // Validate type
      const validTypes = ['url', 'markdown', 'text', 'json'];
      if (!validTypes.includes(type)) {
        return Response.json(
          { error: `Type must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }

      // Upsert configuration (create or update)
      const config = await prisma.configuration.upsert({
        where: { key },
        update: {
          value,
          type,
          description,
        },
        create: {
          key,
          value,
          type,
          description,
        },
      });

      return Response.json({ success: true, config });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    console.error('Error managing configuration:', error);
    return Response.json({ error: 'Failed to manage configuration' }, { status: 500 });
  }
}
