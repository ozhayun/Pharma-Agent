import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAllMedications } from '../db/data';

export async function registerMedicationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/medications',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const medications = getAllMedications();
        return reply.code(200).send({
        medications: medications.map(med => ({
          name: med.name,
          hebrewName: med.hebrew?.name,
        })),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error }, 'Error fetching medications');
        return reply.code(500).send({
          error: 'Internal server error',
          message: 'Failed to fetch medications',
          details: errorMessage,
        });
      }
    }
  );
}

