// Prints the bcrypt hash to paste into ADMIN_PASSWORD_HASH.
// The password is typed here and never saved or shown.
const readline = require('readline');
const bcrypt = require('bcryptjs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
rl._writeToOutput = function (s) { if (!rl.muted) rl.output.write(s); };
rl.question('Choose your owner password (at least 10 characters): ', (pw) => {
  rl.muted = false;
  rl.close();
  process.stdout.write('\n');
  if (!pw || pw.length < 10) {
    console.error('Too short — use at least 10 characters.');
    process.exit(1);
  }
  console.log('\nADMIN_PASSWORD_HASH value (copy all of it):\n');
  console.log(bcrypt.hashSync(pw, 10));
  console.log('');
});
rl.muted = true;
