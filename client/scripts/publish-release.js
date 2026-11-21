const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('❌ Error: GH_TOKEN is not set in client/.env');
  process.exit(1);
}

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
const tag = `v${version}`;

// Detect owner and repo
const repoUrl = (pkg.repository && pkg.repository.url) || 'https://github.com/Manthan29-code/StockFlow.git';
const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
if (!match) {
  console.error('❌ Error: Could not determine GitHub owner/repo from package.json');
  process.exit(1);
}
const [, owner, repo] = match;

console.log(`🚀 Packaging and Publishing StockFlow ${tag} to ${owner}/${repo}...`);

// 1. Build using electron-builder locally (generate .exe, .blockmap, latest.yml)
console.log('📦 Step 1: Building Windows installer and update manifest locally...');
execSync('npx electron-builder --win', {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});

const distDir = path.join(__dirname, '..', 'dist');
const latestYmlPath = path.join(distDir, 'latest.yml');
if (!fs.existsSync(latestYmlPath)) {
  console.error('❌ Error: dist/latest.yml was not generated!');
  process.exit(1);
}

// Locate the generated installer exe and blockmap
const filesInDist = fs.readdirSync(distDir);
const exeFile = filesInDist.find((f) => f.endsWith('.exe') && !f.includes('uninstaller') && f.includes(version));
const blockmapFile = filesInDist.find((f) => f.endsWith('.blockmap') && f.includes(version));

if (!exeFile) {
  console.error(`❌ Error: Setup exe for version ${version} not found in dist/`);
  process.exit(1);
}

// Helper for GitHub API requests
async function ghApi(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'StockFlow-Publisher',
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`GitHub API error (${res.status} ${res.statusText}): ${text}`);
  }
  return res;
}

async function run() {
  // 2. Check if release already exists on GitHub
  console.log(`🔍 Step 2: Checking GitHub release for ${tag}...`);
  let releaseRes = await ghApi(`/repos/${owner}/${repo}/releases/tags/${tag}`);
  let release;

  if (releaseRes.status === 404) {
    console.log(`✨ Creating GitHub release ${tag}...`);
    const createRes = await ghApi(`/repos/${owner}/${repo}/releases`, {
      method: 'POST',
      body: JSON.stringify({
        tag_name: tag,
        name: version,
        draft: false,
        prerelease: false,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    release = await createRes.json();
  } else {
    release = await releaseRes.json();
    console.log(`ℹ️ Found existing release for ${tag} (ID: ${release.id})`);
    
    // If it was a draft, ensure it is published live
    if (release.draft) {
      console.log(`📢 Publishing draft release ${tag} to live status...`);
      const publishRes = await ghApi(`/repos/${owner}/${repo}/releases/${release.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ draft: false }),
        headers: { 'Content-Type': 'application/json' },
      });
      release = await publishRes.json();
    }
  }

  // 3. Upload assets (exe, blockmap, latest.yml)
  const assetsToUpload = [
    { name: exeFile, path: path.join(distDir, exeFile), type: 'application/octet-stream' },
    { name: 'latest.yml', path: latestYmlPath, type: 'text/yaml' },
  ];
  if (blockmapFile) {
    assetsToUpload.push({
      name: blockmapFile,
      path: path.join(distDir, blockmapFile),
      type: 'application/octet-stream',
    });
  }

  // Fetch fresh assets list
  const assetsRes = await ghApi(`/repos/${owner}/${repo}/releases/${release.id}/assets`);
  const existingAssets = (await assetsRes.json()) || [];

  for (const item of assetsToUpload) {
    const existing = existingAssets.find((a) => a.name === item.name);
    if (existing) {
      console.log(`🗑️ Deleting old ${item.name} from release...`);
      await ghApi(`/repos/${owner}/${repo}/releases/assets/${existing.id}`, { method: 'DELETE' });
    }

    const fileSizeMb = (fs.statSync(item.path).size / (1024 * 1024)).toFixed(2);
    console.log(`⬆️ Uploading ${item.name} (${fileSizeMb} MB)...`);
    const fileBuffer = fs.readFileSync(item.path);
    const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(item.name)}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': item.type,
        'Content-Length': String(fileBuffer.length),
        'User-Agent': 'StockFlow-Publisher',
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Failed to upload ${item.name}: ${errText}`);
    }
    console.log(`✅ Uploaded ${item.name} successfully!`);
  }

  console.log(`\n🎉 SUCCESS! Release ${tag} is LIVE on GitHub with latest.yml and all installer assets!`);
  console.log(`👉 All user apps will now automatically detect and offer update ${tag}.`);
}

run().catch((err) => {
  console.error('❌ Publishing failed:', err);
  process.exit(1);
});
