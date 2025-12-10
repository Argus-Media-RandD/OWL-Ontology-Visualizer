const fs = require('fs');
const path = require('path');
const { spawnSync } = require('node:child_process');

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
    const result = spawnSync('code', ['--install-extension', vsixPath], {
        env: {
            ...process.env,
            NODE_OPTIONS: ''
        },
        encoding: 'utf8'
    });

    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    const combinedOutput = `${stdout}\n${stderr}`.trim();

    if (result.status === 0) {
        if (combinedOutput) {
            console.log(combinedOutput);
        }
        console.log('VSIX installation complete.');
        return;
    }

    if (combinedOutput.includes('was successfully installed')) {
        const filtered = combinedOutput
            .split('\n')
            .filter(line => line.includes('was successfully installed'))
            .join('\n');
        if (filtered) {
            console.log(filtered);
        }
        console.warn('VSIX installation reported success but the VS Code CLI exited unexpectedly (known Electron loader bug). Continuing.');
        return;
    }

    if (combinedOutput) {
        console.error(combinedOutput);
    }

    if (result.error) {
        throw result.error;
    }

    throw new Error(`VSIX installation failed with exit code ${result.status}`);
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
    } catch (error) {
        console.error('Failed to install VSIX:', error.message);
        process.exit(error.status ?? 1);
    }
})();
