import test from 'node:test';
import assert from 'node:assert/strict';
import { isReplicaPath, replicaPaths, resolveReferenceLocation } from '@/lib/opc/routes';

test('OPC routes cover the reference templates and both observed casings', () => {
  assert.equal(replicaPaths.length, 18); // GPU资源页已下线（原 19）
  assert.equal(new Set(replicaPaths).size, 18);
  for (const path of replicaPaths) {
    assert.ok(isReplicaPath(path.toUpperCase()));
    assert.equal(resolveReferenceLocation(`#${path}`), path);
  }
});

test('reference links preserve details, cities and application form variants', () => {
  assert.equal(resolveReferenceLocation('https://opcstore.com/webNew/index.html#/NewsDetail?id=392'), '/newsdetail?id=392');
  assert.equal(resolveReferenceLocation('/webNew/index.html#/OpcApply?formType=training'), '/opcapply?formType=training');
  assert.equal(resolveReferenceLocation('#/Zone?city=%E5%8D%97%E4%BA%AC'), '/zone?city=%E5%8D%97%E4%BA%AC');
  assert.equal(resolveReferenceLocation('#/agent?q=React&page=2&token=private'), '/agent?q=React&page=2');
  assert.equal(resolveReferenceLocation('/opcapply?formType=computing&serverName=H100&serverCompute=80GB&serverPrice=3&rentalType=hourly'), '/opcapply?formType=computing&serverName=H100&serverCompute=80GB&serverPrice=3&rentalType=hourly');
});

test('unknown, malformed and external redirects never become local destinations', () => {
  for (const value of ['https://evil.example/#/agent', '//evil.example/agent', '/admin', 'javascript:alert(1)', '/agent/../market', '/%2e%2e/agent', '/%2f%2fevil.example', '/agent\\evil', '#/agent#more', '/%FF', 'https://user@opcstore.com/#/agent']) {
    assert.equal(resolveReferenceLocation(value), null, value);
  }
});

test('only the retired exact news list aliases to the community feed', () => {
  assert.equal(resolveReferenceLocation('#/news'), '/newslist');
  assert.equal(resolveReferenceLocation('/News/?category=%E6%B4%BB%E5%8A%A8&page=5'), '/newslist');
  assert.equal(resolveReferenceLocation('https://opcstore.com/webNew/index.html#/news?category=old'), '/newslist');
  assert.equal(resolveReferenceLocation('#/news/anything'), null);
  assert.equal(resolveReferenceLocation('#/newsletter'), null);
  assert.equal(resolveReferenceLocation('#/news/../agent'), null);
  assert.equal(resolveReferenceLocation('https://evil.example/#/news'), null);
  assert.equal(resolveReferenceLocation('#/newsdetail?id=392'), '/newsdetail?id=392');
});
