// Prints the bcrypt hash to paste into ADMIN_PASSWORD_HASH.
// The password is typed here (shown as *), asked twice, and never saved.
const bcrypt = require('bcryptjs');

const MIN_LENGTH = 10;

/** Reads one hidden line from the keyboard, echoing * per character. */
function askHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    let value = '';

    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') {
          stdin.removeListener('data', onData);
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (c === '') { // Ctrl+C
          process.stdout.write('\n');
          process.exit(1);
        }
        if (c === '\b' || c === '') { // Backspace
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (c < ' ') continue;
        value += c;
        process.stdout.write('*');
      }
    };

    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', onData);
  });
}

/** Non-interactive use (input piped in): first two lines are the password and its confirmation. */
function readPipedLines() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { data += d; });
    process.stdin.on('end', () => resolve(data.split(/\r?\n/)));
  });
}

async function main() {
  const piped = !process.stdin.isTTY;
  const lines = piped ? await readPipedLines() : null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    const first = piped ? lines[0] || '' : await askHidden(`Choose your owner password (at least ${MIN_LENGTH} characters): `);
    if (first.length < MIN_LENGTH) {
      console.log(`  Too short (${first.length} characters) - use at least ${MIN_LENGTH}.\n`);
      if (piped) process.exit(1);
      continue;
    }
    const second = piped ? lines[1] || '' : await askHidden('Type it again to confirm: ');
    if (first !== second) {
      console.log('  The two passwords do not match - try again.\n');
      if (piped) process.exit(1);
      continue;
    }

    console.log('\nADMIN_PASSWORD_HASH value (copy the whole line below):\n');
    console.log(bcrypt.hashSync(first, 10));
    console.log('\nPaste it on Render as ADMIN_PASSWORD_HASH. Remember the password itself - you sign in to /admin.html with it.');
    return;
  }
  process.exit(1);
}

main();
