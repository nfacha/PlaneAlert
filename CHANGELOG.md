# Changelog

# Release V2.2.0 (2022-12-x)

- Add Mastodon Support
- Add the `muskKillSwitch` flag to the main config, if set to `true` all Twitter broadcast capabilities are turned off,
  without having to manually update them

# Release V2.1.0 (2022-09-20)

- Add Dump1090 track source

# Release V2.0.2 (2022-08-30)

- Fix crash when there is no nearby airport on signal loss
- Close browser on screenshot failure, to reduce memory usage
- Add hashtag to callsign on Twitter posts
- Catch Twitter errors (mostly because 429)

# Release V2.0.1 (2022-08-29)

- Update dependency
- Fix emergency and type alerts not triggering events
- Fix single plane queries for FachaDev TrackSource
- Update docker-compose files for easier dev server usage
- Fix TrackSource typings

# Release V2.0.0 (2022-08-29)

- Initial 2.0 release
