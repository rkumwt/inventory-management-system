import { Role } from '@ims/common';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { PasswordService } from './password.service';
import { User } from './user.entity';
import { normalizeEmail, UsersService } from './users.service';

function setup(existing: Partial<User>[] = []) {
  const rows = existing.map((row) => ({ ...row }) as User);
  const repository = {
    findOne: jest.fn(async ({ where }: { where: Partial<User> }) => {
      return (
        rows.find((row) =>
          Object.entries(where).every(
            ([key, value]) => row[key as keyof User] === value,
          ),
        ) ?? null
      );
    }),
    create: (row: User) => row,
    save: jest.fn(async (row: User) => row),
  };
  const passwords = new PasswordService();
  const service = new UsersService(
    repository as unknown as Repository<User>,
    passwords,
  );
  return { service, repository, passwords };
}

const input = {
  email: '  New.User@IMS.local ',
  name: ' New User ',
  password: 'a-long-password',
  role: Role.Staff,
};

describe('UsersService', () => {
  it('normalises the email and stores an Argon2 hash, never the password', async () => {
    const { service, passwords } = setup();

    const user = await service.create(input);

    expect(user.email).toBe('new.user@ims.local');
    expect(user.name).toBe('New User');
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(input.password);
    await expect(
      passwords.verify(user.passwordHash, input.password),
    ).resolves.toBe(true);
    await expect(passwords.verify(user.passwordHash, 'wrong')).resolves.toBe(
      false,
    );
  });

  it('rejects an email that is already registered, ignoring case', async () => {
    const { service } = setup([{ email: 'new.user@ims.local' }]);

    await expect(service.create(input)).rejects.toThrow(ConflictException);
  });

  it('maps a unique-constraint race to the same conflict error', async () => {
    const { service, repository } = setup();
    repository.save.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], { code: '23505' } as never),
    );

    await expect(service.create(input)).rejects.toMatchObject({
      response: { error: 'EMAIL_ALREADY_REGISTERED' },
    });
  });

  it('does not let users change their own role', async () => {
    const { service } = setup([{ id: 'admin-1', role: Role.Admin }]);

    await expect(
      service.changeRole('admin-1', Role.Staff, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it("changes another user's role", async () => {
    const { service } = setup([{ id: 'user-2', role: Role.Staff }]);

    const updated = await service.changeRole('user-2', Role.Manager, 'admin-1');

    expect(updated.role).toBe(Role.Manager);
  });

  it('normalizeEmail trims and lower-cases', () => {
    expect(normalizeEmail('  A@B.Co ')).toBe('a@b.co');
  });
});
