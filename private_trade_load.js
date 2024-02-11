// ==UserScript==
// @name         Private Trades Opener
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Opens private trade offers immediatly instead of opening the item-for-item screen. Script originally made for Turbobongrips
// @author       Runonstof
// @match        *fairview.deadfrontier.com/onlinezombiemmo/index.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=deadfrontier.com
// ==/UserScript==

(function () {
    const params = new URLSearchParams(window.location.search);

    if (params.get('page') != 27) return;
    unsafeWindow.document.querySelectorAll('script')
        .forEach(s => console.log(s, ));
    // initiatePrivateTrade();
    // stopQueryUpdate();
})();