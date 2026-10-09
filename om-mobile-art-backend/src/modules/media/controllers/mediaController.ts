import { FastifyRequest, FastifyReply } from 'fastify';
import { cloudinaryService } from '../../../shared/services/cloudinaryService.js';
import { ValidationError } from '../../../core/exceptions/exceptions.js';
import { env } from '../../../config/env.js';

export class MediaController {
  /**
   * Upload single image (via multipart or JSON base64 / URL)
   */
  async uploadSingle(request: FastifyRequest, reply: FastifyReply) {
    let subfolder = 'general';
    let result;

    try {
      if (request.isMultipart()) {
        const data = await request.file();
        if (!data) {
          throw new ValidationError('No file provided in multipart request');
        }

        const fields: any = data.fields;
        if (fields && fields.folder && fields.folder.value) {
          subfolder = fields.folder.value;
        }

        console.log(`[MediaController] Multipart File Upload Request:`, {
          filename: data.filename,
          mimetype: data.mimetype,
          folder: subfolder,
          cloudName: env.CLOUDINARY_CLOUD_NAME
        });

        // Check mime type (images and videos)
        const allowedMimes = [
          'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif',
          'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
        ];
        if (!allowedMimes.includes(data.mimetype)) {
          throw new ValidationError(`Invalid file type ${data.mimetype}. Allowed types: ${allowedMimes.join(', ')}`);
        }

        const buffer = await data.toBuffer();
        result = await cloudinaryService.uploadBuffer(buffer, subfolder, data.filename);
      } else {
        const body = request.body as { source?: string; image?: string; folder?: string };
        const source = body.source || body.image;
        if (!source) {
          throw new ValidationError('No image source or base64 data provided');
        }
        if (body.folder) subfolder = body.folder;

        console.log(`[MediaController] Source Upload Request:`, {
          folder: subfolder,
          cloudName: env.CLOUDINARY_CLOUD_NAME
        });

        result = await cloudinaryService.uploadBase64OrUrl(source, subfolder);
      }

      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[MediaController Error]', {
        message: err.message || err,
        stack: err.stack,
        folder: subfolder,
        cloudName: env.CLOUDINARY_CLOUD_NAME
      });
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: err.message || 'Cloudinary upload failed',
        message: err.message || 'Cloudinary upload failed'
      });
    }
  }

  /**
   * Upload multiple images
   */
  async uploadMultiple(request: FastifyRequest, reply: FastifyReply) {
    const subfolder = (request.query as any)?.folder || 'general';
    const results = [];

    try {
      if (request.isMultipart()) {
        const parts = request.files();
        for await (const part of parts) {
          if (part.file) {
            const buffer = await part.toBuffer();
            const uploaded = await cloudinaryService.uploadBuffer(buffer, subfolder, part.filename);
            results.push(uploaded);
          }
        }
      } else {
        const body = request.body as { images: string[]; folder?: string };
        if (!Array.isArray(body.images) || body.images.length === 0) {
          throw new ValidationError('No image array provided');
        }
        const targetFolder = body.folder || subfolder;
        for (const img of body.images) {
          const uploaded = await cloudinaryService.uploadBase64OrUrl(img, targetFolder);
          results.push(uploaded);
        }
      }

      return reply.status(201).send({
        success: true,
        data: results,
      });
    } catch (err: any) {
      console.error('[MediaController Upload Multiple Error]', err);
      return reply.status(err.statusCode || 500).send({
        success: false,
        message: err.message || 'Multiple upload failed'
      });
    }
  }

  /**
   * Replace existing Cloudinary image
   */
  async replace(request: FastifyRequest, reply: FastifyReply) {
    let oldPublicId: string | undefined;
    let subfolder = 'general';
    let newResult;

    if (request.isMultipart()) {
      const data = await request.file();
      if (!data) throw new ValidationError('No file provided');
      const fields: any = data.fields;
      if (fields?.oldPublicId?.value) oldPublicId = fields.oldPublicId.value;
      if (fields?.folder?.value) subfolder = fields.folder.value;

      const buffer = await data.toBuffer();
      newResult = await cloudinaryService.uploadBuffer(buffer, subfolder, data.filename);
      if (oldPublicId) {
        cloudinaryService.deleteImage(oldPublicId).catch(() => {});
      }
    } else {
      const body = request.body as { oldPublicId?: string; source?: string; folder?: string };
      if (!body.source) throw new ValidationError('No source image provided');
      oldPublicId = body.oldPublicId;
      subfolder = body.folder || 'general';

      const uploaded = await cloudinaryService.uploadBase64OrUrl(body.source, subfolder);
      if (oldPublicId) {
        cloudinaryService.deleteImage(oldPublicId).catch(() => {});
      }
      newResult = uploaded;
    }

    return reply.status(200).send({
      success: true,
      data: newResult,
    });
  }

  /**
   * Delete an image from Cloudinary by publicId
   */
  async delete(request: FastifyRequest, reply: FastifyReply) {
    const body = (request.body as { publicId?: string }) || {};
    const query = (request.query as { publicId?: string }) || {};
    const params = (request.params as { publicId?: string; '*': string }) || {};
    
    let publicId = body.publicId || query.publicId || params.publicId || params['*'];
    if (!publicId) {
      throw new ValidationError('publicId is required to delete an image');
    }

    console.log(`[MediaController] Delete request for publicId '${publicId}'`);
    const success = await cloudinaryService.deleteImage(publicId);

    return reply.status(200).send({
      success,
      message: success ? 'Image deleted from Cloudinary successfully' : 'Failed to delete image from Cloudinary',
    });
  }

  /**
   * List assets for Admin Media Library
   */
  async listMedia(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({
      success: true,
      data: [],
      nextCursor: null,
    });
  }
}

export const mediaController = new MediaController();
