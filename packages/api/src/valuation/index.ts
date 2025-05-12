// Exports for valuation module and Fastify plugin 
export { runValuationJob } from './orchestrator';

// Potentially, a Fastify plugin could be defined here as well
// to expose an endpoint for triggering the job, e.g.:
/*
import { FastifyInstance } from 'fastify';
import { runValuationJob } from './orchestrator';

async function valuationPlugin(fastify: FastifyInstance, opts: any) {
  fastify.post('/admin/valuation/reprocess', 
    { 
      // Add admin authentication/authorization hook here
      // preHandler: [fastify.adminAuth] 
    },
    async (request, reply) => {
      try {
        // Do not await if you want to return immediately
        runValuationJob().catch(err => {
          fastify.log.error({ err, jobId: 'manual-reprocess' }, 'Manual valuation reprocess job failed in background');
        });
        return reply.status(202).send({ message: 'Valuation reprocessing job started in background.' });
      } catch (error) {
        fastify.log.error(error, 'Failed to start valuation reprocessing job');
        return reply.status(500).send({ message: 'Failed to start valuation reprocessing job' });
      }
    }
  );
}

export default valuationPlugin;
*/ 