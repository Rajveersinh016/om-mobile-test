import { FastifyInstance } from 'fastify';
import { ContactController } from './contact.controller.js';

export async function contactRoutes(app: FastifyInstance) {
  app.post('/contact', ContactController.submitContactForm);
}
