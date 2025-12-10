const fs = require('fs');
const path = require('path');
const { execSync } = require('node:child_process');

function findLatestVsix(rootDir) {
    const files = fs.readdirSync(rootDir)
        .filter(name => name.endsWith('.vsix'))
        .map(name => {
            const fullPath = path.join(rootDir, name);
            const stats = fs.statSync(fullPath);
            return { name, fullPath, mtimeMs: stats.mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

    return files[0];
}

function installVsix(vsixPath) {
    console.log(`Installing VSIX: ${vsixPath}`);
    execSync(`code --install-extension "${vsixPath}"`, {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_OPTIONS: ''
        }
    });
}

(function main() {
    const rootDir = path.join(__dirname, '..');
    const latest = findLatestVsix(rootDir);

    if (!latest) {
        console.error('No VSIX files found. Run "npm run package" first.');
        process.exit(1);
    }

    try {
        installVsix(latest.fullPath);
        console.log('VSIX installation complete.');
    } catch (error) {
        console.error('Failed to install VSIX:', error.message);
        process.exit(error.status ?? 1);
    }
})();
