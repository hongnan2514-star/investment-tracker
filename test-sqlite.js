const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'test.db');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

console.log('尝试创建数据库于:', dbPath);

try {
  const db = new Database(dbPath);
  db.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, value TEXT)');
  const insert = db.prepare('INSERT INTO test (value) VALUES (?)');
  insert.run('hello');
  const row = db.prepare('SELECT * FROM test').get();
  console.log('✅ 数据库操作成功，读取到:', row);
  db.close();
} catch (err) {
  console.error('❌ 数据库操作失败:');
  console.error(err);
}
