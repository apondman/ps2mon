/* 
Author:  Armand Pondman
Email : apondman@live.nl

Planetside 2 World Monitor

// todo: events for captures 
*/

var census_serviceid = "apondman";
var census_app = "ps2-beta";
var census_uri = "http://census.soe.com/s:" + census_serviceid + "/get/" + census_app + "/";
var app_uri = $.url();

function ContinentViewModel(parent, zone) {
    var self = this;

    self.subscriptions = [];
    self.zone = ko.observable(zone);
    self.regions = ko.observableArray();
    self.history = ko.observableArray();
    self.loading = ko.observable(true);
    self.bonus = ko.observable(-1);
    
    self.timer = 0;

    // name of the continent
    self.name = ko.computed(function () {
        var zone = parent.zones()[self.zone() - 1]
        if (zone) {
            return zone.name.en;
        }
        
        return null;
    });

    // returns total territory owned by faction
    self.owned = function (x) {
        regions = parent.getRegionIds(parent.warpgates());
        // filter and get all territory excluding the warpgates
        return $.grep(self.regions(), function (n, i) {
            return n.RowData.FactionId == x && regions.indexOf(n.RowData.RegionId) < 0;
        });
    };

    // returns total facilities owned by faction
    self.ownedFacilities = function (x) {
        // filter and get all facilities
        return $.grep(self.regions(), function (n, i) {
            return n.RowData.FactionId == x && parent.facilityRegions().indexOf(n.RowData.RegionId) > -1;
        }).length;
    };


    self.toggleBonus = function () {
        var bonus = self.bonus();
        var faction = parent.empire();

        switch(bonus) {
            case -1:
            case 0:
              self.bonus(faction);
              break;
            case faction:
              self.bonus(0)
              break;
        }
    }

    // warpgate count for this continent
    self.warpgates = ko.computed(function () {
        regions = parent.getRegionIds(parent.warpgates());
        
        return $.grep(self.regions(), function (n, i) {
            return regions.indexOf(n.RowData.RegionId) > -1;
        }).length;
    });

    // neutral territory and warpgate count
    self.neutral = ko.computed(function () {
        return self.owned(0).length + self.warpgates();
    });

    // total facilities on continent
    self.facilities = ko.computed(function () {
        return $.grep(self.regions(), function (n, i) {
            return parent.facilityRegions().indexOf(n.RowData.RegionId) > -1;
        }).length;
    });
    
    self.hasBonusFor = function (typeId) 
    {
        var plants = Enumerable.From(parent.facilities())
                        .Where("$.facility_type.id == " + typeId)
                        .ToArray();

        var has = $.grep(plants, function (x) {
            return $.grep(self.regions(), function (e) {
                return ((x.region_id == e.RowData.RegionId) && (e.RowData.FactionId == parent.empire()));
            }).length > 0;
        });

        return has.length;
    };

    self.hasContinentBonus = ko.computed(function () {
        return self.bonus() == parent.empire();
    });
    
    self.hasBioBonus = ko.computed(function () {
        return self.hasBonusFor(3);
    });
    
    self.hasTechBonus = ko.computed(function () {
        return self.hasBonusFor(4);
    });
    
    self.hasAmpBonus = ko.computed(function () {
        return self.hasBonusFor(2);
    });

    // calculate resource of the given type
    self.calculateResources = function(typeId, faction) {
        return Enumerable.From(self.owned(faction)).
            Sum(function (x) {

                region = parent.regionLookup().Get(x.RowData.RegionId);
                reward = region.map_region_id.hex_reward.reward_group_id_list[0].reward_id;

                if (reward.resource_type.id == typeId) {
                    return parseInt(reward.reward_amount);
                } 
                else {
                    return 0;
                }
            });
    }

    // faction totals
    self.factions = ko.computed(function () {
        return {
            vs: self.owned(1).length, // VS owned regions
            nc: self.owned(2).length, // NC owned regions
            tr: self.owned(3).length  //TR owned regions
        };
    });

    // total accessible regions
    self.total = ko.computed(function () {
        return self.regions().length - self.neutral();
    });

    self.percentage = function (x) {
        return (x / self.total() * 100);
    };

    self.calculateTotals = function (faction) {
        var regions = self.owned(faction);
        return {
            faction: faction,
            regions: regions.length,
            facilities: self.ownedFacilities(faction),
            infantry: self.calculateResources(4, faction),   // infantry resources
            mechanized: self.calculateResources(3, faction), // mechanized resources
            aerospace: self.calculateResources(2, faction)   // aerospace resources
        };
    };

    self.totals = ko.computed(function () {
        return self.calculateTotals(parent.empire());
    });

    self.captureRate = ko.computed(function () {
        var avg = Enumerable.From(self.history())
                  .Where("$.faction == " + parent.empire())
                  .Select("$.regions")
                  .Average();

        return (self.totals().regions / avg);
    });

    self.captureRatePercentage = ko.computed(function () {
        return (self.captureRate() * 100 - 100).toFixed(1);
    });

    // continent traffic light status based on treshold values
    self.status = ko.computed(function () {
        var c = self.totals().regions;
        var p = self.percentage(c);

        if (p > parent.tresholdTerritoryHigh()) {
            return 1;
        }

        if (p > parent.tresholdTerritoryLow()) {
            return 0;
        }

        return -1;
    });

    self.computeValuesAndHistory = function (value) {
        var history = self.history();

        if (history.length == 120) 
        {
            // remove history from sample
            history.splice(0,3);
        }

        for (var i=1; i<4; i++)
        {
            // get totals
            var totals = self.calculateTotals(i);

            // manage continent bonus
            if (totals.regions == 0 && self.bonus() == i) {
                self.bonus(0);
            } else if (totals.regions == self.total()) {
                self.bonus(i);
            }

            // push totals
            history.push(totals);
        }

        // update history
        self.history(history);
    };

    self.showMap = function () {
        parent.showcontinent(self.zone());
        var map = parent.openMap();
        map.setContinent(self.name().toLowerCase());
    }

    // refresh region data
    self.refresh = function () {
        self.loading(true);
        $.ajax({
            url: census_uri + 'map',
            data: {
                world_id: parent.world,
                zone_ids: zone
            },
            dataType: 'jsonp',
            success: function (data, status) {
                self.regions(data.map_list[0].Regions.Row);
                self.loading(false);
            }
        });
    };

    // performs actions when refresh interval is updated.
    self.updateRefreshInterval = function (interval) {
        clearInterval(self.timer);
        self.timer = setInterval(self.refresh, interval * 1000);
    };

    // dispose model
    self.dispose = function() {
        // unsubscribe
        for (var i in self.subscriptions) {
            self.subscriptions[i].dispose();
        }
    }
    
    // setup subscriptions & initialize
    self.subscriptions.push(parent.refreshInterval.subscribe(self.updateRefreshInterval));
    self.subscriptions.push(self.regions.subscribe(self.computeValuesAndHistory));
    
    self.updateRefreshInterval(parent.refreshInterval());
    
    self.refresh();
}


