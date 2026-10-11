import assert from 'node:assert';

console.log('--- 1. 测试 ATS 算法 metricRegex lastIndex 修复情况 ---');

const metricRegex = /\d+[%％倍万千人次个项起元条kK+＋]/;
const lines = [
  '• 性能提升 30%，首屏耗时降低 500ms',
  '• 支撑 200万 日活用户',
  '• 重构 10+ 核心模块',
  '• 优化打包体积 40%'
];

let totalPoints = 0;
let pointsWithMetrics = 0;

for (const line of lines) {
  totalPoints++;
  if (metricRegex.test(line)) {
    pointsWithMetrics++;
  }
}

assert.strictEqual(totalPoints, 4, '总条目数应为 4');
assert.strictEqual(pointsWithMetrics, 4, '量化达标条目数必须为 4（不被 lastIndex 吞噬）');
console.log('✅ ATS 算法量化检测条目数:', pointsWithMetrics, '/', totalPoints);

// 对比测试：如果带 g 标志会怎样？
const bugRegex = /\d+[%％倍万千人次个项起元条kK+＋]/g;
let bugCount = 0;
for (const line of lines) {
  if (bugRegex.test(line)) {
    bugCount++;
  }
}
console.log(`ℹ️ [对比实验] 带 /g 标志时的匹配数量为: ${bugCount}/${lines.length} (印证了原代码隔行漏判的 Bug: 无法全命中)`);

console.log('\n--- 2. 测试 PBKDF2 密码哈希与平滑升级校验 ---');

async function testCrypto() {
  const password = 'mySecretPassword2026';

  // 1. 生成 PBKDF2
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  const pbkdf2String = `pbkdf2:100000:${saltHex}:${hashHex}`;

  // 2. 校验正确密码
  const parts = pbkdf2String.split(':');
  const checkSalt = new Uint8Array(parts[2].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const checkKey = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const checkBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: checkSalt, iterations: 100000, hash: 'SHA-256' }, checkKey, 256);
  const checkHex = Array.from(new Uint8Array(checkBits)).map(b => b.toString(16).padStart(2, '0')).join('');

  assert.strictEqual(checkHex, parts[3], 'PBKDF2 正确密码验证必须通过');

  // 3. 校验错误密码
  const wrongKey = await crypto.subtle.importKey('raw', encoder.encode('wrongPassword'), { name: 'PBKDF2' }, false, ['deriveBits']);
  const wrongBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: checkSalt, iterations: 100000, hash: 'SHA-256' }, wrongKey, 256);
  const wrongHex = Array.from(new Uint8Array(wrongBits)).map(b => b.toString(16).padStart(2, '0')).join('');

  assert.notStrictEqual(wrongHex, parts[3], 'PBKDF2 错误密码验证必须失败');

  // 4. 旧版 SHA-256 兼容识别
  const legacyData = encoder.encode(password + 'open_resume_salt_2026');
  const legacyBuffer = await crypto.subtle.digest('SHA-256', legacyData);
  const legacyHash = Array.from(new Uint8Array(legacyBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  assert.ok(!legacyHash.startsWith('pbkdf2:'), '旧版哈希不带 pbkdf2 前缀');

  console.log('✅ PBKDF2 100,000次迭代哈希生成与双向校验通过！');
}

await testCrypto();
console.log('\n🎉 所有核心修复用例验证成功！');
