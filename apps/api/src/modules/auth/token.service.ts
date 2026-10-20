import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';

import type { TokenClaims } from '../../common/auth/token-claims.js';
import { requireEnv } from '../../common/config/env.js';
import type { UserRole } from '../../common/tenant/tenant-context.js';

export interface TokenUser {
  id: string;
  role: UserRole;
  depotId: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  async issuePair(user: TokenUser): Promise<TokenPair> {
    const base = {
      sub: user.id,
      role: user.role,
      depotId: user.depotId,
    };
    const accessTtl = requireEnv('JWT_ACCESS_TTL');
    const refreshTtl = requireEnv('JWT_REFRESH_TTL');

    const accessToken = await this.jwtService.signAsync(
      { ...base, type: 'access' } satisfies TokenClaims,
      {
        secret: requireEnv('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl as JwtSignOptions['expiresIn'],
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { ...base, type: 'refresh' } satisfies TokenClaims,
      {
        secret: requireEnv('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl as JwtSignOptions['expiresIn'],
      },
    );

    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: accessTtl };
  }

  async verifyRefreshToken(token: string): Promise<TokenClaims> {
    try {
      const claims = await this.jwtService.verifyAsync<TokenClaims>(token, {
        secret: requireEnv('JWT_REFRESH_SECRET'),
      });

      if (claims.type !== 'refresh' || claims.sub === '') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return claims;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
