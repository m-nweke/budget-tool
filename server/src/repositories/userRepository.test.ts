import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import userRepository, { buildAuthUser } from './userRepository';

beforeEach(() => {
  db.exec('DELETE FROM tenant_memberships; DELETE FROM users; DELETE FROM tenants;');
});

describe('userRepository', () => {
  it('creates and finds a user by id', () => {
    const created = userRepository.create({
      name: 'Dana Head',
      email: 'dana@example.com',
      password_hash: 'hashed-value',
    });
    expect(created).toMatchObject({ name: 'Dana Head', email: 'dana@example.com', password_hash: 'hashed-value' });
    expect(userRepository.findById(created.id)).toEqual(created);
  });

  it('findByEmail finds a user by email', () => {
    userRepository.create({ name: 'Evan Employee', email: 'evan@example.com', password_hash: 'hashed-value' });
    expect(userRepository.findByEmail('evan@example.com')).toMatchObject({ name: 'Evan Employee' });
  });

  it('findByEmail returns undefined for an unknown email', () => {
    expect(userRepository.findByEmail('nobody@example.com')).toBeUndefined();
  });

  it('findById returns undefined for an unknown id', () => {
    expect(userRepository.findById(999999)).toBeUndefined();
  });

  it('rejects creating a second user with an already-used email', () => {
    userRepository.create({ name: 'First', email: 'dupe@example.com', password_hash: 'hashed-value' });
    expect(() =>
      userRepository.create({ name: 'Second', email: 'dupe@example.com', password_hash: 'hashed-value' })
    ).toThrow();
  });
});

describe('buildAuthUser', () => {
  it('combines the user, membership, and tenant rows into an AuthUser, without password_hash', () => {
    const user = userRepository.create({ name: 'Dana Head', email: 'dana@example.com', password_hash: 'hashed-value' });
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
