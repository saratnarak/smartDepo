import { PasswordService } from '../src/modules/auth/password.service.js';

describe('PasswordService', () => {
  const previousRounds = process.env.BCRYPT_ROUNDS;

  beforeAll(() => {
    process.env.BCRYPT_ROUNDS = '4';
  });

  afterAll(() => {
    process.env.BCRYPT_ROUNDS = previousRounds;
  });

  it('hashes and verifies a password without storing it in clear text', async () => {
    const service = new PasswordService();
    const hash = await service.hash('correct horse battery 9');

    expect(hash).not.toContain('correct horse');
    await expect(service.verify('correct horse battery 9', hash)).resolves.toBe(true);
    await expect(service.verify('wrong password 1', hash)).resolves.toBe(false);
  });
});
