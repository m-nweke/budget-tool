import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import userRepository, { buildAuthUser } from './userRepository';

beforeEach(async () => {
  (await db.exec('DELETE FROM tenant_memberships; DELETE FROM users; DELETE FROM tenants;'));
});

describe('userRepository', () => {
  it('creates and finds a user by id', async () => {
    const created = (await userRepository.create({
      name: 'Dana Head',
      email: 'dana@example.com',
      password_hash: 'hashed-value',
    }));
    expect(created).toMatchObject({ name: 'Dana Head', email: 'dana@example.com', password_hash: 'hashed-value' });
    (await expect((await userRepository.findById(created.id))).toEqual(created));
  });

  it('findByEmail finds a user by email', async () => {
    (await userRepository.create({ name: 'Evan Employee', email: 'evan@example.com', password_hash: 'hashed-value' }));
    (await expect((await userRepository.findByEmail('evan@example.com'))).toMatchObject({ name: 'Evan Employee' }));
  });

  it('findByEmail returns undefined for an unknown email', async () => {
    (await expect((await userRepository.findByEmail('nobody@example.com'))).toBeUndefined());
  });

  it('findById returns undefined for an unknown id', async () => {
    (await expect((await userRepository.findById(999999))).toBeUndefined());
  });

  it('rejects creating a second user with an already-used email', async () => {
    (await userRepository.create({ name: 'First', email: 'dupe@example.com', password_hash: 'hashed-value' }));
    await expect(
      userRepository.create({ name: 'Second', email: 'dupe@example.com', password_hash: 'hashed-value' })
    ).rejects.toThrow();
  });
});

describe('buildAuthUser', () => {
  it('combines the user, membership, and tenant rows into an AuthUser, without password_hash', async () => {
    const user = (await userRepository.create({ name: 'Dana Head', email: 'dana@example.com', password_hash: 'hashed-value' }));
    const authUser = buildAuthUser(
      user,
      { id: 1, user_id: user.id, tenant_id: 5, role: 'department_head', department_id: null },
      { id: 5, name: 'Acme Co', type: 'enterprise', join_code: 'TEAM-ABCD' }
    );
    expect(authUser).toEqual({
      id: user.id,
      name: 'Dana Head',
      email: 'dana@example.com',
      tenant_id: 5,
      tenant_type: 'enterprise',
      role: 'department_head',
      department_id: null,
    });
    expect(authUser).not.toHaveProperty('password_hash');
  });
});
