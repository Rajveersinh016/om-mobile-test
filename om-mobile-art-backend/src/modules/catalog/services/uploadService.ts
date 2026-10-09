import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../../../core/exceptions/exceptions.js';
import { logger } from '../../../services/logger.js';

export interface StorageProvider {
  save(buffer: Buffer, filename: string): Promise<string>;
}

export class LocalStorageProvider implements StorageProvider {
  async save(buffer: Buffer, filename: string): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const destPath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(destPath, buffer);
    return filename;
  }
}

export class UploadService {
  private provider: StorageProvider;

  constructor(provider: StorageProvider = new LocalStorageProvider()) {
    this.provider = provider;
  }

  setProvider(provider: StorageProvider) {
    this.provider = provider;
  }

  async upload(base64Content: string, originalFilename: string): Promise<{ key: string; mimeType: string }> {
    // 1. Check directory traversal attempts
    if (originalFilename.includes('..') || originalFilename.includes('/') || originalFilename.includes('\\')) {
      logger.warn({ originalFilename }, 'Suspicious upload attempt: Directory traversal detected in filename');
      throw new ValidationError('Invalid filename structure');
    }

    // Sanitize filename
    const cleanOriginalFilename = path.basename(originalFilename).replace(/[^a-zA-Z0-9.-]/g, '_');
    const extension = path.extname(cleanOriginalFilename).toLowerCase();

    // Check executable/svg extensions
    const bannedExtensions = ['.exe', '.dll', '.bat', '.cmd', '.sh', '.js', '.ts', '.vbs', '.scr', '.svg'];
    if (bannedExtensions.includes(extension)) {
      logger.warn({ originalFilename, extension }, 'Suspicious upload attempt: Banned file extension');
      throw new ValidationError('File extension is not allowed');
    }

    let base64Data = base64Content;
    if (base64Data.includes(';base64,')) {
      base64Data = base64Data.split(';base64,')[1];
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch (err) {
      logger.error({ err }, 'Image upload failure: Invalid base64 encoding');
      throw new ValidationError('Invalid base64 encoding');
    }

    if (buffer.length === 0) {
      logger.error('Image upload failure: Uploaded file is empty');
      throw new ValidationError('Uploaded file is empty');
    }

    if (buffer.length > 10 * 1024 * 1024) {
      logger.error({ fileSize: buffer.length }, 'Image upload failure: File size exceeds 10MB limit');
      throw new ValidationError('File size exceeds maximum limit of 10MB');
    }

    // 2. SVG detection in binary content
    const preview = buffer.toString('utf8', 0, Math.min(buffer.length, 512));
    if (preview.includes('<svg') || preview.includes('<?xml')) {
      logger.warn({ originalFilename }, 'Suspicious upload attempt: SVG content detected in binary');
      throw new ValidationError('SVG uploads are not allowed');
    }

    // 3. Executable detection (MZ / ELF headers)
    if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
      logger.warn({ originalFilename }, 'Suspicious upload attempt: MZ executable header detected');
      throw new ValidationError('Executable files are not allowed');
    }
    if (buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
      logger.warn({ originalFilename }, 'Suspicious upload attempt: ELF executable header detected');
      throw new ValidationError('Executable files are not allowed');
    }

    // Validate signature and get mime type
    const signatureInfo = this.validateSignatureAndGetMime(buffer);
    if (!signatureInfo) {
      logger.warn({ originalFilename }, 'Suspicious upload attempt: Unsupported or invalid file signature/MIME type');
      throw new ValidationError('Unsupported or invalid file signature/MIME type');
    }

    // Ensure extension matches MIME type
    let targetExt = extension;
    if (signatureInfo.mime === 'image/jpeg' && !['.jpg', '.jpeg'].includes(extension)) {
      targetExt = '.jpg';
    } else if (signatureInfo.mime === 'image/png' && extension !== '.png') {
      targetExt = '.png';
    } else if (signatureInfo.mime === 'image/webp' && extension !== '.webp') {
      targetExt = '.webp';
    }

    // Validate dimensions
    if (signatureInfo.width <= 0 || signatureInfo.height <= 0 || signatureInfo.width > 10000 || signatureInfo.height > 10000) {
      logger.error({ width: signatureInfo.width, height: signatureInfo.height }, 'Image upload failure: Invalid or corrupted image dimensions');
      throw new ValidationError('Invalid or corrupted image dimensions');
    }

    // Generate random UUID filename
    const uniqueFilename = `${uuidv4()}${targetExt}`;

    try {
      const key = await this.provider.save(buffer, uniqueFilename);
      return {
        key,
        mimeType: signatureInfo.mime,
      };
    } catch (err: any) {
      logger.error({ err }, 'Image upload failure: Failed to save file via storage provider');
      throw new ValidationError(`Failed to save image file: ${err.message}`);
    }
  }

  private validateSignatureAndGetMime(buffer: Buffer): { mime: string; width: number; height: number } | null {
    if (buffer.length < 8) return null;

    // 1. PNG
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A
    ) {
      if (buffer.length < 24) return null;
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { mime: 'image/png', width, height };
    }

    // 2. JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      try {
        let offset = 2;
        while (offset < buffer.length) {
          while (offset < buffer.length && buffer[offset] !== 0xFF) {
            offset++;
          }
          if (offset >= buffer.length) break;
          while (offset < buffer.length && buffer[offset] === 0xFF) {
            offset++;
          }
          if (offset >= buffer.length) break;
          const marker = buffer[offset];
          offset++;

          const isSOF =
            (marker >= 0xC0 && marker <= 0xC3) ||
            (marker >= 0xC5 && marker <= 0xC7) ||
            (marker >= 0xC9 && marker <= 0xCB) ||
            (marker >= 0xCD && marker <= 0xCF);

          if (isSOF) {
            if (offset + 7 > buffer.length) return null;
            const height = buffer.readUInt16BE(offset + 3);
            const width = buffer.readUInt16BE(offset + 5);
            return { mime: 'image/jpeg', width, height };
          } else {
            if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
              continue;
            }
            if (offset + 2 > buffer.length) break;
            const length = buffer.readUInt16BE(offset);
            offset += length;
          }
        }
      } catch (e) {
        return null;
      }
      return null;
    }

    // 3. WEBP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 && // "RIFF"
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50 // "WEBP"
    ) {
      try {
        const format = buffer.toString('ascii', 12, 16);
        if (format === 'VP8 ') {
          if (buffer.length < 30) return null;
          if (buffer[23] !== 0x9D || buffer[24] !== 0x01 || buffer[25] !== 0x2A) {
            return null;
          }
          const width = buffer.readUInt16LE(26) & 0x3FFF;
          const height = buffer.readUInt16LE(28) & 0x3FFF;
          return { mime: 'image/webp', width, height };
        } else if (format === 'VP8L') {
          if (buffer.length < 25) return null;
          if (buffer[20] !== 0x2F) return null;
          const val = buffer.readUInt32LE(21);
          const width = (val & 0x3FFF) + 1;
          const height = ((val >> 14) & 0x3FFF) + 1;
          return { mime: 'image/webp', width, height };
        } else if (format === 'VP8X') {
          if (buffer.length < 30) return null;
          const width = (buffer.readUInt32LE(24) & 0xFFFFFF) + 1;
          const height = (buffer.readUInt32LE(27) & 0xFFFFFF) + 1;
          return { mime: 'image/webp', width, height };
        }
      } catch (e) {
        return null;
      }
    }

    return null;
  }
}

export const uploadService = new UploadService();
