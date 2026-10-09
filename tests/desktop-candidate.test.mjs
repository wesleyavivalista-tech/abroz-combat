import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCandidate} from '../scripts/upload-desktop-candidate.mjs';
const sha='a'.repeat(40),env={GITHUB_SHA:sha,ABROZ_CANDIDATE_TAG:'desktop-candidate-123-1',ABROZ_CANDIDATE_PLATFORM:'windows-x64'};
const release={isDraft:true,targetCommitish:sha},metadata={buildVersion:sha,offline:false,wsURL:'wss://abroz-combat.fly.dev/',protocolVersion:46,contentVersion:'46-test'};
test('matching draft permits each supported platform',()=>{for(const platform of ['windows-x64','macos-arm64','macos-x64'])assert.doesNotThrow(()=>validateCandidate(release,metadata,{...env,ABROZ_CANDIDATE_PLATFORM:platform}));});
test('public releases and wrong-commit drafts cannot receive candidates',()=>{for(const r of [{...release,isDraft:false},{...release,targetCommitish:'b'.repeat(40)}])assert.throws(()=>validateCandidate(r,metadata,env));});
test('offline, stale or incompatible build metadata fails closed',()=>{for(const m of [{...metadata,offline:true},{...metadata,buildVersion:'old'},{...metadata,wsURL:'ws://localhost'},{...metadata,contentVersion:'45-test'}])assert.throws(()=>validateCandidate(release,m,env));});
test('invalid target names fail closed',()=>{for(const e of [{...env,ABROZ_CANDIDATE_TAG:'--latest'},{...env,ABROZ_CANDIDATE_PLATFORM:'other'},{...env,GITHUB_SHA:'main'}])assert.throws(()=>validateCandidate(release,metadata,e));});
