/**
 * API endpoint for listing all chat sessions
 */
import type { LoaderFunctionArgs } from 'react-router';
import { prisma } from '~/lib/db.server';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Fetch all sessions with their message count and latest message
    const sessions = await prisma.session.findMany({
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            content: true,
            role: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return Response.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt.getTime(),
        updatedAt: session.updatedAt.getTime(),
        messageCount: session._count.messages,
        lastMessage:
          session.messages[0]?.role === 'user'
            ? session.messages[0].content.substring(0, 100)
            : undefined,
      })),
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return Response.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
