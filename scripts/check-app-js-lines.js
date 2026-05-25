'use strict';

const fs = require('fs');
const path = require('path');

const CEILING = 1000;
const filePath = path.join(__dirname, '..', 'app.js');
const lines = fs.readFileSync(filePath, 'utf8').split('\n').length;

if (lines >= CEILING) {
  process.stderr.write(
    `app.js is ${lines} lines, hard ceiling is ${CEILING}. Extract logic into a module under js/.\n`,
  );
  process.exit(1);
}

console.log(`app.js: ${lines} / ${CEILING} lines (OK)`);
