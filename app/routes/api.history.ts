/**
 * API endpoint for fetching chat history
 */
import type { LoaderFunctionArgs } from 'react-router';
import { prisma } from '../lib/db.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return Response.json({ error: 'Session ID is required' }, { status: 400 });
  }

  try {
    // Fetch messages for the session
    const messages = await prisma.message.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        role: true,
        content: true,
        audioUrl: true,
        createdAt: true,
      },
    });

    return Response.json({
      sessionId,
      messages: messages.map((msg) => ({
        id: msg.id,
        sessionId,
        role: msg.role,
        content: msg.content,
        audioUrl: msg.audioUrl,
        createdAt: msg.createdAt.getTime(),
      })),
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return Response.json({ error: 'Failed to fetch chat history' }, { status: 500 });
  }
}
