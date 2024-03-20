// ==UserScript==
// @name         Hover Wiki
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Tired of opening the wiki to see damage values? This script shows item stats on hover, like damage, etc.
// @author       Runonstof
// @match        *fairview.deadfrontier.com/onlinezombiemmo/index.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=deadfrontier.com
// @grant        unsafeWindow
// @grant        GM.getValue
// @grant        GM.setValue
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    
    /******************************************************
     * Constants
     ******************************************************/

    const HPS_TABLE = {
        'Very Slow': 0.968,
        'Slow': 1.429,
        'Average': 1.875,
        'Fast': 2.727,
        'Very Fast': 6.667,
        'Super Fast': 8.571,
        'F***ing Fast!': 8.696,
        'Insanely Fast!': 15,
    };

    // https://deadfrontier.fandom.com/wiki/Stats_and_Levels#Critical_Hit
    const CRIT_MULTIPLIER = 5;

    const CACHE = {
        STATS: {},
    };

    const infoBox = unsafeWindow.infoBox;

    /******************************************************
     * Utility functions
     ******************************************************/

    function getDamageStats(itemId) {
        if (CACHE.STATS.hasOwnProperty(itemId)) {
            return CACHE.STATS[itemId];
        }

        const stats = {
            dph: 0,
            hits: 0, // amount of hits done in a single action/shot
            dpah: 0, // damage per all hits
            cdpah: 0, // crit damage per all hits
            // spread: 0,
            hps: 0, // hits per second
            hs: 0, // hitspeed
            dps: 0,
        };

        if (!unsafeWindow.globalData.hasOwnProperty(itemId)) {
            return false
        }

        const itemData = unsafeWindow.globalData[itemId];

        if (itemData.itemcat != 'weapon') {
            return false;
        }

        // stats.spread = Math.max(parseInt(itemData.spread), 1);
        stats.hits = Math.max(parseInt(itemData.shots_fired), 1);
        
        if (itemData.shot_time) {
            const compareShotTime = itemData.shot_time.replace(/ (Attack|Firing) Speed$/, '');
            stats.hps = HPS_TABLE[compareShotTime] || 0;
        }
      
        stats.dph = parseFloat(itemData.calliber_type) + 1;

        if (itemData.selective_fire_type == 'burst') {
            stats.hits *= parseFloat(itemData.selective_fire_amount);
            stats.dph /= Math.max(parseInt(itemData.selective_fire_amount), 1);
        }

        stats.dps = stats.dph * stats.hits * stats.hps;
        stats.dpah = stats.dph * stats.hits;
        stats.hs = 1 / stats.hps;
        
        if (itemData.critical && !itemData.critical.includes('Zero')) {
            stats.cdpah = stats.dpah * CRIT_MULTIPLIER;
        }

        return CACHE.STATS[itemId] = stats;
    }


    // For other scripts to use
    unsafeWindow.hoverWikiGetDamageStats = getDamageStats;

    
    /******************************************************
     * Function overrides
     ******************************************************/

    
    var origInfoCard = unsafeWindow.infoCard || null;
    if (origInfoCard) {
        inventoryHolder.removeEventListener("mousemove", origInfoCard, false);

        
        unsafeWindow.infoCard = function (e) {
            
            // Call the original infoCard function
            origInfoCard(e);

            if(active || pageLock || !allowedInfoCard(e.target)) {
                return;
            }
 
            let target;
            if(e.target.parentNode.classList.contains("fakeItem"))
            {
                target = e.target.parentNode;
            } else
            {
                target = e.target;
            }

            if (!target.classList.contains('item') && !target.classList.contains('fakeItem')) {
                return;
            }

            const item = target.dataset.type?.split('_')[0] || null;

            if (!item) {
                return;
            }
            //Remove previous stats info
            let elems = document.getElementsByClassName("statsInfoContainer");
            for(let i = elems.length - 1; i >= 0; i--) {
                if (elems[i].dataset.itemId === item) {
                    // No re-render needed
                    return;
                }
                elems[i].parentNode.removeChild(elems[i]);
            }
            

            const itemStats = getDamageStats(item);

            if (itemStats === false) {
                return;
            }

            const allItemStats = Array.from(infoBox.querySelectorAll('.itemData') || []);

            let insertAfter = allItemStats.find(el => el.textContent.match(/ Skill Required$/))
                || allItemStats.find(el => el.textContent.match(/ Chance$/)) 
                || allItemStats.find(el => el.textContent.match(/ Speed$/));

            if (!insertAfter) {
                return;
            }

            const infoContainer = document.createElement('div');
            infoContainer.classList.add('statsInfoContainer');
            infoContainer.dataset.itemId = item;

            const critText = itemStats.cdpah ? ` <span style="font-size: 10px">(<span style="border-bottom: 1px dotted #fff">${itemStats.cdpah} crit</span>)</span>` : '';

            infoContainer.innerHTML = `
            <div class="itemData">Damage: ${itemStats.dph}${ itemStats.hits > 1 ? ` x ${itemStats.hits} = ${itemStats.dpah}` : '' }${critText}</div>
            <div class="itemData">Hitspeed: ${itemStats.hs.toFixed(2)}s</div>
            <div class="itemData">Damage/sec: ${itemStats.dps.toFixed(2)}</div>
            `;
            
            insertAfter.parentNode.insertBefore(infoContainer, insertAfter.nextSibling);
        }.bind(unsafeWindow);
 
        inventoryHolder.addEventListener("mousemove", unsafeWindow.infoCard, false);
    }

})();