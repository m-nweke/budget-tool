import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import userRepository from './userRepository';

beforeEach(() => {
  db.exec('DELETE FROM department_access; DELETE FROM users;');
});

describe('userRepository', () => {
  it('creates and finds a user by id', () => {
    const created = userRepository.create({
      name: 'Dana Head',
      email: 'dana@example.com',
      role: 'department_head',
      department_id: null,
      password_hash: 'hashed-value',
    });
    expect(created).toMatchObject({
      name: 'Dana Head',
      email: 'dana@example.com',
      role: 'department_head',
      department_id: null,
      password_hash: 'hashed-value',
    });
    expect(userRepository.findById(created.id)).toEqual(created);
  });

  it('findByEmail finds a user by email', () => {
    userRepository.create({
      name: 'Evan Employee',
      email: 'evan@example.com',
      role: 'department_employee',
      department_id: null,
      password_hash: 'hashed-value',
    });
    expect(userRepository.findByEmail('evan@example.com')).toMatchObject({ name: 'Evan Employee' });
  });

  it('findByEmail returns undefined for an unknown email', () => {
    expect(userRepository.findByEmail('nobody@example.com')).toBeUndefined();
  });

  it('findById returns undefined for an unknown id', () => {
    expect(userRepository.findById(999999)).toBeUndefined();
  });

  it('rejects creating a second user with an already-used email', () => {
    userRepository.create({
      name: 'First',
      email: 'dupe@example.com',
      role: 'department_employee',
      department_id: null,
      password_hash: 'hashed-value',
    });
    expect(() =>
      userRepository.create({
        name: 'Second',
        email: 'dupe@example.com',
        role: 'department_employee',
        department_id: null,
        password_hash: 'hashed-value',
      })
    ).toThrow();
  });
});
