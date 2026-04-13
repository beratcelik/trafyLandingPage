require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { initDatabase } = require('../services/dbService');

initDatabase();
console.log('Veritabani tablolari olusturuldu.');
process.exit(0);
