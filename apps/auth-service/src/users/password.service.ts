import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Password hashing with Argon2id (salted; parameters stored in the hash). */
@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false; // malformed hash: treat as a failed login, not a 500
    }
  }
}
