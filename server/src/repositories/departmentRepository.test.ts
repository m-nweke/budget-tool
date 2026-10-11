import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import departmentRepository from './departmentRepository';

let tenantId: number;

beforeEach(async () => {
  (await db.exec('DELETE FROM department_access; DELETE FROM departments; DELETE FROM tenants;'));
  tenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Acme Co', 'enterprise')"))
    .lastInsertRowid as number;
});

describe('departmentRepository', () => {
  it('create persists a department under the given tenant', async () => {
    const department = (await departmentRepository.create('Engineering', tenantId));
    expect(department).toMatchObject({ name: 'Engineering', tenant_id: tenantId });
  });

  it('findAll with no departmentIds returns every department, unscoped', async () => {
    (await departmentRepository.create('Engineering', tenantId));
    (await departmentRepository.create('Marketing', tenantId));
    (await expect((await departmentRepository.findAll())).toHaveLength(2));
  });

  it('findAll(departmentIds) scopes to the given ids', async () => {
    const engineering = (await departmentRepository.create('Engineering', tenantId));
    (await departmentRepository.create('Marketing', tenantId));
    const rows = (await departmentRepository.findAll([engineering.id]));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Engineering');
  });

  it('findAll([]) returns no rows', async () => {
    (await departmentRepository.create('Engineering', tenantId));
    (await expect((await departmentRepository.findAll([]))).toHaveLength(0));
  });

  it('findById finds a department', async () => {
    const department = (await departmentRepository.create('Engineering', tenantId));
    (await expect((await departmentRepository.findById(department.id))).toMatchObject({ id: department.id, name: 'Engineering' }));
  });

  it('findById returns undefined for an unknown id', async () => {
    (await expect((await departmentRepository.findById(999999))).toBeUndefined());
  });
});
