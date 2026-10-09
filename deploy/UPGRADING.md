# Desktop upgrades and recovery

The next candidate is 0.1.1. Public downloads remain on 0.1.0 until a coordinated release.
There is no automatic updater. Download only from https://abrozcombat.com/download.

## Windows
1. Finish or leave your match, then quit Abroz Combat.
2. Download the new Windows installer. Compare its SHA-256 checksum with the release list.
3. Run the installer under the same Windows account and choose the existing installation.
4. Launch and check the version/build, keyboard/controller controls, language and audio.

## macOS
1. Finish or leave your match. Fully quit Abroz Combat; closing its window is insufficient.
2. Download the correct Apple Silicon or Intel DMG and verify its checksum.
3. Copy the application into Applications, replacing the old copy. Do not keep launching the DMG copy.
4. Launch and check the version/build and preferences.

Current beta installers are unsigned; OS security checks may prevent installation.
Do not disable system-wide security to install them.

## Settings and failures
Settings remain in the app profile, separate from installed program files. Do not delete
that profile when upgrading. Controller seat assignments and active matches are session-only.
An interrupted download should be discarded and downloaded again. If installation was
interrupted, quit the application and rerun the complete installer/copy the complete app.
Reinstalling preserves settings and therefore may not repair corrupted preferences.
Use in-game controls/settings to reselect the affected values; request support if the app
cannot start. Back up the profile before any manual settings repair; do not delete all data.

## Release and rollback checklist
- Keep appId, productName, executableName and abroz://game stable.
- Increment package.json version for each distributed release, even if gameplay is unchanged.
- Build all platforms from the reviewed candidate and check their compatibility metadata.
- Publish matching desktop downloads before directing players to an incompatible server update.
- Keep previous installers/checksums in immutable versioned locations.
- Test same-version reinstall, skipped-version upgrade, interrupted install, low disk space,
  custom bindings/preferences, both Mac architectures, and browser/desktop multiplayer.
- Test failures only on disposable profiles or test machines, never during player matches.
- Rollback requires quitting and reinstalling the previous artifact. Preserve a profile backup;
  older apps may not understand newer settings. Multiplayer also needs a matching server.
- Do not promise automatic rollback or preservation of active games across installation.

## Desktop candidate storage

Run the manual **Build desktop candidates** workflow for the reviewed commit.
It creates an unpublished draft GitHub release named
`desktop-candidate-<run-id>-<attempt>` before the three packaging jobs. Each job
uploads its installer, platform checksum, and build/compatibility metadata.
Drafts replace Actions artifact storage; this workflow never publishes a GitHub
release or changes R2, download links, browser hosting, or the game server.
Only the preparation and packaging jobs receive repository contents-write access.

Before promotion, require all three jobs to pass, download all assets with
`gh release download <tag>`, verify SHA256 and matching commit/contentVersion,
and upload to the existing immutable R2 release prefix. Keep the previous live
release for rollback. A partial/failed draft is not an approved release.
If an upload partially fails, rerun **all jobs** to create a fresh attempt/draft;
existing assets are never overwritten. Do not publish draft candidates publicly.
Periodically review abandoned drafts and remove them only after confirming they
are not needed for release or rollback. No automatic retention deletion is used.
