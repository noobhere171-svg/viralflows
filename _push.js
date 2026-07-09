const fs = require('fs');
const path = require('path');
const apiServerNodeModules = path.join('C:\\Users\\Notta\\Desktop\\2nd\\viralflows\\artifacts\\api-server\\node_modules');
const git = require(path.join(apiServerNodeModules, 'isomorphic-git'));
const http = require(path.join(apiServerNodeModules, 'isomorphic-git/http/node/index.cjs'));

const dir = 'C:\\Users\\Notta\\Desktop\\2nd\\viralflows';
const tokenFile = path.join(require('os').tmpdir(), 'github_token.txt');
const token = fs.readFileSync(tokenFile, 'utf8').trim();

console.log('Token exists:', !!token, 'length:', token.length);

(async () => {
  try {
    const commits = await git.log({ fs, dir, depth: 1 });
    console.log('Current HEAD:', commits[0]?.oid);

    const matrix = await git.statusMatrix({ fs, dir });
    const changedFiles = matrix.filter(([fp, h, w, s]) => h !== w || h !== s);
    console.log('Changed files:', changedFiles.length);
    changedFiles.forEach(([f]) => console.log('  ' + f));

    for (const [filepath] of changedFiles) {
      await git.add({ fs, dir, filepath });
    }

    const sha = await git.commit({
      fs,
      dir,
      message: 'fix: replace Python yt-dlp with yt-dlp-exec; fix tikwm relative URLs',
      author: { name: 'noobhere171-svg', email: 'noobhere171@gmail.com' },
    });
    console.log('Commit created:', sha);

    const pushResult = await git.push({
      fs,
      dir,
      http,
      onAuth: () => ({ username: 'noobhere171-svg', password: token }),
      remote: 'origin',
      ref: 'main',
      force: false,
    });
    console.log('Push result:', JSON.stringify(pushResult));
    console.log('PUSH SUCCESSFUL!');
  } catch (err) {
    console.error('ERROR:', err.message);
  }
})();
