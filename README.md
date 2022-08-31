[![wakatime](https://wakatime.com/badge/user/65ddcee5-893d-45e3-989c-4d52691b9072/project/cb52da0e-7317-4d00-97da-47004445e1f5.svg)](https://wakatime.com/badge/user/65ddcee5-893d-45e3-989c-4d52691b9072/project/cb52da0e-7317-4d00-97da-47004445e1f5)

![GitHub tag (latest SemVer)](https://img.shields.io/github/v/tag/nfacha/PlaneAlert?label=Latest%20version)
![GitHub Release Date](https://img.shields.io/github/release-date/nfacha/PlaneAlert)
![GitHub last commit](https://img.shields.io/github/last-commit/nfacha/PlaneAlert)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/c40766e76d3d468b996d23fc7edcfd85)](https://www.codacy.com/gh/nfacha/PlaneAlert/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=nfacha/PlaneAlert&amp;utm_campaign=Badge_Grade)

![GitHub Repo stars](https://img.shields.io/github/stars/nfacha/PlaneAlert?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/nfacha/PlaneAlert?style=social)

[![Discord](https://img.shields.io/discord/933444164379619348)](https://discord.gg/ecyK3y4zTW)

# PlaneAlert

## Like this project? Don't forget to STAR it and follow it for future releases :)

## Some Twitter accounts running PlaneAlert:

[@PlaneMayday](https://twitter.com/PlaneMayday) - Tracking Aircraft declaring an emergency

[@RyanairTracker](https://twitter.com/RyanairTracker) - Tracking Rayanair flights

[@TrackerTap](https://twitter.com/TrackerTap) - Tracking TAP flights

[@SataTrack](https://twitter.com/SataTrack) - Tracking SATA Air Azores and Azores Airlines flights

[@RussianPlanes](https://twitter.com/RussianPlanes) - Planes known to be associated with the #Russian government or
Russian oligartchs

## Features

- Support multiple data sources (api.facha.dev, OpenSky or Virtual Radar Server), with an easy way to add your own
- One instance can track multiple Aircraft
- Track Aircrafts by ICAO Hex
- Track whole Airlines
- Track all aircrafts of a specific type (Like track all B-52s at once)
- Track all aircraft broadcasting a specific squawk (such as 7500,7600,7700)
- Send out alerts on Discord and Twitter (with screenshots)
- Calculate the nearest airport to the aircraft on signal loss
- Full Docker support

## TrackSources

The following TrackSources are supported:

- FachaDev - This is the default and RECOMENDED TrackSource, that support all current Features | https://api.facha.dev
- VRS - This connects to your own Virtual Radar Server | (Self-Hosted)
- OPSN - OpenSkyNetwork | (https://openskynetwork.github.io/opensky-api/rest.html)

At this time airlines, squawk and type queries are only supported by the FachaDev TrackSource, and will not work if
another source is selected

## Usage

1. Clone the repo and cd into its directory
2. On the `config` folder copy the `main.yaml.example` as `main.yaml` and edit it to your needs
3. On this same `config` folder you will see four folders `aircraft`, `airlines` and `squawk`, and `types`, all this
   folders will contain an example file, to add a track of that type you just need to copy that file over and adjust its
   settings as needed
4. Run `docker-compose up -d` to start the services
