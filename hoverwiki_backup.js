// ==UserScript==
// @name         Hover Wiki
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Tired of opening the wiki? This script shows item stats on hover, like damage, etc.
// @author       Runonstof
// @match        *fairview.deadfrontier.com/onlinezombiemmo/index.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=deadfrontier.com
// @grant        unsafeWindow
// @grant        GM.getValue
// @grant        GM.setValue
// @license      MIT
// ==/UserScript==

(async function() {
    'use strict';

    
    /******************************************************
     * Constants & Global Variables
     * 
     * Credits to Rebekah (TectonicStupidity) for dataArr
     ******************************************************/

    const userVars = unsafeWindow.userVars;
    //This information is only accessible for the account you're currently logged into.
    //It is pre-encrypted and this userscript does nothing with it
    //It only uses it to make requests to the server, which is the same as the game does
    const dataArr = [];
    dataArr["userID"] = userVars["userID"];
    dataArr["password"] = userVars["password"];
    dataArr["sc"] = userVars["sc"];
    dataArr["action"] = "get";

    const masteries = {
        melee: 0,
        chainsaw: 0,
        pistol: 0,
        rifle: 0,
        shotgun: 0,
        smg: 0,
        machinegun: 0,
        explosive: 0,
    };

    const masteryIndexMap = { // This is the indexes of the masteries in the response
        melee: 3,
        chainsaw: 4,
        pistol: 5,
        rifle: 6,
        shotgun: 7,
        smg: 8,
        machinegun: 9,
        explosive: 10,
    };

    /******************************************************
     * Utility functions
     ******************************************************/

    /**
     * Same as normal webCall, but async version and does not reload page with 'Connection error' if it fails
     * This is because, this script should NOT halt the website if it fails
     * 
     * Credits to hotrods20 for the original function
     */
    async function silentWebCall(call, params, hashed)
    {
        return await new Promise((resolve, reject) => {
            if(typeof (hashed) === "undefined")
            {
                hashed = false;
            }
    
            var actualCall = call;
            if(window.location.pathname.indexOf("/DF3D/") >= 0)
            {
                actualCall = "../" + actualCall;
            }
        
            if(!prompt && document.getElementById("gamecontent"))
            {
                prompt = document.getElementById("gamecontent");
            }
        
            params = objectJoin(params);
        
            $.ajax({
                type: "POST",
                url: actualCall + ".php",
                data: hashed ? "hash=" + hash(params) + "&" + params : params,
                success(data, status, xhr)
                {
                    if (isValidPacket(call, data, xhr)) {
                        resolve({data, status, xhr});
                    } else {
                        reject({data, status, xhr, reason: 'invalid_packet'});
                    }
                },
                error(xhr, status, error)
                {
                    reject({xhr, status, error, reason: 'xhr_error'});
                }
            });
        });
    }

    /**
     * Checks if the packet is valid
     * 
     * Credits to hotrods20 for the original function
     */
    function isValidPacket(call, data, xhr) {
        var exceptionUrls = ["modify_values", "shop", "surgeon"];
        if($.inArray(call, exceptionUrls) === -1 && xhr["responseURL"] && xhr["responseURL"].indexOf(call + ".php") === -1) {
            return false;
        }

        if(call === "inventory_new" && data === "") {
            return false;
        }
        
        return true;
    }

    function stringExplode(string) {
        return Object.fromEntries(
            string.split("&").map((x) => x.split("="))
        );
    }

    
    /******************************************************
     * Initialize variables
     * 
     * Credits to Rebekah (TectonicStupidity) and hotrods20
     ******************************************************/

    try {
        const response = await silentWebCall('hotrods/load_masteries', dataArr)

        const data = stringExplode(response.data);

        console.log(data);
    } catch (error) {
        console.error(error);
        console.info('Failed to load masteries');

        return false; // Stop the script
    }
    

})();