import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { env } from '../../config/env.js';

// Configure Cloudinary once using validated environment config
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  createdAt?: string;
}

export class CloudinaryService {
  private baseFolder = env.CLOUDINARY_FOLDER || 'om-mobile-art';

  /**
   * Upload an image buffer to Cloudinary with automatic optimization
   */
  async uploadBuffer(
    buffer: Buffer,
    subfolder: string = 'general',
    customFilename?: string
  ): Promise<CloudinaryUploadResult> {
    const cleanSubfolder = subfolder.replace(/^\/+|\/+$/g, '');
    const folderPath = `${this.baseFolder}/${cleanSubfolder}`;

    return new Promise((resolve, reject) => {
      const uploadOptions: any = {
        folder: folderPath,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      };

      if (customFilename) {
        uploadOptions.public_id = customFilename.replace(/\.[^/.]+$/, '');
      }

      console.log(`[CloudinaryService] Initiating buffer upload (${buffer.length} bytes) to folder '${folderPath}'...`);

      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error || !result) {
            console.error('[CloudinaryService] Upload Stream Error:', {
              error,
              folder: folderPath,
              cloudName: env.CLOUDINARY_CLOUD_NAME
            });
            return reject(error || new Error('Cloudinary upload stream returned empty response'));
          }
          console.log(`[CloudinaryService] Upload Success! Public ID: '${result.public_id}', URL: '${result.secure_url}'`);
          resolve(this.formatResult(result));
        }
      );

      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(stream);
    });
  }

  /**
   * Upload an image from base64 string or remote URL
   */
  async uploadBase64OrUrl(
    source: string,
    subfolder: string = 'general'
  ): Promise<CloudinaryUploadResult> {
    const cleanSubfolder = subfolder.replace(/^\/+|\/+$/g, '');
    const folderPath = `${this.baseFolder}/${cleanSubfolder}`;

    console.log(`[CloudinaryService] Initiating source upload to folder '${folderPath}'...`);

    try {
      const result = await cloudinary.uploader.upload(source, {
        folder: folderPath,
        fetch_format: 'auto',
        quality: 'auto',
        use_filename: true,
        unique_filename: true,
      });

      console.log(`[CloudinaryService] Upload Success! Public ID: '${result.public_id}', URL: '${result.secure_url}'`);
      return this.formatResult(result);
    } catch (err: any) {
      console.error('[CloudinaryService] Upload Source Error:', {
        error: err.message || err,
        folder: folderPath,
        cloudName: env.CLOUDINARY_CLOUD_NAME
      });
      throw err;
    }
  }

  /**
   * Delete an image from Cloudinary using its public_id
   */
  async deleteImage(publicId: string): Promise<boolean> {
    if (!publicId) return false;
    try {
      console.log(`[CloudinaryService] Deleting Cloudinary asset '${publicId}'...`);
      const res = await cloudinary.uploader.destroy(publicId);
      console.log(`[CloudinaryService] Delete result for '${publicId}':`, res);
      return res.result === 'ok' || res.result === 'not found';
    } catch (err) {
      console.error(`[CloudinaryService] Delete failed for '${publicId}':`, err);
      return false;
    }
  }

  private formatResult(result: any): CloudinaryUploadResult {
    return {
      url: result.secure_url || result.url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      createdAt: result.created_at || new Date().toISOString(),
    };
  }
}

export const cloudinaryService = new CloudinaryService();
