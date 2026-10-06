# Zero audit: game management and CDN (after the rework)

## Game management

Fixed in this pass
- Versions compare semantically (prerelease order included); the handle says new / same / changed / newer / older and what changed (size, achievements).
- Older versions need an explicit flag; identical content is skipped; the last 2 versions are kept (1 above 64 MB, 0 above 256 MB) with Rollback, Verify (fingerprint) and Forget.
- Manifest gained access, changelog, homepage and minApi.
- Manual intake: multi-part, wrapper folders, junk files, batch install, file picker and drag and drop helpers, cancel, early size and format refusal, plain-language errors.
- Games are sandboxed by default; full access is a per-game grant.
- Cache API for games (Hangouts.cache) with ttl, LRU by write time and per-game limits.

Still open
1. Rollback restores code, not saves: a save written by a newer version can break an older one. A UI should say so before rolling back. A save schema field in the manifest would let Hangouts warn.
2. Kept versions cost disk (up to 3 copies). Forget frees them; nothing frees them automatically.
3. The whole package is decompressed in memory during inspect (cap 1 GiB). Fine for browser-game sizes, heavy above about 300 MB.
4. Sandboxed games have no indexedDB or Cache Storage. Engines that need them are flagged (Need) and need Grant, which is a consent decision for the UI to explain.
5. Clips need a canvas. DOM games give H92. Audio comes from Web Audio only, not audio or video elements.
6. Clip cost: two overlapping encoders while a game runs. The setting turns them off.
7. Full-access games can still read Hangouts' storage. That is the price of engines that need raw IndexedDB, and the reason it is a grant.
8. The seal (reserved creator names) and its keys are build-time configuration; with no keys the reserved name is refused.
9. No automatic update policy: catalog updates are offered (Updates) and applied on request (UpdateAll).

## CDN

Fixed in this pass
- Parts download in parallel (3); each part fails over across mirrors by itself, remembers a dead mirror for the rest of the download, and retries only real transient failures (5xx, 408, 429, timeout).
- Optional per-part hashes (partSha) and optional total size (bytes) so a bad part or a full disk is caught before the whole game is downloaded.
- Whole-file sha256 streams in JS above 256 MB instead of reading it into one buffer.
- Cancel (AbortSignal), retry accounting for progress, and one shared download per game.
- Catalog: 10 minute freshness with background refresh, instant offline answers from the saved copy, refresh on reconnect; an offline start no longer stays stale for the whole session.
- Categories and the default season come from the catalog (defaults kept); catalog installs of originals and essentials get full access, everything else starts sandboxed.
- The catalog wins on version: an older catalog version replaces a newer install.
- Update list and update-all.

Still open
1. Trust model: sha256 in the catalog protects against corruption, not against a compromised repo. Only sealed entries (reserved creator, originals) are protected against that.
2. jsDelivr caches branch refs for hours; a catalog on a branch can lag. Pin a commit or tag when it matters.
3. No byte-range resume: a failed part restarts (parts are 20 MB or less).
4. Mirror health lives only for one download; the last good mirror is remembered for the session.
5. Hero slides refresh only on reconnect and at start, not on a timer; posters and screenshots are not checksummed.
6. The mirror hosts and default repo are obfuscated in the source. That hides nothing once the code is public; the allow-list is what protects.
7. Legal notices are cached for 5 minutes and never persisted.
