import { FastifyInstance } from 'fastify';
import { mediaController } from './controllers/mediaController.js';

export async function mediaRoutes(app: FastifyInstance) {
  app.post('/upload', (req, reply) => mediaController.uploadSingle(req, reply));
  app.post('/upload-multiple', (req, reply) => mediaController.uploadMultiple(req, reply));
  app.post('/replace', (req, reply) => mediaController.replace(req, reply));
  app.delete('/delete', (req, reply) => mediaController.delete(req, reply));
  app.delete('/delete/*', (req, reply) => mediaController.delete(req, reply));
  app.post('/delete', (req, reply) => mediaController.delete(req, reply));
  app.get('/list', (req, reply) => mediaController.listMedia(req, reply));
}
