// ==UserScript==
// @name         Implant Image Replacer
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Replace images of implants with custom images for easier recognition, custom made for TurboBongRips3
// @author       Runonstof
// @match        *fairview.deadfrontier.com/onlinezombiemmo/index.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=deadfrontier.com
// @grant        unsafeWindow
// ==/UserScript==


(function() {
    'use strict';

    // Map of original image URLs to custom image URLs
    const imageMap = {
        // Use: https://base64.guru/converter/encode/image/webp
        // To convert to base 64 ^^, select the "Data URI -- data:content/type;base64" option!!

        // 'https://example.org/someimage.png': 'data:content/type;base64,base64stringhere==', // <--- DONT FORGET THE COMMAS
        'https://files.deadfrontier.com/deadfrontier/inventoryimages/large/elfimplant.png': 'data:image/webp;base64,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',
        'https://files.deadfrontier.com/deadfrontier/inventoryimages/large/sugarrushimplant.png': 'data:image/webp;base64,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',
        
        // Add more mappings as needed
    };

    // Function to replace background images
    const replaceBackgroundImage = element => {
        const originalBackgroundImage = window.getComputedStyle(element).backgroundImage;
        const originalUrlMatch = originalBackgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (originalUrlMatch && originalUrlMatch[1] in imageMap) {
            const newUrl = `url(${imageMap[originalUrlMatch[1]]})`;
            element.style.backgroundImage = newUrl;
        }
    };

    // Mutation observer to handle dynamically added elements with background images
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.target.nodeType === 1) {
                if (window.getComputedStyle(mutation.target).backgroundImage !== 'none') {
                    replaceBackgroundImage(mutation.target);
                }
            }

            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    // Check if the element has background image set via CSS
                    const computedStyle = window.getComputedStyle(node);
                    if (computedStyle.backgroundImage !== 'none') {
                        replaceBackgroundImage(node);
                    }
                    // Check if any child elements have background images
                    node.querySelectorAll('*').forEach(child => {
                        if (window.getComputedStyle(child).backgroundImage !== 'none') {
                            replaceBackgroundImage(child);
                        }
                    });
                }
            });
        });
    });

    // Observe changes to the DOM
    observer.observe(unsafeWindow.document.body, {
        childList: true,
        subtree: true
    });

    // Initial replacement on existing elements with background images
    unsafeWindow.document.querySelectorAll('*').forEach(element => {
        if (window.getComputedStyle(element).backgroundImage !== 'none') {
            replaceBackgroundImage(element);
        }
    });

})();