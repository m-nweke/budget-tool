import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import departmentRepository from './departmentRepository';

let tenantId: number;

beforeEach(() => {
  db.exec('DELETE FROM department_access; DELETE FROM departments; DELETE FROM tenants;');
  tenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Acme Co', 'enterprise')").run()
    .lastInsertRowid as number;
});

describe('departmentRepository', () => {
  it('create persists a department under the given tenant', () => {
    const department = departmentRepository.create('Engineering', tenantId);
    expect(department).toMatchObject({ name: 'Engineering', tenant_id: tenantId });
  });

  it('findAll with no departmentIds returns every department, unscoped', () => {
    departmentRepository.create('Engineering', tenantId);
    departmentRepository.create('Marketing', tenantId);
    expect(departmentRepository.findAll()).toHaveLength(2);
  });

  it('findAll(departmentIds) scopes to the given ids', () => {
    const engineering = departmentRepository.create('Engineering', tenantId);
    departmentRepository.create('Marketing', tenantId);
    const rows = departmentRepository.findAll([engineering.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Engineering');
  });

  it('findAll([]) returns no rows', () => {
    departmentRepository.create('Engineering', tenantId);
    expect(departmentRepository.findAll([])).toHaveLength(0);
  });

  it('findById finds a department', () => {
    const department = departmentRepository.create('Engineering', tenantId);
    expect(departmentRepository.findById(department.id)).toMatchObject({ id: department.id, name: 'Engineering' });
  });

  it('findById returns undefined for an unknown id', () => {
    expect(departmentRepository.findById(999999)).toBeUndefined();
  });
});
