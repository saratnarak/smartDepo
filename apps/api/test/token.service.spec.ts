import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { TokenClaims } from '../src/common/auth/token-claims.js';
import { requireEnv } from '../src/common/config/env.js';
import { TokenService } from '../src/modules/auth/token.service.js';

describe('TokenService', () => {
  const jwt = new JwtService();
  const service = new TokenService(jwt);
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    role: 'OWNER' as const,
    depotId: '22222222-2222-4222-8222-222222222222',
  };

  it('issues access and refresh tokens with depot and role claims', async () => {
    const pair = await service.issuePair(user);

    const access = await jwt.verifyAsync<TokenClaims>(pair.accessToken, {
      secret: requireEnv('JWT_ACCESS_SECRET'),
    });
    const refresh = await jwt.verifyAsync<TokenClaims>(pair.refreshToken, {
      secret: requireEnv('JWT_REFRESH_SECRET'),
    });

    expect(access).toMatchObject({
      sub: user.id,
      role: 'OWNER',
      depotId: user.depotId,
      type: 'access',
    });
    expect(refresh).toMatchObject({ type: 'refresh' });
  });

  it('rejects an access token on the refresh path', async () => {
    const pair = await service.issuePair(user);

    await expect(service.verifyRefreshToken(pair.accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
