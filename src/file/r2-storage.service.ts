import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import type { Response } from 'express';
import type { Request } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { parseSingleByteRange } from './range-bytes';

export type R2EnvConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private client: S3Client | null = null;

  /** Returns null when R2 env is incomplete (caller should treat as misconfiguration). */
  getConfig(): R2EnvConfig | null {
    const accountId = process.env.R2_ACCOUNT_ID?.trim();
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
    const bucket = process.env.R2_BUCKET?.trim();
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      return null;
    }
    return { accountId, accessKeyId, secretAccessKey, bucket };
  }

  private getClient(): S3Client {
    const cfg = this.getConfig();
    if (!cfg) {
      throw new Error('R2 is not configured (missing env vars)');
    }
    if (!this.client) {
      const endpoint = `https://${cfg.accountId}.r2.cloudflarestorage.com`;
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey,
        },
        forcePathStyle: true,
      });
    }
    return this.client;
  }

  async headObjectByteLength(key: string): Promise<number> {
    const cfg = this.getConfig();
    if (!cfg) {
      throw new Error('R2 is not configured');
    }
    const out = await this.getClient().send(
      new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }),
    );
    const len = out.ContentLength;
    if (len == null || !Number.isFinite(len)) {
      throw new Error(`HEAD ${key}: missing ContentLength`);
    }
    return len;
  }

  async putFileFromDisk(
    key: string,
    absolutePath: string,
    contentType: string,
  ): Promise<void> {
    const cfg = this.getConfig();
    if (!cfg) {
      throw new Error('R2 is not configured');
    }
    const size = (await stat(absolutePath)).size;
    const body = createReadStream(absolutePath);
    const upload = new Upload({
      client: this.getClient(),
      params: {
        Bucket: cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: size,
      },
    });
    await upload.done();
  }

  async deleteObject(key: string): Promise<void> {
    const cfg = this.getConfig();
    if (!cfg) {
      return;
    }
    try {
      await this.getClient().send(
        new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }),
      );
    } catch (err) {
      this.logger.warn(`R2 deleteObject ${key}: ${err}`);
    }
  }

  /**
   * HTTP Range response from R2 (single GETObject with Range when possible).
   */
  async pipeRangedGetObject(
    key: string,
    declaredSize: number,
    mimeType: string,
    req: Request,
    res: Response,
    headOnly: boolean,
  ): Promise<void> {
    const cfg = this.getConfig();
    if (!cfg) {
      throw new Error('R2 is not configured');
    }

    let fileSize = declaredSize;
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      fileSize = await this.headObjectByteLength(key);
    }

    const rangeHeader = req.headers.range;
    const parsed = parseSingleByteRange(rangeHeader, fileSize);

    const contentType = mimeType || 'application/octet-stream';

    const setInlinePlaybackHeaders = () => {
      if (
        contentType.startsWith('video/') ||
        contentType.startsWith('audio/')
      ) {
        res.setHeader('Content-Disposition', 'inline');
      }
    };

    if (parsed) {
      const { start, end } = parsed;
      const chunkSize = end - start + 1;
      const out = await this.getClient().send(
        new GetObjectCommand({
          Bucket: cfg.bucket,
          Key: key,
          Range: `bytes=${start}-${end}`,
        }),
      );
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', contentType);
      setInlinePlaybackHeaders();
      if (headOnly) {
        res.end();
        return;
      }
      const body = out.Body;
      if (!body || !(body instanceof Readable)) {
        throw new Error('R2 GetObject: empty body');
      }
      body.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.destroy();
      });
      body.pipe(res);
      return;
    }

    if (rangeHeader) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const out = await this.getClient().send(
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    );
    res.status(200);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', contentType);
    setInlinePlaybackHeaders();
    if (headOnly) {
      res.end();
      return;
    }
    const body = out.Body;
    if (!body || !(body instanceof Readable)) {
      throw new Error('R2 GetObject: empty body');
    }
    body.on('error', () => {
      if (!res.headersSent) res.status(500).end();
      else res.destroy();
    });
    body.pipe(res);
  }
}
