import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {releaseSettings,flyConfig,webHeaders} from '../scripts/release-config.mjs';
const env={FLY_APP_NAME:'abroz-test',CLOUDFLARE_PAGES_PROJECT:'abroz-test',PUBLIC_WEB_ORIGIN:'https://abroz-test.pages.dev',VITE_WS_URL:'wss://abroz-test.fly.dev',ABROZ_BUILD_VERSION:'candidate-123'};
test('release configuration rejects missing, injected and mismatched endpoints',()=>{
 for(const key of Object.keys(env))assert.throws(()=>releaseSettings({...env,[key]:''}));
 for(const origin of ['http://abroz-test.pages.dev','https://abroz-test.pages.dev/path','https://user:secret@abroz-test.pages.dev','https://localhost'])assert.throws(()=>releaseSettings({...env,PUBLIC_WEB_ORIGIN:origin}));
 for(const ws of ['ws://abroz-test.fly.dev','wss://elsewhere.fly.dev','wss://abroz-test.fly.dev/?token=private'])assert.throws(()=>releaseSettings({...env,VITE_WS_URL:ws}));
 assert.throws(()=>releaseSettings({...env,FLY_APP_NAME:'bad\n[env]'}));
});
test('release output uses one persistent São Paulo performance machine and exact origins',()=>{
 const settings=releaseSettings(env),config=flyConfig(settings,readFileSync('deploy/fly.toml','utf8'));
 assert.ok(config.includes('dockerfile = "../../Dockerfile"'));
 assert.match(config,/primary_region = "gru"/);assert.match(config,/auto_stop_machines = "off"/);assert.match(config,/MAX_CONNECTIONS = "64"/);
 assert.match(config,/ALLOWED_ORIGINS = "https:\/\/abroz-test.pages.dev,abroz:\/\/game"/);
 const custom=flyConfig({...settings,webOrigin:'https://abrozcombat.com'},readFileSync('deploy/fly.toml','utf8'));
 assert.ok(custom.includes('https://abrozcombat.com,https://abroz-test.pages.dev,abroz://game'));
 const headers=webHeaders(settings);assert.match(headers,/connect-src 'self' wss:\/\/abroz-test.fly.dev https:\/\/abroz-test.fly.dev;/);assert.match(headers,/\/index.html\n {2}Cache-Control: no-cache/);
 assert.match(headers,/\/art\/\*\n {2}Cache-Control: public, max-age=0, must-revalidate/);
 assert.ok(!headers.includes('localhost'));assert.ok(!headers.includes('unsafe-eval'));
});
test('server container does not copy renderer assets or desktop runtime',()=>{
 const docker=readFileSync('Dockerfile','utf8');assert.ok(!docker.includes('COPY . .'));assert.ok(!docker.includes('COPY apps/client'));
 assert.match(docker,/USER node/);assert.match(docker,/--frozen-lockfile/);assert.match(docker,/dist-server\/apps\/server\/src\/index.js/);
});

test('HSTS starts with one day and does not extend to subdomains or preload',()=>{const headers=webHeaders(releaseSettings(env));assert.match(headers,/Strict-Transport-Security: max-age=86400\n/);assert.ok(!headers.includes('includeSubDomains'));assert.ok(!headers.includes('preload;'));});
