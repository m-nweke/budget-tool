import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import departmentRepository from './departmentRepository';

beforeEach(() => {
  db.exec('DELETE FROM department_access; DELETE FROM departments;');
});

describe('departmentRepository', () => {
  it('findAll returns every department', () => {
    db.prepare('INSERT INTO departments (name) VALUES (?)').run('Engineering');
    db.prepare('INSERT INTO departments (name) VALUES (?)').run('Marketing');
    expect(departmentRepository.findAll()).toHaveLength(2);
  });

  it('findById finds a department', () => {
    const id = db.prepare('INSERT INTO departments (name) VALUES (?)').run('Engineering').lastInsertRowid as number;
    expect(departmentRepository.findById(id)).toMatchObject({ id, name: 'Engineering' });
  });

  it('findById returns undefined for an unknown id', () => {
    expect(departmentRepository.findById(999999)).toBeUndefined();
  });
});
