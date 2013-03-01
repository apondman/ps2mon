# [Planetside 2 World Monitor](http://github.com/apondman/ps2mon)

Gather quick intel about the current status of the world/continent from the angle of a chosen faction presented in dashboard reporting style. 
Data gathered from the SOE Data Services API (http://census.soe.com)

## Features

* Realtime data from SOE Data Services 
* Global traffic light style indicator for continent status
* World selection
* Faction selection
* Region status (facilities and other outposts)
* Facility bonus indicators
* Resources per tick.
* Configuration options (tresholds, refresh interval)
* Continent bonus indicator (needs work)
* LIVE map!

## Planned

* Sounds to play when conditions are met (mainly for ingame 2nd screen usage)
* Configurable region (outpost, facility etc..) information to show individually.
* Latest (relevant) continent events (data is on the api but currently can't be filtered for each world seperately)
* Configuring settings through url (for bookmarking)
* Attack force: some sort of calculated area gain/lose rate of each faction.
* "Warpgated" indicator (you have territory but your warpgate is cut off from it)
* AI: Predicting enemy movement and/or suggest tactical responses.
* Graphs for relevant tactical data.
* Server-side data-mining (once api is finalized)

## Project information

* App: http://apondman.github.com/ps2mon 
* Source: http://github.com/apondman/ps2mon
* Docs: http://github.com/apondman/ps2mon

## License

GPLv3

### Major components:

* jQuery: MIT/GPL license
* Modernizr: MIT/BSD license
* Bootstrap: Apache License, Version 2.0
* Knockout: MIT license
* LINQ for Javascript: Microsoft Public License (Ms-PL)
* Planetside 2 MAP API: https://github.com/jhartikainen/planetside2-map-api/

