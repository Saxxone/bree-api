import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  data?: Record<string, string>;
};

type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | {
      status: 'error';
      message: string;
      details?: { error?: string };
    };

function isExpoPushToken(token: string): boolean {
  return (
    typeof token === 'string' &&
    (token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken['))
  );
}

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerToken(
    userId: string,
    token: string,
    platform: string,
  ): Promise<void> {
    const normalized =
      platform === 'ios' || platform === 'android' ? platform : 'unknown';
    await this.prisma.pushDevice.deleteMany({
      where: { expoPushToken: token },
    });
    await this.prisma.pushDevice.create({
      data: {
        userId,
        expoPushToken: token,
        platform: normalized,
      },
    });
  }

  async unregisterToken(userId: string, token: string): Promise<void> {
    await this.prisma.pushDevice.deleteMany({
      where: { userId, expoPushToken: token },
    });
  }

  async sendForNotification(params: {
    recipientUserId: string;
    title: string;
    body: string;
    data: Record<string, string | undefined>;
  }): Promise<void> {
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId: params.recipientUserId },
      select: { expoPushToken: true },
    });
    if (devices.length === 0) return;

    const data: Record<string, string> = Object.fromEntries(
      Object.entries(params.data).filter(
        (e): e is [string, string] => e[1] != null && e[1] !== '',
      ),
    );

    const messages: ExpoPushMessage[] = [];
    for (const { expoPushToken } of devices) {
      if (!isExpoPushToken(expoPushToken)) continue;
      messages.push({
        to: expoPushToken,
        sound: 'default',
        title: params.title,
        body: params.body,
        data,
      });
    }
    if (messages.length === 0) return;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    };
    if (process.env.EXPO_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    try {
      const { data: expoBody } = await axios.post<{ data: ExpoPushTicket[] }>(
        EXPO_PUSH_URL,
        messages,
        { headers, validateStatus: () => true },
      );
      if (!Array.isArray(expoBody?.data)) {
        this.logger.warn('Expo push: unexpected response shape');
        return;
      }
      for (let i = 0; i < expoBody.data.length; i++) {
        const ticket = expoBody.data[i];
        const to = messages[i]?.to;
        if (!to || !ticket) continue;
        if (ticket.status === 'error') {
          const err = ticket.details?.error;
          if (
            err === 'DeviceNotRegistered' ||
            err === 'InvalidCredentials' ||
            err === 'MessageTooBig'
          ) {
            await this.prisma.pushDevice.deleteMany({
              where: { expoPushToken: to },
            });
          } else {
            this.logger.warn(
              `Expo push ticket error for ${to}: ${ticket.message}`,
            );
          }
        }
      }
    } catch (e) {
      this.logger.warn(`Expo push request failed: ${String(e)}`);
    }
  }
}
