import { User } from '@prisma/client';

export class SignInDto {
  email: string;
  password: string;
}

export class GoogleAuthUser {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  nbf: number;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthUser extends User {
  access_token: string;
}
