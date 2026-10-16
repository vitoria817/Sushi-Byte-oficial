const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'Sushi@123',
  database: 'Sushi Byte'
});

module.exports = pool; [

]