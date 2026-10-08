import {test} from 'node:test';
import assert from 'node:assert/strict';
import {desktopBuildArgs} from '../scripts/desktop-args.mjs';

test('package-manager separators do not hide target architecture from electron-builder',()=>{
 for(const target of [['--mac','--x64'],['--mac','--arm64'],['--win','--x64']]) {
  assert.deepEqual(desktopBuildArgs(['--',...target]),target);
  assert.deepEqual(desktopBuildArgs(target),target);
 }
 assert.deepEqual(desktopBuildArgs(['--','--offline','--dir']),['--dir']);
});
