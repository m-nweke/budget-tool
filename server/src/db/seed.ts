// Local-dev convenience: creates two departments, one department_head (with
// access to the first department only) and one department_employee (home
// department = the first one) — enough to manually exercise the scoping
// rules (head sees/manages one department, the second department and its
// data stay invisible to both seeded users) without extra manual setup.
// Run manually via `npm run seed` — never auto-run on server start, so
// re-running the server doesn't silently duplicate rows. No self-serve
// registration or admin UI exists yet, so this is currently the only way to
// get a working login.
import db from './index';
import userRepository from '../repositories/userRepository';
import departmentAccessRepository from '../repositories/departmentAccessRepository';
import { hashPassword } from '../utils/password';

const HEAD_EMAIL = 'head@example.com';
const EMPLOYEE_EMAIL = 'employee@example.com';
const DEV_PASSWORD = 'password123';

async function seed(): Promise<void> {
  const existing = userRepository.findByEmail(HEAD_EMAIL);
  if (existing) {
    console.log(`Seed users already exist: ${HEAD_EMAIL}, ${EMPLOYEE_EMAIL}`);
    return;
  }

  // Hashing has to happen before the transaction (better-sqlite3's
  // db.transaction() wraps a synchronous function), so a failure there
  // never touches the DB and doesn't need to be rolled back.
  const passwordHash = await hashPassword(DEV_PASSWORD);

  // Every insert commits or none do — without this, a crash partway
  // through would leave orphaned rows that a re-run can't detect (it only
  // checks for the head user by email), producing duplicates on retry.
  const result = db.transaction(() => {
    const engineering = db.prepare('INSERT INTO departments (name) VALUES (?)').run('Engineering');
    const engineeringId = engineering.lastInsertRowid as number;
    // Marketing exists but neither seeded user has access to it — a
    // manual check that scoping actually hides it, not just that
    // Engineering shows up.
    db.prepare('INSERT INTO departments (name) VALUES (?)').run('Marketing');

    const head = userRepository.create({
      name: 'Dana Head',
      email: HEAD_EMAIL,
      role: 'department_head',
      department_id: null,
      password_hash: passwordHash,
    });
    departmentAccessRepository.grant(head.id, engineeringId);

    userRepository.create({
      name: 'Evan Employee',
      email: EMPLOYEE_EMAIL,
      role: 'department_employee',
      department_id: engineeringId,
      password_hash: passwordHash,
    });

    return { engineeringId };
  })();

  console.log('Seeded departments and users:');
  console.log(`  department: Engineering (id ${result.engineeringId}), Marketing (no access granted)`);
  console.log(`  head:       ${HEAD_EMAIL} / ${DEV_PASSWORD}`);
  console.log(`  employee:   ${EMPLOYEE_EMAIL} / ${DEV_PASSWORD}`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  });
