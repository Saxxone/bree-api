import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { join, dirname, extname } from 'path';
import { constants } from 'fs';

const execPromise = promisify(exec);

export async function compressFiles(
  files: Array<Express.Multer.File>,
): Promise<Array<Express.Multer.File>> {
  await Promise.all(files.map(compressFile));
  return files;
}

export async function compressFile(file: Express.Multer.File) {
  if (file.mimetype.startsWith('image/')) {
    await compressImage(file);
  } else if (file.mimetype.startsWith('video/')) {
    await compressVideo(file);
  } else if (file.mimetype.startsWith('audio/')) {
    await compressAudio(file);
  }
}

export async function compressImage(file: Express.Multer.File) {
  try {
    let compressedImageBuffer: Buffer;

    const format = file.mimetype.split('/')[1]?.toLowerCase();
    const image = sharp(file.path);
    const metadata = await image.metadata();

    const maxWidth = 3000;
    const maxHeight = 3000;
    let width = metadata.width;
    let height = metadata.height;

    if (width > maxWidth || height > maxHeight) {
      if (width > height) {
        height = Math.round((maxHeight / maxWidth) * width);
        width = maxWidth;
      } else {
        width = Math.round((maxWidth / maxHeight) * height);
        height = maxHeight;
      }
    }

    switch (format) {
      case 'jpeg':
      case 'jpg':
        compressedImageBuffer = await image
          .resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer();
        break;
      case 'png':
        compressedImageBuffer = await image
          .resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .png({ compressionLevel: 9 })
          .toBuffer();
        break;
      case 'webp':
        compressedImageBuffer = await image
          .resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toBuffer();
        break;

      default:
        console.warn(
          `Unsupported image format ${format} for compression. Skipping compression for ${file.originalname}`,
        );
        return;
    }

    await fs.writeFile(file.path, compressedImageBuffer);
  } catch (error) {
    console.error(`Error compressing image ${file.originalname}:`, error);
  }
}

export async function compressVideo(file: Express.Multer.File) {
  const uniqueId = randomUUID();
  const outputPath = `${file.path}_${uniqueId}_compressed.mp4`;
  try {
    const command = `ffmpeg -i "${file.path}" -vcodec libx264 -crf 28 -preset veryfast -movflags +faststart "${outputPath}"`;
    await execPromise(command); // Execute FFmpeg
    await fs.unlink(file.path);
    await fs.rename(outputPath, file.path);

    const fileExtension = extname(file.originalname);
    const newFileName = `${file.originalname.split('.')[0]}_${uniqueId}${fileExtension}`;

    file.path = join(dirname(file.path), newFileName);
    file.filename = newFileName;

    console.log(`Compressed video: ${file.originalname}`);
  } catch (error) {
    console.error(`Error compressing video ${file.originalname}:`, error);

    if (error instanceof Error && (error as any).stderr) {
      console.error('FFmpeg stderr:', (error as any).stderr);
    }
    await fs.access(outputPath, constants.F_OK);
    await fs.unlink(outputPath);
  }
}

export async function compressAudio(file: Express.Multer.File) {
  const uniqueId = randomUUID();
  const outputPath = `${file.path}_${uniqueId}_compressed.mp3`;

  try {
    const command = `ffmpeg -i "${file.path}" -vn -ar 44100 -ab 128k -c:a libmp3lame "${outputPath}"`;
    await execPromise(command);

    await fs.unlink(file.path); // Use await
    await fs.rename(outputPath, file.path);

    const fileExtension = extname(file.originalname);
    const newFileName = `${file.originalname.split('.')[0]}_${uniqueId}${fileExtension}`;

    file.path = join(dirname(file.path), newFileName);
    file.filename = newFileName;

    console.log(`Compressed audio: ${file.originalname}`);
  } catch (error) {
    console.error(`Error compressing audio ${file.originalname}:`, error);
    if (error instanceof Error && (error as any).stderr) {
      console.error('FFmpeg stderr:', (error as any).stderr);
    }

    await fs.access(outputPath, constants.F_OK);
    await fs.unlink(outputPath);
  }
}
