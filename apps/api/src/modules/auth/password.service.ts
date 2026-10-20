import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

/**
 * bcrypt password hashing. The default cost is 12; tests may set BCRYPT_ROUNDS lower.
 * Passwords are never logged.
 */
@Injectable()
export class PasswordService {
  private readonly rounds: number;

  constructor() {
    const configured = Number(process.env.BCRYPT_ROUNDS ?? 12);
    this.rounds = Number.isInteger(configured) && configured >= 4 ? configured : 12;
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
