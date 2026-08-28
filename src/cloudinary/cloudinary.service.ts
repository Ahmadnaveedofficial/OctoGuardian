import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

/**
 * Cloudinary Storage Integration for Media Files
 */
@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Uploads raw buffer stream directly to Cloudinary
   */
  async uploadImage(
    file: Express.Multer.File,
    folder = 'avatars',
  ): Promise<UploadApiResponse> {
    if (!file) throw new BadRequestException('No file provided');

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          transformation: [{ width: 500, height: 500, crop: 'limit' }],
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result)
            return reject(new Error('Cloudinary response undefined'));
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Destroys existing image asset by public ID
   */
  async deleteImage(publicId: string): Promise<void> {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  }
}
