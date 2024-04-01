// ==UserScript==
// @name         Item Color Marker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Marks items with a specific color to your choosing
// @author       Runonstof
// @match        *fairview.deadfrontier.com/onlinezombiemmo/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=deadfrontier.com
// @grant        unsafeWindow
// @grant        GM.getValue
// @grant        GM.setValue
// @license      MIT
// ==/UserScript==

(async function() {
    'use strict';

    
    /******************************************************
     * Globals
     ******************************************************/
    const FORM = {
        defaults: {
            itemId: 'penknife',

            backgroundColor1: '#ffffff',
            backgroundOpacity: 0,
            backgroundColor2: '#ffffff',
            backgroundOpacity: 0,

            gradient: false,
            gradientDirection: 'to bottom right',

            border: false,
            borderColor1: '#ffffff',
            borderColor2: '#ffffff',
            borderType: 'solid',
            borderWidth: '1px',
        },
        data: {},
        resetForm() {
            this.data = {...this.defaults};
        },
    };

    FORM.resetForm(); // Fill the form with default values


    /******************************************************
     * Utility functions
     ******************************************************/
    
    function GM_initStyle(namespace = '') {
        const styleId = `GM_addStyle_Runon_colorMarker${namespace}`;

        return document.getElementById(styleId) || (function() {
            const style = document.createElement('style');
            style.type = 'text/css';
            style.id = styleId;
            document.head.appendChild(style);
            return style;
        })();
    }
    
    function GM_addStyle(css, namespace = '') {
        const style = GM_initStyle(namespace);

        const sheet = style.sheet;
 
        sheet.insertRule(css, (sheet.rules || sheet.cssRules || []).length);
    }


    function GM_clearStyle(namespace = '') {
        // empties the style tag
        const style = GM_initStyle(namespace);
        const sheet = style.sheet;

        const rules = sheet.rules || sheet.cssRules;

        for (let i = rules.length - 1; i >= 0; i--) {
            sheet.deleteRule(i);
        }
    }
 
    function GM_addStyle_object(selector, rules, namespace = '') {
        const nested = [];

        let ruleCount = 0;
        let css = selector + "{";
        for (const key in rules) {
            if (typeof rules[key] === "object") {
                nested.push({selector: key, rules: rules[key]})
                continue;
            }
            ruleCount++;
            css += key.replace(/([A-Z])/g, g => `-${g[0].toLowerCase()}`) + ":" + rules[key] + ";";
        }
        css += "}";

        if (ruleCount) {
            GM_addStyle(css, namespace);
        }

        for(const nestedRules of nested) {
            const nestedSelector = nestedRules.selector.replace(/\&/g, selector);

            GM_addStyle_object(nestedSelector, nestedRules.rules, namespace);
        }
    }
    
    function getGlobalDataItemId(rawItemId) {
        return rawItemId.split('_')[0];
    }

    function getBaseItemId(rawItemId) {
        return rawItemId.replace(/_stats\d+/, '');
    }

    function combineHexColorAndOpacity(color, opacity) {
        return color + (
            opacity == 1
                ? ''
                : Math.round(opacity * 255).toString(16).padStart(2, '0')
        );
    }

    /**
     * Parse settings to a style object that can be used by GM_addStyle_object
     * 
     * @param {String} itemId
     * @param {Object} itemStyle 
     * @returns {Object}
     */
    function parseItemStyle(itemId, itemStyle) {
        let {
            backgroundColor1 = null,
            backgroundOpacity = 0,
            backgroundColor2 = null,

            border = false,
            borderColor1 = null,
            borderColor2 = null,
            borderType = 'solid', // solid, dashed, dotted
            borderWidth = '1px',

            // Used by both backgroundColor and borderColor
            gradient = false, // if color2 is used or not
            gradientDirection = 'to bottom right',

        } = itemStyle;

        const style = {};

        const bgImage = `url('https://files.deadfrontier.com/deadfrontier/inventoryimages/large/${itemId}.png')`;

        if (backgroundColor1) {
            style.backgroundImage = `${bgImage}, linear-gradient(${gradientDirection}, ${combineHexColorAndOpacity(backgroundColor1, backgroundOpacity)}, ${combineHexColorAndOpacity(backgroundColor1, backgroundOpacity)}) !important`;
        }

        if (gradient && backgroundColor2) {
            style.backgroundImage = `${bgImage}, linear-gradient(${gradientDirection}, ${combineHexColorAndOpacity(backgroundColor1, backgroundOpacity)}, ${combineHexColorAndOpacity(backgroundColor2, backgroundOpacity)}) !important`;
        }

        if (border && borderColor1) {
            style.borderColor = combineHexColorAndOpacity(borderColor1, 1);
        }

        if (border && gradient && borderColor2) {
            delete style.borderColor;

            style.borderImage = `linear-gradient(${gradientDirection}, ${combineHexColorAndOpacity(borderColor1, 1)}, ${combineHexColorAndOpacity(borderColor2, 1)}) 1 !important`;
        }

        if (style.borderColor || style.borderImage) {
            style.borderStyle = borderType;
            style.borderWidth = borderWidth;
        }

        return style;
    }

    async function refreshStyleFromData() {
        const itemColorStyles = await GM.getValue('itemColorStyles', {});

        GM_clearStyle('dynamic');

        for (const itemId in itemColorStyles) {
            const itemStyle = itemColorStyles[itemId];
            const selector = `div.item[data-type^="${itemId}"], div.fakeItem[data-type^="${itemId}"]`;

            GM_addStyle_object(selector, parseItemStyle(itemId, itemStyle), 'dynamic');
        }
    }

    function refreshPreviewStyle() {
        const previewStyle = parseItemStyle(FORM.data.itemId, FORM.data);
        const selector = `#itemColorPreview div.item, #itemColorPreview div.fakeItem`;

        GM_clearStyle('preview');

        GM_addStyle_object(selector, previewStyle, 'preview');
    }


    async function renderItemColorPrompt(itemId) {
        pageLock = true;

        FORM.data.itemId = itemId;
        refreshPreviewStyle();

        unsafeWindow.prompt.classList.remove("warning");
        unsafeWindow.prompt.classList.remove("redhighlight");

        unsafeWindow.prompt.style.height = "200px";

        unsafeWindow.prompt.innerHTML = `   
            <div id="itemColorForm">
                <div style="text-align: center; text-decoration: underline;">Item Color Marker</div>
                <div id="itemColorPreview" class="validSlot">
                    <div class="item" data-type="${FORM.data.itemId}"></div>
                </div>

                <div style="position: absolute; top: 80px; width: 120px;">
                    <label for="backgroundColor1">Background Color 1</label>
                    <input type="color" id="backgroundColor1" name="backgroundColor1" value="${FORM.data.backgroundColor1}" style="width: 100%;">
                    
                    <label for="backgroundOpacity">Opacity</label>
                    <input type="range" id="backgroundOpacity" name="backgroundOpacity" min="0" max="1" step="0.1" value="${FORM.data.backgroundOpacity}" style="width: 100%;">
                </div>
                <div style="position: absolute; right: 0; top: 80px; width: 120px;">
                    <label for="backgroundColor2">Background Color 2</label>
                    <input type="color" id="backgroundColor2" name="backgroundColor2" value="${FORM.data.backgroundColor2}" style="width: 100%;">

                    <label>
                        <input type="checkbox" id="gradient" name="gradient" ${FORM.data.gradient ? 'checked' : ''}>
                        Gradient
                    </label>
                </div>

                <div style="position: absolute; top: 180px; left: 5px;">
                    <button id="clearColorMarker">Clear color</button>
                </div>
                <div style="position: absolute; top: 180px; right: 5px;">
                    <button id="saveColorMarker">Save</button>
                </div>
            </div>
        `;

        unsafeWindow.document.getElementById('backgroundColor1').addEventListener('input', e => {
            // console.log('new color: ', e.target.value);
            FORM.data.backgroundColor1 = e.target.value;

            refreshPreviewStyle();
        });

        unsafeWindow.document.getElementById('backgroundOpacity').addEventListener('input', e => {
            // console.log('new opacity: ', e.target.value);
            FORM.data.backgroundOpacity = parseFloat(e.target.value);

            refreshPreviewStyle();
        });

        unsafeWindow.document.getElementById('backgroundColor2').addEventListener('input', e => {
            // console.log('new color: ', e.target.value);
            FORM.data.backgroundColor2 = e.target.value;

            refreshPreviewStyle();
        });

        unsafeWindow.document.getElementById('gradient').addEventListener('change', e => {
            // console.log('new gradient: ', e.target.checked);
            FORM.data.gradient = e.target.checked;

            refreshPreviewStyle();
        });

        unsafeWindow.document.getElementById('clearColorMarker').addEventListener('click', async e => {
            const itemColorStyles = await GM.getValue('itemColorStyles', {});

            delete itemColorStyles[FORM.data.itemId];

            await GM.setValue('itemColorStyles', itemColorStyles);

            await refreshStyleFromData();
            
            unsafeWindow.prompt.parentNode.style.display = "none";
            pageLock = false;
        });
        

        unsafeWindow.document.getElementById('saveColorMarker').addEventListener('click', async e => {
            const itemColorStyles = await GM.getValue('itemColorStyles', {});

            itemColorStyles[FORM.data.itemId] = FORM.data;

            await GM.setValue('itemColorStyles', itemColorStyles);

            await refreshStyleFromData();
            FORM.resetForm();
            
            unsafeWindow.prompt.parentNode.style.display = "none";
            pageLock = false;
        });
        
        unsafeWindow.prompt.parentNode.style.display = "block";
        unsafeWindow.prompt.focus();
    }

    function showItemColorTooltipHandler(baseEl, e) {
        const params = new URLSearchParams(unsafeWindow.location.search);

        if (params.get('page') != 50) {
            return;
        }

        if (baseEl.childElementCount == 0) {
            unsafeWindow.cleanPlacementMessage();
            return;
        }

        if (!e.altKey) {
            unsafeWindow.cleanPlacementMessage();
            return;
        }

        unsafeWindow.displayPlacementMessage('Mark color',mousePos[0]+10,mousePos[1]+10,"ACTION");
    }
    

    async function onItemColorTooltipClick(baseEl, e) {
        const params = new URLSearchParams(unsafeWindow.location.search);

        if (params.get('page') != 50) {
            return;
        }

        if (baseEl.childElementCount == 0) {
            return;
        }

        if (!e.altKey) {
            return;
        }

        const itemEl = baseEl.querySelector('.item');

        if (!itemEl) {
            return;
        }

        const itemId = getGlobalDataItemId(itemEl.dataset.type);
        // debugger;
        const itemStyles = await GM.getValue('itemColorStyles', {});
        const itemStyle = itemStyles[itemId] || {};
        const useItemStyle = {...FORM.defaults, ...itemStyle};
        FORM.data = useItemStyle;

        renderItemColorPrompt(itemId);

        // unsafeWindow.displayPlacementMessage('Mark color',mousePos[0]+10,mousePos[1]+10,"ACTION");
    }
    
    /******************************************************
     * Styles
     ******************************************************/

    GM_addStyle_object('#itemColorForm', {
        position: 'relative',
        
        '#itemColorPreview': {
            backgroundImage: "url('https://fairview.deadfrontier.com/onlinezombiemmo/hotrods/hotrods_v9_0_5/HTML5/images/inventory.png')",
            width: '44px',
            height: '44px',
            top: '20px',
            left: 'calc(50% - 22px)',
            position: 'absolute',
        }
    });
    
    /******************************************************
     * Script setup
     ******************************************************/

    await refreshStyleFromData();
    refreshPreviewStyle();

    console.log('awaitin color');
    await new Promise((resolve) => {
        const origPopulateStorage = unsafeWindow.populateStorage;

        unsafeWindow.populateStorage = function () {
            origPopulateStorage();

            resolve();

            unsafeWindow.populateStorage = origPopulateStorage;
        };
    });

    unsafeWindow.document.querySelectorAll('.validSlot').forEach(slot => {
        slot.addEventListener("mousemove",event => showItemColorTooltipHandler(slot, event));
        slot.addEventListener("click",event => onItemColorTooltipClick(slot, event));
    });

    unsafeWindow.GM_addStyle_object = GM_addStyle_object;
    unsafeWindow.renderItemColorPrompt = renderItemColorPrompt;
})();