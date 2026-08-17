// Local-dev convenience: creates one department and one department_head user
// with a hardcoded, hashed dev password, and grants them access to that
// department. Run manually via `npm run seed` — never auto-run on server
// start, so re-running the server doesn't silently duplicate rows. No
// self-serve registration or admin UI exists yet, so this is currently the
// only way to get a working login. departmentRepository/departmentAccessRepository
// don't exist yet (department-scoping phase), so this talks to `db` directly
// for the department and department_access rows.
import db from './index';
import userRepository from '../repositories/userRepository';
import { hashPassword } from '../utils/password';

const DEV_EMAIL = 'head@example.com';
const DEV_PASSWORD = 'password123';

async function seed(): Promise<void> {
  const existing = userRepository.findByEmail(DEV_EMAIL);
  if (existing) {
    console.log(`Seed user already exists: ${DEV_EMAIL}`);
    return;
  }

  // Hashing has to happen before the transaction (better-sqlite3's
  // db.transaction() wraps a synchronous function), so a failure there
  // never touches the DB and doesn't need to be rolled back.
  const passwordHash = await hashPassword(DEV_PASSWORD);

  // All three inserts commit or none do — without this, a crash between
  // inserts (e.g. a constraint error on department_access) would leave an
  // orphaned department row that a re-run can't detect (it only checks for
  // the user by email), producing a duplicate department on retry.
  const departmentId = db.transaction(() => {
    const department = db.prepare('INSERT INTO departments (name) VALUES (?)').run('Engineering');
    const id = department.lastInsertRowid as number;

    const user = userRepository.create({
      name: 'Dana Head',
      email: DEV_EMAIL,
      role: 'department_head',
      department_id: null,
      password_hash: passwordHash,
    });

    db.prepare('INSERT INTO department_access (user_id, department_id) VALUES (?, ?)').run(user.id, id);

    return id;
  })();

  console.log('Seeded department and user:');
  console.log(`  department: Engineering (id ${departmentId})`);
  console.log(`  email:      ${DEV_EMAIL}`);
  console.log(`  password:   ${DEV_PASSWORD}`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  });
