
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Position error object
 *
 * @param code
 * @param message
 */
function PositionError(code, message) {
    this.code = code;
    this.message = message;
};

PositionError.PERMISSION_DENIED = 1;
PositionError.POSITION_UNAVAILABLE = 2;
PositionError.TIMEOUT = 3;

/**
 * navigator._geo
 *
 * Provides access to device GPS.
 */
var Geolocation = Geolocation || (function() {
    /**
     * @constructor
     */
    function Geolocation() {

        // The last known GPS position.
        this.lastPosition = null;

        // Geolocation listeners
        this.listeners = {};
    };

    /**
     * Acquires the current geo position.
     *
     * @param {Function} successCallback    The function to call when the position data is available
     * @param {Function} errorCallback      The function to call when there is an error getting the heading position. (OPTIONAL)
     * @param {PositionOptions} options     The options for getting the position data. (OPTIONAL)
     */
    Geolocation.prototype.getCurrentPosition = function(successCallback, errorCallback, options) {

        var id = "global";
        if (navigator._geo.listeners[id]) {
            console.log("Geolocation Error: Still waiting for previous getCurrentPosition() request.");
            try {
                errorCallback(new PositionError(PositionError.TIMEOUT,
                        "Geolocation Error: Still waiting for previous getCurrentPosition() request."));
            } catch (e) {
            }
            return;
        }

        // default maximumAge value should be 0, and set if positive
        var maximumAge = 0;

        // default timeout value should be infinity, but that's a really long time
        var timeout = 3600000;

        var enableHighAccuracy = false;
        if (options) {
            if (options.maximumAge && (options.maximumAge > 0)) {
                maximumAge = options.maximumAge;
            }
            if (options.enableHighAccuracy) {
                enableHighAccuracy = options.enableHighAccuracy;
            }
            if (options.timeout) {
                timeout = (options.timeout < 0) ? 0 : options.timeout;
            }
        }
        navigator._geo.listeners[id] = {"success" : successCallback, "fail" : errorCallback };
        Cordova.exec(null, errorCallback, "Geolocation", "getCurrentPosition",
                [id, maximumAge, timeout, enableHighAccuracy]);
    };

    /**
     * Monitors changes to geo position.  When a change occurs, the successCallback
     * is invoked with the new location.
     *
     * @param {Function} successCallback    The function to call each time the location data is available
     * @param {Function} errorCallback      The function to call when there is an error getting the location data. (OPTIONAL)
     * @param {PositionOptions} options     The options for getting the location data such as frequency. (OPTIONAL)
     * @return String                       The watch id that must be passed to #clearWatch to stop watching.
     */
    Geolocation.prototype.watchPosition = function(successCallback, errorCallback, options) {

        // default maximumAge value should be 0, and set if positive
        var maximumAge = 0;

        // DO NOT set timeout to a large value for watchPosition in BlackBerry.
        // The interval used for updates is half the timeout value, so a large
        // timeout value will mean a long wait for the first location.
        var timeout = 10000;

        var enableHighAccuracy = false;
        if (options) {
            if (options.maximumAge && (options.maximumAge > 0)) {
                maximumAge = options.maximumAge;
            }
            if (options.enableHighAccuracy) {
                enableHighAccuracy = options.enableHighAccuracy;
            }
            if (options.timeout) {
                timeout = (options.timeout < 0) ? 0 : options.timeout;
            }
        }
        var id = Cordova.createUUID();
        navigator._geo.listeners[id] = {"success" : successCallback, "fail" : errorCallback };
        Cordova.exec(null, errorCallback, "Geolocation", "watchPosition",
                [id, maximumAge, timeout, enableHighAccuracy]);
        return id;
    };

    /*
     * Native callback when watch position has a new position.
     */
    Geolocation.prototype.success = function(id, result) {

        var p = result.message;
        var coords = new Coordinates(p.latitude, p.longitude, p.altitude,
                p.accuracy, p.heading, p.speed, p.alt_accuracy);
        var loc = new Position(coords, p.timestamp);
        try {
            navigator._geo.lastPosition = loc;
            navigator._geo.listeners[id].success(loc);
        }
        catch (e) {
            console.log("Geolocation Error: Error calling success callback function.");
        }

        if (id == "global") {
            delete navigator._geo.listeners["global"];
        }
    };

    /**
     * Native callback when watch position has an error.
     *
     * @param {String} id       The ID of the watch
     * @param {Object} result   The result containing status and message
     */
    Geolocation.prototype.fail = function(id, result) {
        var code = result.status;
        var msg = result.message;
        try {
            navigator._geo.listeners[id].fail(new PositionError(code, msg));
        }
        catch (e) {
            console.log("Geolocation Error: Error calling error callback function.");
        }

        if (id == "global") {
            delete navigator._geo.listeners["global"];
        }
    };

    /**
     * Clears the specified position watch.
     *
     * @param {String} id       The ID of the watch returned from #watchPosition
     */
    Geolocation.prototype.clearWatch = function(id) {
        Cordova.exec(null, null, "Geolocation", "stop", [id]);
        delete navigator._geo.listeners[id];
    };

    /**
     * Is Cordova implementation being used.
     */
    var usingCordova = false;

    /**
     * Force Cordova implementation to override navigator.geolocation.
     */
    var useCordova = function() {
        if (usingCordova) {
            return;
        }
        usingCordova = true;

        // Set built-in geolocation methods to our own implementations
        // (Cannot replace entire geolocation, but can replace individual methods)
        navigator.geolocation.getCurrentPosition = navigator._geo.getCurrentPosition;
        navigator.geolocation.watchPosition = navigator._geo.watchPosition;
        navigator.geolocation.clearWatch = navigator._geo.clearWatch;
        navigator.geolocation.success = navigator._geo.success;
        navigator.geolocation.fail = navigator._geo.fail;
    };

    /**
     * Define navigator.geolocation object.
     */
    Cordova.addConstructor(function() {
        navigator._geo = new Geolocation();

        // if no native geolocation object, use Cordova geolocation
        if (typeof navigator.geolocation === 'undefined') {
            navigator.geolocation = navigator._geo;
            usingCordova = true;
        }
    });

    /**
     * Enable developers to override browser implementation.
     */
    return {
        useCordova: useCordova
    };
}());
