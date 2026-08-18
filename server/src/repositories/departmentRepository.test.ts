import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import departmentRepository from './departmentRepository';

beforeEach(() => {
  db.exec('DELETE FROM department_access; DELETE FROM departments;');
});

describe('departmentRepository', () => {
  it('findAll with no departmentIds returns every department, unscoped', () => {
    db.prepare('INSERT INTO departments (name) VALUES (?)').run('Engineering');
    db.prepare('INSERT INTO departments (name) VALUES (?)').run('Marketing');
    expect(departmentRepository.findAll()).toHaveLength(2);
  });

  it('findAll(departmentIds) scopes to the given ids', () => {
    const engId = db.prepare('INSERT INTO departments (name) VALUES (?)').run('Engineering').lastInsertRowid as number;
    db.prepare('INSERT INTO departments (name) VALUES (?)').run('Marketing');
    const rows = departmentRepository.findAll([engId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Engineering');
  });

  it('findAll([]) returns no rows', () => {
    db.prepare('INSERT INTO departments (name) VALUES (?)').run('Engineering');
    expect(departmentRepository.findAll([])).toHaveLength(0);
  });

  it('findById finds a department', () => {
    const id = db.prepare('INSERT INTO departments (name) VALUES (?)').run('Engineering').lastInsertRowid as number;
    expect(departmentRepository.findById(id)).toMatchObject({ id, name: 'Engineering' });
  });

  it('findById returns undefined for an unknown id', () => {
    expect(departmentRepository.findById(999999)).toBeUndefined();
  });
});