function WorldViewModel(world, empire) {

    // variables
    var self = this;
    self.mapTimer = 0;
    self.map = null;

    // observables
    self.showmap = ko.observable(false);
    
    self.showcontinent = ko.observable();
    

    self.worlds = ko.observableArray();
    self.world = ko.observable(world);
    self.empire = ko.observable(empire);
    self.zones = ko.observableArray();
    self.continents = ko.observableArray();

    self.zone = ko.computed(function () {
        return Enumerable.From(self.continents())
                      .Where("$.zone() == " + self.showcontinent())
                      .FirstOrDefault();
    });


    self.regions = ko.observableArray();
    self.refreshInterval = ko.observable(20);
    self.tresholdTerritoryHigh = ko.observable(33.33);
    self.tresholdTerritoryLow = ko.observable(10);
    self.factions = ko.observableArray([
        { id: 1, name: "Vanu Sovereignty"},
        { id: 2, name: "New Conglomerate"},
        { id: 3, name: "Terran Republic"},
    ]);


        self.bookmarkUrl = ko.computed(function () {
            return app_uri.attr("protocol") + "://" + app_uri.attr("host") + app_uri.attr("path") + "?w=" + self.world() + "&f=" + self.empire();
        });

    // World name (computed)
    self.name = ko.computed(function() {
        return Enumerable.From(self.worlds())
                      .Where("$.server_id == " + self.world())
                      .Select("$.name.en")
                      .ToArray();
    });

    self.getRegionIds = function (regionArray) {
        return Enumerable.From(regionArray)
                      .Select("$.region_id")
                      .ToArray();
    };
    
    self.facilities = ko.computed(function() {
       return Enumerable.From(self.regions())
               .Where("['2','3','4'].indexOf($.facility_type.id) > -1")
               .ToArray();
    });
    
    self.warpgates = ko.computed(function() {
       return Enumerable.From(self.regions())
               .Where("$.facility_type.id == 7")
               .ToArray();
    });
   
    self.facilityRegions = ko.computed(function () {
        return self.getRegionIds(self.facilities());
    });

    self.regionLookup = ko.computed(function () {
        return Enumerable.From(self.regions())
                         .ToDictionary("$.region_id", "$");
    });

    self.loadContinents = function () {
        for (var i in self.continents()) {
            self.continents()[i].dispose();
        }
        self.continents.removeAll();
        self.continents.push(new ContinentViewModel(self, 2));
        self.continents.push(new ContinentViewModel(self, 6));
        self.continents.push(new ContinentViewModel(self, 8));
    };

    self.loadWorlds = function() {
        return $.ajax({
            url: census_uri + 'world?',
            dataType: 'jsonp',
            success: function (data, status) {
                list = data.world_list
                list.sort(function(a,b) { return a.name.en > b.name.en } )
                self.worlds(list);
            }
        });
    };
    
    self.loadZones = function() {
      return $.ajax({
            url: census_uri + 'zone',
            data: {
                "c:limit": 100
            },
            dataType: 'jsonp',
            success: function (data, status) {
                self.zones(data.zone_list);
            }
        });   
    };
    
    self.loadFacilities = function (name) {
        return $.ajax({
            url: census_uri + name + 'map?',
            data: {
                "c:limit": 100
            },
            dataType: 'jsonp',
            success: function (data, status) {
                var arr = self.regions();
                ko.utils.arrayPushAll(arr, data[name + "map_list"]);
                self.regions(arr);
            }
        });
    };

    self.openMap = function () {
        self.showmap(true)

        if (!self.map) {
            self.map = new ps2hq.Map('mapContainer');
            self.map.showGrid(false)
        }

        ps2hq.map.SectorHelper.stopAutoUpdateSectors(self.mapTimer);
        self.mapTimer = ps2hq.map.SectorHelper.autoUpdateSectors(self.map, {
            worldId: self.world(),
            serviceId: census_serviceid,
            interval: self.refreshInterval()
        });

        ;
        $(".continent-control").hide();

        return self.map;
    }

    self.closeMap = function () {
        ps2hq.map.SectorHelper.stopAutoUpdateSectors(self.mapTimer);
        self.showmap(false);
    }

    self.selectText = function (data, event) {
        $(event.target).select();
    }

    // when the world changes we must update our continents
    self.world.subscribe(function (value) {
        if (self.showmap() == true) {
            ps2hq.map.SectorHelper.stopAutoUpdateSectors(self.mapTimer);
            self.mapTimer = ps2hq.map.SectorHelper.autoUpdateSectors(self.map, {
                worldId: value,
                serviceId: census_serviceid,
                interval: self.refreshInterval()
            });
        }
        self.loadContinents();
    });

    // load masterdata and world.
    $.when(
           self.loadZones()
           , self.loadFacilities("indar")
           , self.loadFacilities("amerish")
           , self.loadFacilities("esamir")
    ).done(function () {
        // execute if all ajax calls are finished
        self.loadWorlds();
    });   
}


$(function () {
    w = app_uri.param("w");
    f = app_uri.param("f");

    w = (undefined != w) ? parseInt(w) : 0;
    f = (undefined != f) ? parseInt(f) : 0;

    ko.applyBindings(new WorldViewModel(w, f));
});