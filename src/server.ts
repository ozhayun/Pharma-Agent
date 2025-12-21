import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { registerChatRoutes } from './routes/chat';
import { registerMedicationRoutes } from './routes/medications';
import path from 'path';
import logger from './utils/logger';

async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      } : undefined,
    },
  });

  await server.register(cors, {
    origin: true,
  });

  const publicPath = path.join(process.cwd(), 'public');
  await server.register(fastifyStatic, {
    root: publicPath,
    prefix: '/',
  });

  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  server.get('/config', async () => {
    return { isDebug: process.env.IS_DEBUG === 'true' };
  });

  await server.register(registerChatRoutes);
  await server.register(registerMedicationRoutes);

  return server;
}

async function start() {
  const server = await buildServer();

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    server.log.info(`Server listening on http://${host}:${port}`);
    server.log.info(`Debug mode: ${process.env.IS_DEBUG === 'true'}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { buildServer, start };
