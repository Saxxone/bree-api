import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import { AuthController } from './auth.controller';
import { AuthService, jwtConstants } from './auth.service';

@Module({
  imports: [
    UserModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') || jwtConstants.secret;
        if (!secret) {
          throw new Error(
            'JWT_SECRET is not defined. Please set it in your environment variables.',
          );
        }
        // Refresh tokens are signed/verified with JWT_REFRESH_SECRET inside
        // AuthService. Fail fast at boot if it is missing rather than letting
        // refresh JWTs be signed with the empty-string default, which would
        // make every refresh attempt either trivially forgeable or invalid.
        const refreshSecret =
          configService.get<string>('JWT_REFRESH_SECRET') ||
          jwtConstants.refreshSecret;
        if (!refreshSecret) {
          throw new Error(
            'JWT_REFRESH_SECRET is not defined. Please set it in your environment variables.',
          );
        }
        return {
          secret,
          signOptions: { expiresIn: '7d' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
