const db = require('../db');

const COLUMNS = 'id, amount, date, description, category_id';

const transactionRepository = {
  findAll() {
    return db.prepare(`SELECT ${COLUMNS} FROM transactions`).all();
  },

  findById(id) {
    return db.prepare(`SELECT ${COLUMNS} FROM transactions WHERE id = ?`).get(id);
  },

  create({ amount, date, description, category_id }) {
    const result = db
      .prepare(
        'INSERT INTO transactions (amount, date, description, category_id, needs_approval, approved) VALUES (?, ?, ?, ?, 0, 0)'
      )
      .run(amount, date, description || null, category_id);
    return transactionRepository.findById(result.lastInsertRowid);
  },

  update(id, { amount, date, description, category_id }) {
    db.prepare(
      'UPDATE transactions SET amount = ?, date = ?, description = ?, category_id = ? WHERE id = ?'
    ).run(amount, date, description || null, category_id, id);
    return transactionRepository.findById(id);
  },

  remove(id) {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  },
};

module.exports = transactionRepository;
