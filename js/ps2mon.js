/* 
Author:  Armand Pondman
Email : apondman@live.nl

Planetside 2 World Monitor

// todo: events for captures 
// todo: implement service id
*/

var census_uri = "http://census.soe.com/get/ps2-beta";
var census_serviceid = "";

function ContinentViewModel(parent, zone) {
    var self = this;

    self.subscriptions = [];
    self.zone = ko.observable(zone);
    self.regions = ko.observableArray();
    self.regionHistory = ko.observableArray();
    self.loading = ko.observable(true);
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
    self.calculateResources = function(typeId) {
        return Enumerable.From(self.owned(parent.empire())).
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

     // empire totals
     self.totals = ko.computed(function () {
        var faction = parent.empire();
        var regions = self.owned(faction);

        return {
            regions: regions.length,
            facilities: self.ownedFacilities(faction),
            infantry: self.calculateResources(4),  // infantry resources
            mechanized: self.calculateResources(3), // mechanized resources
            aerospace: self.calculateResources(2) // aerospace resources
        };
    });

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

    

    /*
    self.regions.subscribe(function (newValue) 
    {
        // todo: limit history buffer
        // todo: pop? remove? and push

        //self.regionHistory.push(newValue);
    });
    */

    // refresh region data
    self.refresh = function () {
        self.loading(true);
        $.ajax({
            url: census_uri + '/map',
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

    //this.myObservable.subscribe(function(previousValue){
    //I'd like to get the previous value of 'myObservable' here before it's set to newValue
    //}, this, "beforeChange");

    // dispose model
    self.dispose = function() {
        // unsubscribe
        for (var i in self.subscriptions) {
            self.subscriptions[i].dispose();
        }
    }
    
    // setup subscriptions & initialize
    self.subscriptions.push(parent.refreshInterval.subscribe(self.updateRefreshInterval));
    self.updateRefreshInterval(parent.refreshInterval());
    
    self.refresh();
}


function WorldViewModel(world, empire) {
    var self = this;

    self.world = ko.observable();
    self.empire = ko.observable(empire);
    self.zones = ko.observableArray();
    self.continents = ko.observableArray();
    self.regions = ko.observableArray();
    self.worlds = ko.observableArray();
    self.refreshInterval = ko.observable(20);
    
    self.tresholdTerritoryHigh = ko.observable(33.33);
    self.tresholdTerritoryLow = ko.observable(10);

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
            url: census_uri + '/world',
            dataType: 'jsonp',
            success: function (data, status) {
                self.worlds(data.world_list);
                self.world(world);
            }
        });
    };
    
    self.loadZones = function() {
      return $.ajax({
            url: census_uri + '/zone',
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
            url: census_uri + '/' + name + 'map',
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

    // when the world changes we must update our continents    
    self.world.subscribe(function (newValue) {
        // todo: something fishy here with loading dropdown and setting world id 3 times
        self.loadContinents();   
    });
    
    // load masterdata and world.
    $.when(self.loadZones()
           ,self.loadFacilities("indar")
           ,self.loadFacilities("amerish")
           ,self.loadFacilities("esamir")
    ).done(function(){
        // execute if all ajax calls are finished
        self.loadWorlds(world);
    });   
}


$(function () {
    ko.applyBindings(new WorldViewModel(9, 2));
});