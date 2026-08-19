import { describe, it, expect, beforeEach, vi } from 'vitest';
import db from '../db';
import departmentAccessRepository from '../repositories/departmentAccessRepository';
import {
  resolveAccessibleDepartmentIds,
  resolveScope,
  userHasDepartmentAccess,
  userCanAccessResource,
  requireRole,
} from './scoping';
import type { AuthUser } from '../types';

let tenantId: number;
let otherTenantId: number;
let deptA: number;
let deptB: number;

beforeEach(() => {
  db.exec(
    'DELETE FROM department_access; DELETE FROM tenant_memberships; DELETE FROM users; DELETE FROM departments; DELETE FROM tenants;'
  );
  tenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Acme Co', 'enterprise')").run()
    .lastInsertRowid as number;
  otherTenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Other Co', 'enterprise')").run()
    .lastInsertRowid as number;
  deptA = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run('Engineering', tenantId)
    .lastInsertRowid as number;
  deptB = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run('Marketing', tenantId)
    .lastInsertRowid as number;
});

function employee(departmentId: number | null): AuthUser {
  return {
    id: 1,
    name: 'Evan Employee',
    email: 'evan@example.com',
    tenant_id: tenantId,
    tenant_type: 'enterprise',
    role: 'department_employee',
    department_id: departmentId,
  };
}

function owner(): AuthUser {
  return {
    id: 1,
    name: 'Pat Personal',
    email: 'pat@example.com',
    tenant_id: tenantId,
    tenant_type: 'personal',
    role: 'owner',
    department_id: null,
  };
}

// A real users row is required — department_access.user_id has a foreign
// key, so any test granting access needs an actual user to grant it to.
function head(): AuthUser {
  const id = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Dana Head', 'dana@example.com')
    .lastInsertRowid as number;
  return {
    id,
    name: 'Dana Head',
    email: 'dana@example.com',
    tenant_id: tenantId,
    tenant_type: 'enterprise',
    role: 'department_head',
    department_id: null,
  };
}

describe('resolveAccessibleDepartmentIds', () => {
  it('an employee resolves to their single home department', () => {
    expect(resolveAccessibleDepartmentIds(employee(deptA))).toEqual([deptA]);
  });

  it('an employee with no home department resolves to zero access', () => {
    expect(resolveAccessibleDepartmentIds(employee(null))).toEqual([]);
  });

  it('a head with no grants resolves to zero access — no implicit fallback', () => {
    expect(resolveAccessibleDepartmentIds(head())).toEqual([]);
  });

  it('a head resolves to every department they\'ve been granted', () => {
    const user = head();
    departmentAccessRepository.grant(user.id, deptA);
    departmentAccessRepository.grant(user.id, deptB);
    expect(resolveAccessibleDepartmentIds(user).sort()).toEqual([deptA, deptB].sort());
  });

  it('an owner (personal tenant) always resolves to zero departments — no departments exist to be accessible', () => {
    expect(resolveAccessibleDepartmentIds(owner())).toEqual([]);
  });
});

describe('resolveScope', () => {
  it('an enterprise user gets a department-based scope', () => {
    expect(resolveScope(employee(deptA))).toEqual({ departmentIds: [deptA] });
  });

  it('an owner gets a tenant-based scope instead', () => {
    expect(resolveScope(owner())).toEqual({ tenantId });
  });
});

describe('userHasDepartmentAccess', () => {
  it('true for an employee\'s home department', () => {
    expect(userHasDepartmentAccess(employee(deptA), deptA)).toBe(true);
  });

  it('false for a department other than the employee\'s home one', () => {
    expect(userHasDepartmentAccess(employee(deptA), deptB)).toBe(false);
  });

  it('false when the target department is null (e.g. an unscoped category)', () => {
    expect(userHasDepartmentAccess(employee(deptA), null)).toBe(false);
  });

  it('true for a head granted that department', () => {
    const user = head();
    departmentAccessRepository.grant(user.id, deptA);
    expect(userHasDepartmentAccess(user, deptA)).toBe(true);
  });

  it('false for a head not granted that department', () => {
    const user = head();
    departmentAccessRepository.grant(user.id, deptA);
    expect(userHasDepartmentAccess(user, deptB)).toBe(false);
  });
});

describe('userCanAccessResource', () => {
  it('an enterprise user falls back to the department check', () => {
    const resource = { tenant_id: tenantId, department_id: deptA };
    expect(userCanAccessResource(employee(deptA), resource)).toBe(true);
    expect(userCanAccessResource(employee(deptB), resource)).toBe(false);
  });

  it('an owner is authorized for any resource in their own tenant', () => {
    const resource = { tenant_id: tenantId, department_id: null };
    expect(userCanAccessResource(owner(), resource)).toBe(true);
  });

  it('an owner is not authorized for a resource in a different tenant', () => {
    const resource = { tenant_id: otherTenantId, department_id: null };
    expect(userCanAccessResource(owner(), resource)).toBe(false);
  });
});

describe('requireRole', () => {
  function mockRes() {
    const status = vi.fn().mockReturnValue({ json: vi.fn() });
    return { status } as unknown as import('express').Response;
  }

  it('calls next() when the user has one of the required roles', () => {
    const req = { user: head() } as import('express').Request;
    const next = vi.fn();
    requireRole('department_head')(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('responds 403 when the user lacks the required role', () => {
    const req = { user: employee(deptA) } as import('express').Request;
    const res = mockRes();
    const next = vi.fn();
    requireRole('department_head')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 403 when req.user is unset', () => {
    const req = {} as import('express').Request;
    const res = mockRes();
    const next = vi.fn();
    requireRole('department_head')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
