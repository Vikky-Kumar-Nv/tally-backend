// db.js
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: '192.145.238.16',
  user: 'amtbug5_usrtally',
  password: 'Tally@786$',
  database: 'amtbug5_dbtally'

  
});

module.exports = db;


// db.js
// const mysql = require('mysql2/promise');

// const db = mysql.createPool({
//   // host: 'localhost',
//   // user: 'root',
//   // password: '',
//   // database: 'dbEnegix'

//   host: '185.27.134.175',
//   user: 'if0_39475678',
//   password: 'OWxmEIee5nFl',
//   database: 'if0_39475678_dbenegix'
// });

// module.exports = db;