const db = require('../db');

const dashboardRepository = {
  findSummary() {
    return db
      .prepare(
        `SELECT
           c.id AS category_id,
           c.name AS name,
           c.budgeted_amount AS budgeted_amount,
           COALESCE(SUM(t.amount), 0) AS actual_spend,
           c.budgeted_amount - COALESCE(SUM(t.amount), 0) AS difference
         FROM categories c
         LEFT JOIN transactions t ON t.category_id = c.id
         GROUP BY c.id, c.name, c.budgeted_amount`
      )
      .all();
  },
};

module.exports = dashboardRepository;
