const db = require('../db');

const categoryRepository = {
  findAll() {
    return db.prepare('SELECT * FROM categories').all();
  },

  findById(id) {
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  },

  create({ name, budgeted_amount }) {
    const result = db
      .prepare('INSERT INTO categories (name, budgeted_amount) VALUES (?, ?)')
      .run(name, budgeted_amount);
    return categoryRepository.findById(result.lastInsertRowid);
  },

  update(id, { name, budgeted_amount }) {
    db.prepare('UPDATE categories SET name = ?, budgeted_amount = ? WHERE id = ?').run(
      name,
      budgeted_amount,
      id
    );
    return categoryRepository.findById(id);
  },

  remove(id) {
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  },

  countTransactionsFor(id) {
    return db
      .prepare('SELECT COUNT(*) AS count FROM transactions WHERE category_id = ?')
      .get(id).count;
  },
};

module.exports = categoryRepository;
