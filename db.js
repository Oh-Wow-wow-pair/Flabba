const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database in parent folder
const db = new sqlite3.Database(path.join(__dirname, 'company.db'));

// Create tables
db.serialize(() => {
  // Staff table
  db.run(`CREATE TABLE IF NOT EXISTS staff (
    staff_id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,
    hire_date DATE,
    job_title TEXT,
    dept_name TEXT NOT NULL,
    salary DECIMAL(10,2),
    phone TEXT,
    manager_id TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES staff(staff_id)
  )`);

  // Insert sample staff
  const staff = [
    ['user001', 'John', 'Doe', 'john.doe@company.com', '2020-01-15', 'Senior Engineer', 'Engineering', 85000, '555-0101', null],
    ['EMP002', 'Jane', 'Smith', 'jane.smith@company.com', '2019-03-20', 'Marketing Manager', 'Marketing', 75000, '555-0102', 'EMP001'],
    ['EMP003', 'Bob', 'Johnson', 'bob.johnson@company.com', '2021-06-10', 'HR Specialist', 'Human Resources', 65000, '555-0103', 'EMP002'],
    ['EMP004', 'Alice', 'Williams', 'alice.w@company.com', '2022-02-28', 'Financial Analyst', 'Finance', 70000, '555-0104', 'EMP001'],
    ['EMP005', 'Charlie', 'Brown', 'charlie.b@company.com', '2021-08-15', 'Software Developer', 'Engineering', 78000, '555-0105', 'EMP001'],
    ['EMP006', 'Diana', 'Ross', 'diana.r@company.com', '2023-01-10', 'R&D Director', 'Research & Development', 95000, '555-0106', null]
  ];

  const insertStaff = db.prepare(`
    INSERT OR IGNORE INTO staff (
      staff_id, first_name, last_name, email, hire_date, 
      job_title, dept_name, salary, phone, manager_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  staff.forEach(employee => insertStaff.run(employee));
  insertStaff.finalize();
});

// Helper functions for common queries
const dbHelpers = {
  getAllStaff: () => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM staff", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getSingleStaff: (staffId) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM staff WHERE staff_id = ?", [staffId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

module.exports = { db, ...dbHelpers };