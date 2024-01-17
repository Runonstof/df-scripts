// ==UserScript==
// @name         Market Trades Tracker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Keep track of your market buy/sale history for Dead Frontier to instantly see your profit and losses
// @author       Runonstof
// @match        *fairview.deadfrontier.com/onlinezombiemmo/index.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=deadfrontier.com
// @grant        unsafeWindow
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

(async function() {
    'use strict';

    /******************************************************
     * Initialize script
     ******************************************************/

    const searchParams = new URLSearchParams(window.location.search);
    const page = parseInt(searchParams.get('page'));
    // If is not on the market page or yard page, stop script
    if (![35, 24].includes(page)) {
        return;
    }

    /* === Global variables === */
    unsafeWindow.historyScreen = 'list'; // 'list', 'stats'

    // Will be set after page init (below script)
    let SEARCHABLE_ITEMS = [];

    const WEBCALL_HOOKS = {
        before: {},
        after: {},
        afterAll: [],
        beforeAll: [],
    };

    const LOOKUP = {
        category__item_id: {},
    };
    
    // Our history object
    // That is responsible for keeping track of all trades
    // And calculating statistics
    const HISTORY = {
        entries: [],
        
        // Cached values, to prevent having to loop through all entries every time
        // Causing performance to improve
        cache: {
            trade_id: {}, // trades indexed by trade_id
            item_id: {}, // trades indexed by item_id

            item_id__amount_sold: {}, // total sell numbers, indexed by item_id
            item_id__amount_bought: {}, // total buy numbers, indexed by item_id
            item_id__avg_price_sold: {}, // average sell price, indexed by item_id
            item_id__avg_price_bought: {}, // average buy price, indexed by item_id
            item_id__last_price_sold: {}, // last sell price, indexed by item_id
            item_id__last_price_bought: {}, // last buy price, indexed by item_id
            item_id__last_quantity_sold: {}, // last sell quantity, indexed by item_id
            item_id__last_quantity_bought: {}, // last buy quantity, indexed by item_id
            item_id__last_date_sold: {}, // last sell date, indexed by item_id
            item_id__last_date_bought: {}, // last buy date, indexed by item_id

            item_id__sold: {}, // trades indexed by trade_id
            item_id__bought: {}, // trades indexed by trade_id
            item_id__scrapped: {}, // trades indexed by trade_id

            pending_trade_ids: [], // trade_ids of pending trades
        },
        storageKey() {
            return 'HISTORY_entries_' + unsafeWindow.userVars.userID;
        },
        resetCache() {
            const entries = this.entries;
            for (const entry of entries) {
                const tradeId = entry.trade_id;
                const itemId = entry.item.split('_')[0];

                this.cache.trade_id[tradeId] = entry;

                if (!this.cache.item_id.hasOwnProperty(itemId)) {
                    this.cache.item_id[itemId] = [];
                }
                this.cache.item_id[itemId].push(entry);

                if (!this.cache.item_id__amount_sold.hasOwnProperty(itemId)) {
                    this.cache.item_id__amount_sold[itemId] = 0;
                }

                if (!this.cache.item_id__amount_bought.hasOwnProperty(itemId)) {
                    this.cache.item_id__amount_bought[itemId] = 0;
                }

                const action = entry.action; // 'buy' or 'sell'
                const itemcat = unsafeWindow.globalData[itemId].itemcat;
                const quantity = realQuantity(entry.quantity, itemcat)

                if (action === 'buy') {
                    this.cache.item_id__amount_bought[itemId] += quantity;
                } else if (action === 'sell') {
                    this.cache.item_id__amount_sold[itemId] += quantity;
                }
            }
        },
        clearCacheForItem(itemId) {
            delete this.cache.item_id__avg_price_sold[itemId];
            delete this.cache.item_id__avg_price_bought[itemId];
            delete this.cache.item_id__last_price_sold[itemId];
            delete this.cache.item_id__last_price_bought[itemId];
            delete this.cache.item_id__last_quantity_sold[itemId];
            delete this.cache.item_id__last_quantity_bought[itemId];
            delete this.cache.item_id__last_date_sold[itemId];
            delete this.cache.item_id__last_date_bought[itemId];
        },
        getTrade(tradeId) {
            if (this.cache.item_id.hasOwnProperty(tradeId)) {
                return this.cache.item_id[tradeId];
            }

            return this.cache.item_id[tradeId] = this.entries.find(entry => entry.trade_id === tradeId);;
        },
        async pushTrade(entry) {
            entry.date = Date.now();

            await this.load();
            this.entries.push(entry);
            await GM.setValue(this.storageKey(), this.entries);

            this.cache.trade_id[entry.trade_id] = entry;

            const itemId = entry.item.split('_')[0];

            // Update cache
            if (!this.cache.item_id.hasOwnProperty(itemId)) {
                this.cache.item_id[itemId] = [];
            }

            this.cache.item_id[itemId].push(entry);

            // Init amount sold and amount bought cache
            if (!this.cache.item_id__amount_sold.hasOwnProperty(itemId)) {
                this.cache.item_id__amount_sold[itemId] = 0;
            }

            if (!this.cache.item_id__amount_bought.hasOwnProperty(itemId)) {
                this.cache.item_id__amount_bought[itemId] = 0;
            }

            // Add to quantity cache
            const action = entry.action; // 'buy' or 'sell'
            const quantity = parseInt(entry.quantity);

            if (action === 'buy') {
                this.cache.item_id__amount_bought[itemId] += quantity;
            } else if (action === 'sell') {
                this.cache.item_id__amount_sold[itemId] += quantity;
            }

            this.clearCacheForItem(itemId);
        },

        // Remove trade from history
        async removeTrade(tradeId) {
            await this.load();
            const index = this.entries.findIndex(entry => entry.trade_id === tradeId);
            if (index == -1) {
                return false;
            }

            const entry = this.entries[index];

            this.entries.splice(index, 1);
            await GM.setValue(this.storageKey(), this.entries);

            // Update cache
            delete this.cache.trade_id[tradeId];

            // Remove from item_id cache
            const itemId = entry.item.split('_')[0];
            if (this.cache.item_id.hasOwnProperty(itemId)) {
                const itemIndex = this.cache.item_id[itemId].findIndex(entry => entry.trade_id === tradeId);
                if (itemIndex > -1) {
                    this.cache.item_id[itemId].splice(itemIndex, 1);
                }
            }

            const quantity = entry.quantity;
            const action = entry.action; // 'buy' or 'sell'
            
            if (action === 'buy' && this.cache.item_id__amount_bought.hasOwnProperty(itemId)) {
                this.cache.item_id__amount_bought[itemId] -= quantity;
            }
            else if (action === 'sell' && this.cache.item_id__amount_sold.hasOwnProperty(itemId)) {
                this.cache.item_id__amount_sold[itemId] -= quantity;
            }

            const pendingTradeIndex = this.cache.pending_trade_ids.indexOf(tradeId);
            if (pendingTradeIndex > -1) {
                this.cache.pending_trade_ids.splice(pendingTradeIndex, 1);
            }

            this.clearCacheForItem(itemId);
            return true;
        },

        // Get info about an item, based on its trades
        getItemInfo(itemId, key) {
            let cacheKey = 'item_id__' + key;
            let trades, action, lastTradeId, lastTradePrice, lastTradeQuantity, lastTradeDate;
            switch (key) {
                case 'amount_sold':
                case 'amount_bought':
                    if (this.cache[cacheKey].hasOwnProperty(itemId)) {
                        return this.cache[cacheKey][itemId];
                    }

                    trades = this.cache.item_id[itemId] || [];
                    action = key == 'amount_sold' ? 'sell' : 'buy';

                    return this.cache[cacheKey][itemId] = trades.reduce((total, trade) => {
                        if (trade.action !== action) {
                            return total;
                        }
                        const tradeItemId = trade.item.split('_')[0];
                        
                        const quantity = realQuantity(trade.quantity, unsafeWindow.globalData[tradeItemId].itemcat);
                        return total + quantity;
                    }, 0);
                    break;

                case 'last_price_sold':
                case 'last_price_bought':
                    if (this.cache[cacheKey].hasOwnProperty(itemId)) {
                        return this.cache[cacheKey][itemId];
                    }

                    trades = this.cache.item_id[itemId] || [];
                    action = key == 'last_price_sold' ? 'sell' : 'buy';

                    lastTradeId = 0;
                    lastTradePrice = 0;

                    for (const trade of trades) {
                        if (trade.action !== action) {
                            continue;
                        }
                        if (trade.item !== itemId) {
                            continue;
                        }
                        if (trade.trade_id <= lastTradeId) {
                            continue;
                        }

                        lastTradeId = trade.trade_id;
                        lastTradePrice = trade.price;
                    }
                    
                    return this.cache[cacheKey][itemId] = lastTradePrice;
                    break;
                case 'last_quantity_sold':
                case 'last_quantity_bought':
                    if (this.cache[cacheKey].hasOwnProperty(itemId)) {
                        return this.cache[cacheKey][itemId];
                    }

                    trades = this.cache.item_id[itemId] || [];
                    action = key == 'last_quantity_sold' ? 'sell' : 'buy';

                    lastTradeId = 0;
                    lastTradeQuantity = 0;

                    for (const trade of trades) {
                        if (trade.action !== action) {
                            continue;
                        }
                        if (trade.trade_id <= lastTradeId) {
                            continue;
                        }
                        const tradeItemId = trade.item.split('_')[0];

                        lastTradeId = trade.trade_id;
                        lastTradeQuantity = realQuantity(trade.quantity, unsafeWindow.globalData[tradeItemId].itemcat);
                    }
                    
                    return this.cache[cacheKey][itemId] = lastTradeQuantity;
                    break;
                case 'last_date_sold':
                case 'last_date_bought':
                    if (this.cache[cacheKey].hasOwnProperty(itemId)) {
                        return this.cache[cacheKey][itemId];
                    }

                    trades = this.cache.item_id[itemId] || [];
                    action = key == 'last_date_sold' ? 'sell' : 'buy';

                    lastTradeId = 0;
                    lastTradeDate = 0;

                    for (const trade of trades) {
                        if (trade.action !== action) {
                            continue;
                        }
                        if (trade.trade_id <= lastTradeId) {
                            continue;
                        }

                        lastTradeId = trade.trade_id;
                        lastTradeDate = trade.date;
                    }

                    return this.cache[cacheKey][itemId] = lastTradeDate;
                    break;

                case 'avg_price_sold':
                case 'avg_price_bought':
                    if (this.cache[cacheKey].hasOwnProperty(itemId)) {
                        return this.cache[cacheKey][itemId];
                    }

                    const amount = this.getItemInfo(itemId, key.replace('avg_price', 'amount')); // amount_sold or amount_bought
                    if (amount == 0) {
                        return this.cache[cacheKey][itemId] = 0;
                    }

                    trades = this.cache.item_id[itemId];
                    let total = 0;
                    for (const trade of trades) {
                        total += parseInt(trade.price);
                    }

                    return this.cache[cacheKey][itemId] = total / amount;
                    break;
                case 'avg_stack_price_sold':
                case 'avg_stack_price_bought':
                    const avgPrice = this.getItemInfo(itemId, key.replace('avg_stack_price', 'avg_price')); // avg_price_sold or avg_price_bought
                    // const totalAmount = this.getItemInfo(itemId, key.replace('avg_stack_price', 'amount')); // amount_sold or amount_bought
                    const stack = maxStack(itemId);

                    return avgPrice * stack;
                    break;
            }
            throw new Error('Invalid key: ' + key);
        },
        

        // Called during debugging
        async forceSave() {
            await GM.setValue(this.storageKey(), this.entries);
        },
        // Called during debugging
        async clearEntries() {
            this.entries = [];
            await this.forceSave();
        },

        async load() {
            this.entries = await GM.getValue(this.storageKey(), []);
        },

        /**
         * Executed when an item is sold, and then the new sell listing is retrieved
         * The response contains the trade id, which is what we need to keep track of the trade
         */
        onSellItem(request, response) {
            const tradeCount = response.dataObj.tradelist_totalsales;
            if (tradeCount == 0) {
                return;
            }
    
            let recentTrade = null;
            const props = [
                'category',
                'deny_private',
                'id_member',
                'id_member_to',
                'item',
                'itemname',
                'member_name',
                'member_to_name',
                'price',
                'pricerper',
                'quantity',
                'trade_id',
                'trade_zone',
            ];
            for(let i = 0; i < tradeCount; i++) {
                const tradeId = response.dataObj['tradelist_' + i + '_trade_id'];
    
                if (recentTrade && recentTrade.trade_id >= tradeId) {
                    continue;
                }
    
                const entry = {
                    action: 'sell',
                };
    
                for (const prop of props) {
                    entry[prop] = response.dataObj['tradelist_' + i + '_' + prop];
                }
    
                recentTrade = entry;
            }
    
            if (!recentTrade) {
                return;
            }
    
            this.pushTrade(recentTrade);
        },
    };


    const SETTINGS = {
        ui: {
            main: {
                title: 'History Menu',
                text: 'Welcome to History Help and Settings!',
                elements: {
                    settings: {
                        type: 'button',
                        title: 'Settings',
                        action() {
                            SETTINGS.renderSettingsPrompt('settings');
                        }
                    },
                    help: {
                        type: 'button',
                        title: 'Help',
                        action() {
                            SETTINGS.renderSettingsPrompt('help');
                        }
                    },
                    export: {
                        type: 'button',
                        title: 'Export',
                        action() {
                            SETTINGS.renderSettingsPrompt('export');
                        }
                    },
                    actions: {
                        type: 'button',
                        title: 'Actions',
                        action() {
                            SETTINGS.renderSettingsPrompt('actions');
                        }
                    },
                    credits: {
                        type: 'button',
                        title: 'Credits',
                        action() {
                            SETTINGS.renderSettingsPrompt('credits');
                        }
                    },
                },
                footerButtons: [
                    {
                        label: 'close',
                        action() {
                            SETTINGS.closePrompt();
                        },
                        style: {
                            right: '12px',
                        }
                    }
                ],
            },
            help: {
                text: 'This script keeps track of all your market trades and your item scraps, and calculates statistics like average sell price.<br><br><span style="color: #FF0000">NOTE:</span> Your history is saved into TamperMonkey data, so if you log in on another computer, your history will not be available there.<br><br>Use the export function to export your history',
                title: 'Help',
                elements: {},
                footerButtons: [
                    {
                        label: 'back',
                        action() {
                            SETTINGS.renderSettingsPrompt('main');
                        },
                        style: {
                            left: '12px',
                        }
                    },
                    {
                        label: 'close',
                        action() {
                            SETTINGS.closePrompt();
                        },
                        style: {
                            right: '12px',
                        }
                    }
                ],
            },
            export: {
                title: 'Export',
                text: 'Export your history to a csv file',
                elements: {
                    exportSortBy: {
                        title: 'Sort by',
                        type: 'switch',
                        description: 'The column to sort by',
                        options: {
                            name: 'Item name',
                            quantity: 'Quantity',
                            price: 'Price',
                            action: 'Trade type',
                            date: 'Date',
                        },
                    },
                    exportSortDirection: {
                        title: 'Sort direction',
                        type: 'switch',
                        description: 'The direction to sort by',
                        options: {
                            asc: 'Ascending',
                            desc: 'Descending',
                        },
                    },
                    exportTimeframe: {
                        title: 'Export timeframe',
                        // type: 'timeframeselect',
                        type: 'switch',
                        description: 'The timeframe that will be used to export the history.',
                        options: {
                            all: 'All time',
                            last_24hr: 'Last 24 hours',
                            last_week: 'Last week',
                            last_month: 'Last month',
                            last_3_months: 'Last 3 months',
                            last_6_months: 'Last 6 months',
                            last_year: 'Last year',
                            ytd: 'Since january 1st',
                            mtd: 'Since 1st of month',
                        }
                    },
                    download: {
                        type: 'button',
                        title: 'Download export',
                        description: 'Starts the exports and downloads the csv file',
                        async action() {
                            await HISTORY.load();

                            const sortBy = SETTINGS.values.exportSortBy;
                            const sortDirection = SETTINGS.values.exportSortDirection;
                            const timeframe = SETTINGS.values.exportTimeframe;
                            let tresholdDate = null;

                            switch (timeframe) {
                                case 'last_24hr':
                                    tresholdDate = new Date();
                                    tresholdDate.setDate(tresholdDate.getDate() - 1);
                                    break;
                                case 'last_week':
                                    tresholdDate = new Date();
                                    tresholdDate.setDate(tresholdDate.getDate() - 7);
                                    break;
                                case 'last_month':
                                    tresholdDate = new Date();
                                    tresholdDate.setMonth(tresholdDate.getMonth() - 1);
                                    break;
                                case 'last_3_months':
                                    tresholdDate = new Date();
                                    tresholdDate.setMonth(tresholdDate.getMonth() - 3);
                                    break;
                                case 'last_6_months':
                                    tresholdDate = new Date();
                                    tresholdDate.setMonth(tresholdDate.getMonth() - 6);
                                    break;
                                case 'last_year':
                                    tresholdDate = new Date();
                                    tresholdDate.setFullYear(tresholdDate.getFullYear() - 1);
                                    break;
                                case 'ytd':
                                    tresholdDate = new Date();
                                    tresholdDate.setMonth(0);
                                    tresholdDate.setDate(1);
                                    break;
                                case 'mtd':
                                    tresholdDate = new Date();
                                    tresholdDate.setDate(1);
                                    break;
                            }

                            let filteredEntries = HISTORY.entries.filter(entry => {
                                const entryDate = new Date(entry.date);
                                if (tresholdDate && entryDate < tresholdDate) {
                                    return false;
                                }
                                return true;
                            });

                            const sortByKey = sortBy == 'name' ? 'item' : sortBy;
                            const sortDirectionMultiplier = sortDirection == 'asc' ? 1 : -1;
                            const sortStrategy = ['price', 'quantity'].includes(sortByKey) ? 'numeric' : 'string';

                            filteredEntries.sort((a, b) => {
                                const aKey = a[sortByKey];
                                const bKey = b[sortByKey];

                                if (sortStrategy == 'numeric') {
                                    return (aKey - bKey) * sortDirectionMultiplier;
                                }

                                if (sortStrategy == 'string') {
                                    if (aKey < bKey) {
                                        return -1 * sortDirectionMultiplier;
                                    }
                                    if (aKey > bKey) {
                                        return 1 * sortDirectionMultiplier;
                                    }
                                    return 0;
                                }

                                throw new Error('Invalid sort strategy: ' + sortStrategy);
                            });

                            filteredEntries = filteredEntries.map(entry => [
                                entry.trade_id,
                                entry.item,
                                entry.itemname,
                                entry.quantity,
                                entry.price,
                                entry.action,
                                formatDate(new Date(entry.date)),
                            ]);

                            // Insert header at top
                            filteredEntries.unshift(['id', 'item', 'name', 'quantity', 'price', 'action', 'date']);

                            exportToCsv('market_trades_tracker_export.csv', filteredEntries, SETTINGS.values.exportSeperator);
                        }
                    }
                },
                footerButtons: [
                    {
                        label: 'back',
                        action() {
                            SETTINGS.renderSettingsPrompt('main');
                        },
                        style: {
                            left: '12px',
                        }
                    },
                    {
                        label: 'close',
                        action() {
                            SETTINGS.closePrompt();
                        },
                        style: {
                            right: '12px',
                        }
                    }
                ],
            },
            actions: {
                title: 'Actions',
                text: '',
                elements: {
                    clear: {
                        type: 'button',
                        title: 'Clear all history',
                        description: 'Forgets all market sell/buy/scrap history<br><br><span style="color: #FF0000">WARNING:</span> This cannot be undone!',
                        action() {
                            SETTINGS.renderSettingsPrompt('clear_confirm');
                        }
                    },
                    clearCache: {
                        type: 'button',
                        title: 'Clear cache',
                        description: 'Clears the cache, which will cause the script to recalculate all statistics',
                        action() {
                            HISTORY.resetCache();
                            alert('Cache cleared');
                        }
                    },
                },
                footerButtons: [
                    {
                        label: 'back',
                        action() {
                            SETTINGS.renderSettingsPrompt('main');
                        },
                        style: {
                            left: '12px',
                        }
                    },
                    {
                        label: 'close',
                        action() {
                            SETTINGS.closePrompt();
                        },
                        style: {
                            right: '12px',
                        }
                    }
                ],
            },
            clear_confirm: {
                class: 'warning',
                title: 'Clear history',
                text: 'Are you really sure you want to clear ALL history?<br><br>You can also delete single entries from the history tab in marketplace.<br><br><span style="color: #FF0000">WARNING:</span> This cannot be undone!',
                elements: {},
                footerButtons: [
                    {
                        label: 'no',
                        action() {
                            SETTINGS.renderSettingsPrompt('actions');
                        },
                        style: {
                            left: '12px',
                        }
                    },
                    {
                        label: 'yes',
                        async action() {
                            await HISTORY.clearEntries();
                            HISTORY.resetCache();
                            SETTINGS.closePrompt();
                        },
                        style: {
                            right: '12px',
                        }
                    }
                ]
            },
            credits: {
                title: 'Credits',
                text: 'This script was made by <span style="color: #FF0000">Runonstof</span>. If you have any questions or suggestions, feel free to contact me on Discord: <span style="color: #FF0000">runon</span>',
                elements: {
                    donate: {
                        type: 'button',
                        title: 'Donate',
                        description: 'Redirects to my profile page, where you can donate anything if you want to support me.',
                        action() {
                            window.location.href = '/onlinezombiemmo/index.php?action=profile;u=12925065';
                        }
                    }
                },
                footerButtons: [
                    {
                        label: 'back',
                        action() {
                            SETTINGS.renderSettingsPrompt('main');
                        },
                        style: {
                            left: '12px',
                        }
                    },
                    {
                        label: 'close',
                        action() {
                            SETTINGS.closePrompt();
                        },
                        style: {
                            right: '12px',
                        }
                    }
                ],
            },
            settings: {
                title: 'Settings',
                text: '',
                elements: {
                    hoverAvgPriceEnabled: {
                        title: 'Avg price hover enabled',
                        description: 'Show average sell/buy price and profit/loss in set timeframe on item hover',
                        type: 'checkbox',
                    },
                    hoverLastPriceEnabled: {
                        title: 'Last price hover enabled',
                        description: 'Show last sell/buy price and date on item hover',
                        type: 'checkbox',
                    },
                    autoFillBreakEvenPrice: {
                        title: 'Auto fill price',
                        type: 'checkbox',
                        description: 'When selling an item, the price will be automatically filled in with the average sell price in the set timeframe.',
                    },
                    countPendingTrades: {
                        title: 'Calculate with pending',
                        type: 'checkbox',
                        description: 'When calculating statistics, pending trades will be taken into account.',
                    },
                    countScraps: {
                        title: 'Calculate with scraps',
                        type: 'checkbox',
                        description: 'When calculating statistics, scraps will be taken into account.',
                    },
                    statisticsTimeframe: {
                        title: 'Timeframe',
                        // type: 'timeframeselect',
                        type: 'switch',
                        description: 'The timeframe that will be used to calculate statistics.',
                        options: {
                            all: 'All time',
                            last_24hr: 'Last 24 hours',
                            last_week: 'Last week',
                            last_month: 'Last month',
                            last_3_months: 'Last 3 months',
                            last_6_months: 'Last 6 months',
                            last_year: 'Last year',
                            ytd: 'Since january 1st',
                            mtd: 'Since 1st of month',
                        }
                    },
                },
                footerButtons: [
                    {
                        label: 'back',
                        action() {
                            SETTINGS.renderSettingsPrompt('main');
                        },
                        style: {
                            left: '12px',
                        }
                    },
                    {
                        label: 'close',
                        action() {
                            SETTINGS.closePrompt();
                        },
                        style: {
                            right: '12px',
                        }
                    }
                ],
            },
        },
        // Seperate values object, where settings are loaded one by one, for if i decide to add settings later on
        values: {
            // If true, sell/buy statistics will be shown in the item tooltip when an item is hovered
            hoverEnabled: true,
            statisticsTimeframe: 'all',
            // If true, the script will automatically fill in the price when selling an item
            // The price will be the average buy price of the item of the configured timeframe
            autoFillBreakEvenPrice: true,
            // If true, the script will take trades that are still pending into account when calculating statistics
            countPendingTrades: true,
            countScraps: true,
            exportSortBy: 'date',
            exportSortDirection: 'asc',
            exportTimeframe: 'all',
            exportSeperator: ';',
        },
        async reset() {
            await GM.setValue('SETTINGS_values', {});
            this.values = {};

            await this.load();
        },
        async load() {
            const values = await GM.getValue('SETTINGS_values', {});

            // Merge values with default values
            this.values = mergeDeep(this.values, values);
        },
        async save() {
            await GM.setValue('SETTINGS_values', this.values);
        },
        async toggle(setting) {
            await this.load();
            this.values[setting] = !this.values[setting];
            await this.save();
        },
        async set(setting, value) {
            await this.load();
            this.values[setting] = value;
            await this.save();
        },
        closePrompt() {
            unsafeWindow.prompt.parentNode.style.display = "none";
            unsafeWindow.prompt.innerHTML = "";
            unsafeWindow.prompt.style.height = "";
            pageLock = false;
			unsafeWindow.prompt.classList.remove("warning");
			unsafeWindow.prompt.classList.remove("redhighlight");
        },
        renderSettingsPrompt(page = 'main') {
            pageLock = true;

			unsafeWindow.prompt.classList.remove("warning");
			unsafeWindow.prompt.classList.remove("redhighlight");

            const pageInfo = this.ui[page];

            if (pageInfo.class) {
                unsafeWindow.prompt.classList.add(pageInfo.class);
            }

        	unsafeWindow.prompt.style.height = "280px";
            unsafeWindow.prompt.innerHTML = pageInfo.title ? '<div style="text-align: center; text-decoration: underline">' + pageInfo.title + '</div>' : '';
            if (pageInfo.text) {
                unsafeWindow.prompt.innerHTML += '<div>' + pageInfo.text + '</div>';
            }
            unsafeWindow.prompt.innerHTML += '<br />';

            const historySettingsHolder = document.createElement("div");
            historySettingsHolder.id = "historySettingsHolder";

            this._renderUi(historySettingsHolder, page);

            unsafeWindow.prompt.appendChild(historySettingsHolder);

            for(const footerButtonInfo of pageInfo.footerButtons || []) {

                const footerButton = document.createElement("button");
                footerButton.style.position = "absolute";
                footerButton.style.bottom = "12px";
                if (footerButtonInfo.action) {
                    footerButton.addEventListener("click", footerButtonInfo.action);
                }

                footerButton.textContent = footerButtonInfo.label;
                
                for(const styleKey in footerButtonInfo.style) {
                    footerButton.style[styleKey] = footerButtonInfo.style[styleKey];
                }
                unsafeWindow.prompt.appendChild(footerButton);
            }

            
            unsafeWindow.prompt.parentNode.style.display = "block";
            unsafeWindow.prompt.focus();
        },
        _renderDescription(holder, descriptionText) {
            const descriptionElement = document.getElementById('historySettingsDescription');
            // delete the element
            if (descriptionElement) {
                descriptionElement.parentNode.removeChild(descriptionElement);
            }

            if (!descriptionText) {
                return;
            }

            const description = document.createElement('div');
            description.id = 'historySettingsDescription';
            description.innerHTML = descriptionText;
            description.style.position = 'absolute';
            description.style.top = '140px';

            holder.appendChild(description);
        },
        _renderUi(holder, page = 'main') {
            const elements = this.ui[page].elements;
            holder.innerHTML = '';

            const self = this;
            
            for(const settingKey in elements) {
                const setting = elements[settingKey];
                const buttonHolder = document.createElement('div');

                switch (setting.type) {
                    case 'paragraph':
                        break;
                    case 'checkbox':
                        const checkbox = document.createElement('button');
                        checkbox.innerText = '[' + (this.values[settingKey] ? 'x' : ' ') + '] ' + setting.title;
                        checkbox.addEventListener('click', async () => {
                            await self.toggle(settingKey);
                            self._renderUi(holder, page);
                        });
                        if (setting.description) {
                            checkbox.addEventListener('mouseover', function () {
                                self._renderDescription(holder, setting.description);
                            });
                            checkbox.addEventListener('mouseout', function () {
                                self._renderDescription(holder, null);
                            });
                        }
                        buttonHolder.appendChild(checkbox);
                        holder.appendChild(buttonHolder);
                        break;
                    case 'switch':
                        const switcher = document.createElement('button');
                        const settingValue = this.values[settingKey];
                        const settingValueTitle = setting.options[settingValue];
                        switcher.innerText = setting.title + ': ' + settingValueTitle;
                        switcher.addEventListener('click', async () => {
                            const valueKeys = Object.keys(setting.options);
                            const valueIndex = valueKeys.indexOf(settingValue);
                            const nextValueIndex = valueIndex + 1 >= valueKeys.length ? 0 : valueIndex + 1;
                            const nextValue = valueKeys[nextValueIndex];
                            await self.set(settingKey, nextValue);
                            self._renderUi(holder, page);
                        });
                        if (setting.description) {
                            switcher.addEventListener('mouseover', function () {
                                self._renderDescription(holder, setting.description);
                            });
                            switcher.addEventListener('mouseout', function () {
                                self._renderDescription(holder, null);
                            });
                        }
                        buttonHolder.appendChild(switcher);
                        holder.appendChild(buttonHolder);
                        break;
                    case 'button':
                        const button = document.createElement('button');
                        button.innerText = setting.title;
                        
                        button.addEventListener('click', setting.action);
                        if (setting.description) {
                            button.addEventListener('mouseover', function () {
                                self._renderDescription(holder, setting.description);
                            });
                            button.addEventListener('mouseout', function () {
                                self._renderDescription(holder, null);
                            });
                        }
                        buttonHolder.appendChild(button);
                        holder.appendChild(buttonHolder);
                        break;
                }
            }
        }
    };

    /******************************************************
     * Utility functions
     ******************************************************/
    function GM_addStyle(css) {
        const style = document.getElementById("GM_addStyle_Runon") || (function() {
            const style = document.createElement('style');
            style.type = 'text/css';
            style.id = "GM_addStyle_Runon";
            document.head.appendChild(style);
            return style;
        })();
        const sheet = style.sheet;
 
        sheet.insertRule(css, (sheet.rules || sheet.cssRules || []).length);
    }
 
    function GM_addStyle_object(selector, rules) {
        const nested = [];

        let ruleCount = 0;
        let css = selector + "{";
        for (const key in rules) {
            if (key[0] == '$') {
                nested.push({selector: key.substr(1).trim(), rules: rules[key]})
                continue;
            }
            ruleCount++;
            css += key.replace(/([A-Z])/g, g => `-${g[0].toLowerCase()}`) + ":" + rules[key] + ";";
        }
        css += "}";

        if (ruleCount) {
            GM_addStyle(css);
        }

        for(const nestedRules of nested) {
            const nestedSelector = nestedRules.selector.replace(/\&/g, selector);

            GM_addStyle_object(nestedSelector, nestedRules.rules);
        }

    }

    function realQuantity(quantity, itemcategory) {
        if (itemcategory == 'armour' || itemcategory == 'weapon') {
            return 1;
        }

        return parseInt(quantity);
    }

    
    function maxStack(itemId) {
        itemId = itemId.split('_')[0];
        const itemcat = unsafeWindow.globalData[itemId].itemcat;
        if (itemcat == 'armour' || itemcat == 'weapon') {
            return 1;
        }

        // TODO: check if doesnt cause unwanted side effects
        if (itemcat == 'credits') {
            return 1;
        }

        return unsafeWindow.globalData[itemId].max_quantity;
    }

    /**
     * Simple object check.
     * @param item
     * @returns {boolean}
     */
    function isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }
    
    /**
     * Deep merge two objects.
     * @param target
     * @param ...sources
     */
    function mergeDeep(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
    
        if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target.hasOwnProperty(key)) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
        }
    
        return mergeDeep(target, ...sources);
    }


    // Hook into webCall, after request is done, but before callback is executed
    function onBeforeWebCall(call, callback) {
        if (!call) { // If call is not specified, hook into all calls
            WEBCALL_HOOKS.beforeAll.push(callback);
            return;
        }

        if (!WEBCALL_HOOKS.before.hasOwnProperty(call)) {
            WEBCALL_HOOKS.before[call] = [];
        }

        WEBCALL_HOOKS.before[call].push(callback);
    }

    // Remove hook from webCall
    function offBeforeWebCall(call, callback) {
        if (!call) { // If call is not specified, remove hook from all calls
            const index = WEBCALL_HOOKS.beforeAll.indexOf(callback);
            if (index > -1) {
                WEBCALL_HOOKS.beforeAll.splice(index, 1);
            }
            return;
        }

        if (!WEBCALL_HOOKS.before.hasOwnProperty(call)) {
            return;
        }

        const index = WEBCALL_HOOKS.before[call].indexOf(callback);
        if (index > -1) {
            WEBCALL_HOOKS.before[call].splice(index, 1);
        }
    }

    // Hook into webCall, after request is done and after callback is executed
    function onAfterWebCall(call, callback) {
        if (!call) { // If call is not specified, hook into all calls
            WEBCALL_HOOKS.afterAll.push(callback);
            return;
        }

        if (!WEBCALL_HOOKS.after.hasOwnProperty(call)) {
            WEBCALL_HOOKS.after[call] = [];
        }

        WEBCALL_HOOKS.after[call].push(callback);
    }

    // Remove hook from webCall
    function offAfterWebCall(call, callback) {
        if (!call) { // If call is not specified, remove hook from all calls
            const index = WEBCALL_HOOKS.afterAll.indexOf(callback);
            if (index > -1) {
                WEBCALL_HOOKS.afterAll.splice(index, 1);
            }
            return;
        }

        if (!WEBCALL_HOOKS.after.hasOwnProperty(call)) {
            return;
        }

        const index = WEBCALL_HOOKS.after[call].indexOf(callback);
        if (index > -1) {
            WEBCALL_HOOKS.after[call].splice(index, 1);
        }
    }

    function formatDate(date) {
        const offset = date.getTimezoneOffset()
        date = new Date(date.getTime() - (offset*60*1000))
        return date.toISOString().split('.')[0].replace('T', ' ');
    }

    function historyAction(e) {

        var question = false;
        var action;
        var extraData = {};
        switch(e.target.dataset.action) {
            case 'switchHistory':
                unsafeWindow.prompt.innerHTML = "<div style='text-align: center'>Loading, please wait...</div>";
                unsafeWindow.prompt.parentNode.style.display = "block";
                historyScreen = e.target.dataset.page;
                loadMarket();
                return;
                break;
        }
    }

    function debouncedItemSearch() {
        const searchFn = function (query) {
            query = query.toLowerCase().replace(/[\.\s]/g, '').trim();
            if (!query.length) {
                return [];
            }
            return SEARCHABLE_ITEMS
                .filter(itemId => {
                    const useItemId = itemId.split('_')[0];
                    const itemName = unsafeWindow.itemNamer(itemId, maxStack(useItemId))
                        .toLowerCase()
                        .replace(/[\.\s]/g, '');
                    return itemName.includes(query) || itemId.includes(query);
                })
                // .map(item => ({item, ...unsafeWindow.globalData[item.split('_')[0]]}))
                .map(item => {
                    const itemId = item.split('_')[0];
                    return {
                        item,
                        name: itemNamer(item, maxStack(itemId)),
                    }
                })
                .sort((a, b) => {
                    const aName = a.name?.toLowerCase();
                    const bName = b.name?.toLowerCase();
                    return aName.localeCompare(bName);
                });
        };
        
        let timeout;
        return function (query, callback) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                callback(searchFn(query));
            }, 400);
        };
    }

    // To be called to check if results box should be hidden
    function onDocumentClick(e) {
        const historyItemSearchResultBox = document.getElementById('historyItemSearchResultBox');
        if (!historyItemSearchResultBox || (e.target.closest('#historyItemSearchResultBox') || e.target.closest('#historySearchArea input'))) {
            return;
        }
        historyItemSearchResultBox.classList.add('hidden');
    }

    unsafeWindow.addEventListener('click', onDocumentClick);

    // @see https://stackoverflow.com/a/24922761
    function exportToCsv(filename, rows, seperator) {
        var processRow = function (row) {
            var finalVal = '';
            for (var j = 0; j < row.length; j++) {
                try {
                    var innerValue = row[j] === null ? '' : row[j].toString();
                } catch(exc) {
                    debugger;
                }
                if (row[j] instanceof Date) {
                    innerValue = row[j].toLocaleString();
                };
                var result = innerValue.replace(/"/g, '""');
                if (result.search(/("|,|\n|\s)/g) >= 0)
                    result = '"' + result + '"';
                if (j > 0)
                    finalVal += seperator;
                finalVal += result;
            }
            return finalVal + '\n';
        };
    
        var csvFile = '';
        for (var i = 0; i < rows.length; i++) {
            csvFile += processRow(rows[i]);
        }
    
        var blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, filename);
        } else {
            var link = document.createElement("a");
            if (link.download !== undefined) { // feature detection
                // Browsers that support HTML5 download attribute
                var url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    }

    /******************************************************
     * Styles
     ******************************************************/
    // GM_addStyle_object('#marketplace', {});

    GM_addStyle_object('#marketplace #historySettings', {
        position: 'absolute',
        top: '5px',
        right: '5px',
        width: '20px',
        height: '20px',
        backgroundImage: 'url(../images/df_gear.png)',
        backgroundSize: 'cover',
        cursor: 'pointer',
    });

    GM_addStyle_object('#marketplace #historyItemDisplay', {
        top: '104px',
        bottom: '110px',
    });

    GM_addStyle_object('#marketplace #historySearchArea', {
        position: 'absolute',
        top: '100px',
        left: '20px',
        // right: '80px',
        height: '35px',
        width: '205px',
        padding: '8px',
        border: '1px #990000 solid',
        textAlign: 'left',
        backgroundColor: 'rgba(0,0,0,0.8)',
        
        '$ & #historyItemSearchResultBox': {
            position: 'absolute',
            // top: '184px',
            width: '250px',
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '4px',
            border: '1px #990000 solid',
            textAlign: 'left',
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: '100',

            '$ &.hidden': {
                display: 'none',
            },
        },
    });
    GM_addStyle_object('#marketplace #historyFilterArea', {
        position: 'absolute',
        top: '100px',
        left: '250px',
        right: '20px',
        height: '35px',
        padding: '8px',
        border: '1px #990000 solid',
        textAlign: 'left',
        backgroundColor: 'rgba(0,0,0,0.8)',
    });

    GM_addStyle_object('#marketplace #historyInfoBox', {
        position: 'absolute',
        top: '160px',
        left: '20px',
        right: '20px',
        bottom: '110px',
        padding: '8px',
        border: '1px #990000 solid',
        textAlign: 'left',
        backgroundColor: 'rgba(0,0,0,0.8)',

        '$ & .historyDetailsContainer': {
            fontSize: '14px',
            width: '100%',
            height: '100%',
            '$ & .historyDetailsText': {
                margin: '0',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translateY(-50%) translateX(-50%)',
            }
        },

    });

    GM_addStyle_object('#marketplace #historyItemDisplay .fakeItem', {
        paddingLeft: '6px',
        fontSize: '9pt',
        height: '16px',
        cursor: 'pointer',
        userSelect: 'none',

        '$ &.pending': {
            opacity: '0.5',
        },
        '$ &:hover': {
            backgroundColor: 'rgba(125, 0, 0, 0.8)',
        },
        '$ & > div': {
            display: 'inline-block',
            position: 'relative',
        },
        '$ & .tradeType': {
            position: 'absolute',
            left: '214px',
            color: '#00FF00',
        },
        '$ & .salePrice': {
            position: 'absolute',
            left: '326px',
            color: '#FFCC00',
        },
        '$ & .saleDate': {
            position: 'absolute',
            left: '486px',
        },
    });

    GM_addStyle_object('#marketplace #selectHistoryCategory', {
        position: 'absolute',
        width: '100%',
        top: '70px',
        fontSize: '12pt',

        '$ & button': {
            width: '120px',
        },
    });

    
    /******************************************************
     * DF Function Overrides
     ******************************************************/

    // Source: market.js
    // Explanation:
    // Allows this script to add a 'history' tab seemlessly into the marketplace
    // This approach should make it still compatible with other userscripts and official site scripts.
    const origLoadMarket = unsafeWindow.loadMarket;
    unsafeWindow.loadMarket = function() {
        // Execute original function
        origLoadMarket.apply(unsafeWindow, arguments);
        const pageNavigation = document.getElementById('selectMarket');
        if (!pageNavigation) {
            return;
        }
        
        // Async context, i dont like nested callbacks, i like async/await
        (async function () {
            // Add history button
            const historyBtn = document.createElement('button');
            historyBtn.setAttribute('data-action', 'switchMarket');
            historyBtn.setAttribute('data-page', 'history');
            historyBtn.setAttribute('id', 'loadHistory');
            historyBtn.innerText = 'history';
            historyBtn.addEventListener("click", marketAction);
            pageNavigation.appendChild(historyBtn);

    
            switch (unsafeWindow.marketScreen) {
                case 'history':
                    historyBtn.disabled = true;
                    pageLogo.textContent = "Market History";

                    const historyNavigation = document.createElement('div');
                    historyNavigation.id = 'selectHistoryCategory';
                    pageNavigation.after(historyNavigation);

                    const listBtn = document.createElement('button');
                    listBtn.setAttribute('data-action', 'switchHistory');
                    listBtn.setAttribute('data-page', 'list');
                    listBtn.setAttribute('id', 'historyList');
                    listBtn.innerText = 'list';
                    listBtn.addEventListener("click", historyAction);
                    
                    const statsBtn = document.createElement('button');
                    statsBtn.setAttribute('data-action', 'switchHistory');
                    statsBtn.setAttribute('data-page', 'stats');
                    statsBtn.setAttribute('id', 'historyStats');
                    statsBtn.innerText = 'statistics';
                    statsBtn.addEventListener("click", historyAction);


                    historyNavigation.appendChild(listBtn);
                    historyNavigation.appendChild(statsBtn);

                    // Add history navbar below
    
                    switch (unsafeWindow.historyScreen) {
                        case 'list':
                            listBtn.disabled = true;
                            
                            const boxLabels = document.createElement("div");
                            boxLabels.id = "historyLabels";
                            boxLabels.innerHTML = `
                                <span>Item Name</span>
                                <span style='position: absolute; left: 208px; width: 80px; width: max-content;'>Type</span>
                                <span style='position: absolute; left: 320px; width: max-content;'>Price</span>
                                <span style='position: absolute; left: 480px; width: 70px; width: max-content;'>Datetime</span>
                            `;
                            boxLabels.classList.add("opElem");
                            boxLabels.style.top = "90px";
                            boxLabels.style.left = "26px";
            
                            const historyItemDisplay = document.createElement("div");
                            historyItemDisplay.id = "historyItemDisplay";
                            historyItemDisplay.classList.add("marketDataHolder");
                            historyItemDisplay.setAttribute('data-offset', 0);
                            historyItemDisplay.setAttribute('data-per-page', 10);
                            const renderHistoryItems = function () {
                                const offset = parseInt(historyItemDisplay.getAttribute('data-offset'));
                                const perPage = parseInt(historyItemDisplay.getAttribute('data-per-page'));
        
                                const entryCount = HISTORY.entries.length;
        
                                if (offset >= entryCount) {
                                    return false;
                                }
                                
                                for(let i = 0; i < perPage; i++) {
                                    const entryIndex = entryCount - offset - i - 1;
                                    const entry = HISTORY.entries[entryIndex] || null;
                                    // const entryIndex = i + offset;
                                    // const entry = HISTORY.entries[entryIndex] || null;
                                    if (!entry) {
                                        continue;
                                    }
                                    const isPending = HISTORY.cache.pending_trade_ids.includes(entry.trade_id);
                                    
                                    // if (isPending) {
                                    //     continue;
                                    // }
        
                                    // <div class="fakeItem" data-type="avalanchemg14_stats777" data-quantity="1" data-price="53000000"><div class="itemName cashhack credits" data-cash="Avalanche MG14">Avalanche MG14</div> <span style="color: #c0c0c0;">(AC)</span><div class="tradeZone">Outpost</div><div class="seller">ScarHK</div><div class="salePrice" style="color: red;">$53,000,000</div><button disabled="" data-action="buyItem" data-item-location="1" data-buynum="350533865">buy</button></div>
                                    const row = document.createElement("div");
                                    row.classList.add("fakeItem");
                                    if (isPending) {
                                        row.classList.add("pending");
                                    }
                                    row.setAttribute("data-type", entry.item);
                                    row.setAttribute("data-quantity", entry.quantity);
                                    row.setAttribute("data-price", entry.price);
                                    row.setAttribute("data-trade-id", entry.trade_id);
        
                                    let afterName = calcMCTag(entry.item, false, "span", "") || '';
        
                                    const itemId = entry.item.split('_')[0];
                                    const itemCat = getItemType(unsafeWindow.globalData[itemId]);
                                    if (itemCat == 'ammo') {
                                        afterName += ' <span>(' + entry.quantity + ')</span>';
                                    }
                                    
                                    row.innerHTML = `
                                        <div class="itemName cashhack credits" data-cash="${entry.itemname}">${entry.itemname}</div>
                                        ${afterName}
                                        <div class="tradeType">${entry.action}</div>
                                        <div class="salePrice">$${entry.price}</div>
                                        <div class="saleDate">${formatDate(new Date(entry.date))}</div>
                                    `;
                                    // row.innerHTML = "<div class='itemName cashhack credits' data-cash='" + entry.itemname + "'>" + entry.itemname + "</div><div class='tradeZone'>" + entry.trade_zone + "</div><div class='seller'>" + entry.member_name + "</div><div class='salePrice' style='color: red;'>$" + entry.price + "</div>";
                                    historyItemDisplay.appendChild(row);
                                }
        
                                return true;
                            };
                            
                            const onHistoryScroll = function () {
                                const fullScrollHeight = historyItemDisplay.scrollHeight;
                                const scrolledHeight = historyItemDisplay.scrollTop + historyItemDisplay.clientHeight;
                                const diff = fullScrollHeight - scrolledHeight;
        
                                if (diff > 50) {
                                    return;
                                }
        
                                const perPage = parseInt(historyItemDisplay.getAttribute('data-per-page'));
                                historyItemDisplay.removeEventListener('scroll', onHistoryScroll);
                                historyItemDisplay.setAttribute('data-offset', parseInt(historyItemDisplay.getAttribute('data-offset')) + perPage);
                                const hasMore = renderHistoryItems();
                                if (hasMore) {
                                    historyItemDisplay.addEventListener('scroll', onHistoryScroll);
                                }
                            };
        
                            marketHolder.appendChild(historyItemDisplay);
                            marketHolder.appendChild(boxLabels);
            
                            await HISTORY.load();
                            // retrieve current user's pending trades
                            await new Promise(resolve => {
                                var dataArray = {};
        
                                dataArray["pagetime"] = userVars["pagetime"];
                                dataArray["tradezone"] = "";
                                dataArray["searchname"] = "";
                                dataArray["searchtype"] = "sellinglist";
                                dataArray["search"] = "trades";
                                dataArray["memID"] = userVars["userID"];
                                dataArray["category"] = "";
                                dataArray["profession"] = "";
                                
                                // Execute webCall
                                webCall("trade_search", dataArray, resolve, true);
                                // Cache will be updated by webCall hook somewhere else in the code
                            });
                            
                            renderHistoryItems();
                            historyItemDisplay.addEventListener('scroll', onHistoryScroll);
                            break;
                        case 'stats':
                            statsBtn.disabled = true;
                            const searchBox = document.createElement("div");
                            searchBox.id = "historySearchArea";
                            searchBox.innerHTML = `
                                <div style='text-align: left; width: 185px; display: inline-block;'>
                                    Add item:<br /><input id='historySearchField' type='text' name='historySearch' />
                                </div>
                            `;
                            const filterBox = document.createElement("div");
                            filterBox.id = "historyFilterArea";
                            // Filter box shows items that are added to search on
                            // But also a date range select
                            // filterBox.innerHTML =

                            const searchInput = searchBox.querySelector('#historySearchField');
                            // categorySelect += "<div style='display: inline-block; width: 260px;'>In Category:<br/><div id='categoryChoice' data-catname=''><span id='cat'>Everything</span><span id='dog' style='float: right;'>&#9668;</span></div>";
                            // <div class="historyDetailsText">Click on a trade to see more info</div>
                            const historyInfoBox = document.createElement("div");
                            historyInfoBox.id = "historyInfoBox";
                            historyInfoBox.innerHTML = `
                                <div style='text-align: left; width: 100%; display: inline-block;'>
                                    <div class="historyDetailsContainer">
                                        <div class="historyTradeImage"></div>
                                    </div>
                                </div>
                            `;

                            const searchResultBox = document.createElement("div");
                            searchResultBox.id = "historyItemSearchResultBox";
                            searchResultBox.classList.add("hidden");
                            
                            searchBox.appendChild(searchResultBox);

                            marketHolder.appendChild(searchBox);
                            marketHolder.appendChild(filterBox);
                            marketHolder.appendChild(historyInfoBox);

                            const searchFn = debouncedItemSearch();

                            searchInput.addEventListener('input', function () {
                                searchFn(this.value, function (results) {
                                    searchResultBox.innerHTML = '';
                                    for(const result of results) {
                                        // const resultRow = document.createElement('div');

                                        const resultButton = document.createElement('button');
                                        resultButton.innerText = result.name;
                                        resultButton.style.width = '100%';
                                        resultButton.style.textAlign = 'left';
                                        resultButton.classList.add("fakeItem");
                                        resultButton.setAttribute("data-type", result.item);
                                        resultButton.setAttribute("data-quantity", maxStack(result.item));
            
                                        resultButton.addEventListener('click', function () {
                                            // searchInput.value = result.name;
                                            // searchResultBox.innerHTML = '';
                                        });
                                        // resultRow.appendChild(resultButton);
                                        // searchResultBox.appendChild(resultRow);
                                        searchResultBox.appendChild(resultButton);
                                    }

                                    if (!results.length) {
                                        searchResultBox.classList.add('hidden');
                                    } else {
                                        searchResultBox.classList.remove('hidden');
                                    }
                                });
                            });
                            searchInput.addEventListener('blur', function (e) {
                                // Check if not focused on result box
                                if (e.relatedTarget && e.relatedTarget.parentNode.id == 'historyItemSearchResultBox') {
                                    return;
                                }

                                searchResultBox.classList.add('hidden');
                            });
                            searchInput.addEventListener('focus', function () {
                                // If result box has results, show it
                                if (searchResultBox.children.length) {
                                    searchResultBox.classList.remove('hidden');
                                }
                            });
                            break;
                    }
                    
                    promptEnd();
                    break;
            }
        })();
    };

    // Source: base.js
    // Explanation:
    // Allows this script to hook into before and after the callback of webCall.
    // Which prevents us having to do extra requests while still getting the data we need
    // The less requests, the better.
    // Plus DeadFrontier's webCalls are executed at exactly the right moments we need (like after selling)
    // This approach should make it still compatible with other userscripts and official site scripts.
    const originalWebCall = unsafeWindow.webCall;
    unsafeWindow.webCall = function (call, params, callback, hashed) {
        // Override the callback function to execute any hooks
        // This still executes the original callback function, but with our hooks
        const callbackWithHooks = function(data, status, xhr) {
            const dataObj = Object.fromEntries(new URLSearchParams(data).entries());
            const response = Object.fromEntries(new URLSearchParams(xhr.responseText).entries());

            // Call all 'before' hooks
            if (WEBCALL_HOOKS.before.hasOwnProperty(call)) {
                // Copy the array, incase that hooks remove themselves during their execution
                const beforeHooks = WEBCALL_HOOKS.before[call].slice();

                for (const beforeHook of beforeHooks) {
                    beforeHook(
                        {
                            call,
                            params,
                            callback,
                            hashed,
                        },
                        {
                            dataObj,
                            response,
                            data,
                            status,
                            xhr,
                        }
                    );
                }
            }

            // Call all 'beforeAll' hooks
            const beforeAllHooks = WEBCALL_HOOKS.beforeAll.slice();
            for (const beforeAllHook of beforeAllHooks) {
                beforeAllHook(
                    {
                        call,
                        params,
                        callback,
                        hashed,
                    },
                    {
                        dataObj,
                        response,
                        data,
                        status,
                        xhr,
                    }
                );
            }
            
            // Execute the original callback
            const result = callback.call(unsafeWindow, data, status, xhr);

            // Call all 'after' hooks
            if (WEBCALL_HOOKS.after.hasOwnProperty(call)) {

                // Copy the array, incase that hooks remove themselves during their execution
                const afterHooks = WEBCALL_HOOKS.after[call].slice();

                for (const afterHook of afterHooks) {
                    afterHook(
                        {
                            call,
                            params,
                            callback,
                            hashed,
                        },
                        {
                            dataObj,
                            response,
                            data,
                            status,
                            xhr,
                        },
                        result
                    );
                }
            }

            // Call all 'afterAll' hooks
            const afterAllHooks = WEBCALL_HOOKS.afterAll.slice();
            for (const afterAllHook of afterAllHooks) {
                afterAllHook(
                    {
                        call,
                        params,
                        callback,
                        hashed,
                    },
                    {
                        dataObj,
                        response,
                        data,
                        status,
                        xhr,
                    },
                    result
                );
            }

            // Return the original callback result
            // As far as I see in the source code, the callbacks never return anything, but its cleaner to return it anyway
            return result;
        };

        // Call the original webCall function, but with our hooked callback function
        return originalWebCall.call(unsafeWindow, call, params, callbackWithHooks, hashed);
    };

    var origInfoCard = unsafeWindow.infoCard || null;
    if (origInfoCard) {
        inventoryHolder.removeEventListener("mousemove", origInfoCard, false);
 
        unsafeWindow.infoCard = function (e) {
            // infoBox.style.color = '';
            
            //Remove previous ironman warning
            var elems = document.getElementsByClassName("historyInfoContainer");
            for(var i = elems.length - 1; i >= 0; i--) {
                elems[i].parentNode.removeChild(elems[i]);
            }
 
            origInfoCard(e);
            if(active || pageLock || !allowedInfoCard(e.target)) {
                return;
            }
 
            var target;
            if(e.target.parentNode.classList.contains("fakeItem"))
            {
                target = e.target.parentNode;
            } else
            {
                target = e.target;
            }
            if (!target.dataset.type || !target.dataset.tradeId) {
                return;
            }
            const tradeId = target.dataset.tradeId;
            const isPending = HISTORY.cache.pending_trade_ids.includes(tradeId);
            if (!isPending) {
                return;
            }

            const itemId = target.dataset.type.split('_')[0];
            // const itemData = globalData[itemId] || null;
            
            const container = document.createElement("div");
            // container.className = "itemData historyInfoContainer";
            container.classList.add("itemData");
            container.classList.add("historyInfoContainer");
            container.style.color = '#FFCC00';
            container.style.marginTop = 'auto';
            container.innerHTML = "This sale is still pending";
            infoBox.appendChild(container);
        }.bind(unsafeWindow);
 
        inventoryHolder.addEventListener("mousemove", unsafeWindow.infoCard, false);
    }


    /******************************************************
     * Webcall hooks
     ******************************************************/

    // Hook into when an item is sold
    onBeforeWebCall('inventory_new', function (request, response) {
        if (request.params.action !== 'newsell') {
            return;
        }
        if (response.xhr.status != 200) {
            return;
        }
        if (!response.dataObj.hasOwnProperty('OK')) {
            return;
        }

        // When the sell is successful, DeadFrontier will do a new webCall to retrieve the new sell listing
        // We hook ONCE into this webCall, to retrieve the trade id
        const onSellSuccess = function (request, response) {
            if (response.xhr.status == 200) {
                HISTORY.onSellItem(request, response);
            }

            // Remove self from hook
            offAfterWebCall('trade_search', onSellSuccess);
        };

        // Hook into the new sell listing webCall
        onAfterWebCall('trade_search', onSellSuccess);
    });

    // Hook into when an item is bought
    onAfterWebCall('inventory_new', function (request, response) {
        if (request.params.action !== 'newbuy') {
            return;
        }
        if (response.xhr.status != 200) {
            return;
        }
        if (!response.dataObj.hasOwnProperty('OK')) {
            return;
        }

        const dataObj = {};

        for(const key in response.dataObj) {
            if (key.indexOf('df_inv') !== 0) {
                continue;
            }

            dataObj[key.replace(/^df_inv\d+_/, '')] = response.dataObj[key];
        }
        
        // const itemId = dataObj.type.split('_')[0];

        const entry = {
            trade_id: request.params.buynum,
            action: 'buy',
            price: request.params.expected_itemprice,
            item: dataObj.type,
            itemname: unsafeWindow.itemNamer(dataObj.type, dataObj.quantity),
            quantity: dataObj.quantity, 
        };

        HISTORY.pushTrade(entry);
    });

    // Hook into when an item is scrapped
    onBeforeWebCall('inventory_new', function (request, response) {
        if (request.params.action !== 'scrap') {
            return;
        }
        if (response.xhr.status != 200) {
            return;
        }
        if (!response.dataObj.hasOwnProperty('OK')) {
            return;
        }
        const itemnum = request.params.itemnum;
        const quantity = unsafeWindow.userVars['DFSTATS_df_inv' + itemnum + '_quantity'];
        const itemTypeId = unsafeWindow.userVars['DFSTATS_df_inv' + itemnum + '_type'];
        const itemId = itemTypeId.split('_')[0];

        const entry = {
            trade_id: hash(objectJoin(request.params)),
            action: 'scrap',
            price: request.params.price,
            item: request.params.expected_itemtype,
            itemname: unsafeWindow.itemNamer(itemTypeId, quantity),
            quantity,
        };

        HISTORY.pushTrade(entry);
    });

    // Hook into when a sale is canceled
    onAfterWebCall('inventory_new', function (request, response) {
        if (request.params.action !== 'newcancelsale') {
            return;
        }
        if (response.xhr.status != 200) {
            return;
        }
        const tradeId = request.params.buynum;
        HISTORY.removeTrade(tradeId);
    });

    // Update 'pending sales' trade cache
    onAfterWebCall('trade_search', function (request, response) {
        if (response.xhr.status != 200) {
            return;
        }
        const tradeCount = response.dataObj.tradelist_totalsales;
        if (tradeCount == 0) {
            return;
        }

        const pendingTradeIds = [];
        for(let i = 0; i < tradeCount; i++) {
            const tradeId = response.dataObj['tradelist_' + i + '_trade_id'];
            pendingTradeIds.push(tradeId);
        }

        HISTORY.cache.pending_trade_ids = pendingTradeIds;
    });
    
    
    /******************************************************
     * Await Page Initialization
     ******************************************************/

    // A promise that resolves when document is fully loaded and globalData is filled with stackables
    // This is because DeadFrontier does a request to stackables.json, which is needed for the max stack of items
    // Only after this request is done, globalData will contain ammo with a max_quantity
    await new Promise(resolve => {
        // This is the original function that is called when the stackables.json request is done
        const origUpdateIntoArr = unsafeWindow.updateIntoArr;
        unsafeWindow.updateIntoArr = function (flshArr, baseArr) {
            // Execute original function
            origUpdateIntoArr.apply(unsafeWindow, [flshArr, baseArr]);

            // Check if globalData is filled with stackables
            if (unsafeWindow.globalData != baseArr) {
                return;
            }

            // revert override, we dont need it anymore
            unsafeWindow.updateIntoArr = origUpdateIntoArr;
            resolve();
        }
    });

    /******************************************************
     * Script Initialization
     ******************************************************/

    SEARCHABLE_ITEMS = Object.keys(unsafeWindow.globalData)
        .filter(itemId => !['brokenitem', 'undefined'].includes(itemId) && unsafeWindow.globalData[itemId].no_transfer != '1');

    SEARCHABLE_ITEMS.forEach(itemId => {
            const item = unsafeWindow.globalData[itemId];
            if (!item.needcook || item.needcook != '1') {
                return;
            }

            SEARCHABLE_ITEMS.push(itemId + '_cooked');
        });
    
    // Load History
    await HISTORY.load();
    HISTORY.resetCache();

    // Load settings
    await SETTINGS.load();

    // DEBUG
    unsafeWindow.HISTORY = HISTORY;

    //Populate LOOKUP
    for (const itemId in unsafeWindow.globalData) {
        const item = unsafeWindow.globalData[itemId];
        const categoryId = item.itemcat;

        if (!LOOKUP.category__item_id.hasOwnProperty(categoryId)) {
            LOOKUP.category__item_id[categoryId] = [];
        }

        LOOKUP.category__item_id[categoryId].push(itemId);
    }

    for (const categoryId in LOOKUP.category__item_id) {
        LOOKUP.category__item_id[categoryId].sort((a, b) => {
            const itemA = unsafeWindow.globalData[a];
            const itemB = unsafeWindow.globalData[b];

            const nameA = itemA.name?.toLowerCase() || '';
            const nameB = itemB.name?.toLowerCase() || '';

            return nameA.localeCompare(nameB);
        });
    }

    delete LOOKUP.category__item_id['broken'];

    // DEBUG
    unsafeWindow.LOOKUP = LOOKUP;
    unsafeWindow.SETTINGS = SETTINGS;

    var historySettingsButton = document.createElement("button");
    historySettingsButton.classList.add("opElem");
    historySettingsButton.style.left = page == 35 ? "200px" : "400px";
    historySettingsButton.style.bottom = "86px";
    historySettingsButton.textContent = "History Menu";
    inventoryHolder.appendChild(historySettingsButton);

    
    historySettingsButton.addEventListener("click", function () {
        const fn = SETTINGS.renderSettingsPrompt.bind(SETTINGS);

        fn();
    });


    // onAfterWebCall(null, function (request, response, result) {
        
    //     console.log('after ' + webCall.call, webCall);
    // });
})();