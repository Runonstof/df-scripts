async function genTrades(amount) {
    const itemIds = Object.keys(globalData)
    .filter(key => {
        if (key == 'undefined' || key == 'broken') return false;

        var data = globalData[key];

        if (data['no_transfer'] == '1' || data['noloot'] == '1') return false;

        return true;
    });
    // const itemIds = {
    //     '9rifleammo': {
    //         minPrice: 16000,
    //         maxPrice: 22000,
    //     },
    //     '10gaugeammo': {
    //         minPrice: 4000,
    //         maxPrice: 6000,
    //     },
    //     '32ammo': {
    //         minPrice: 900,
    //         maxPrice: 1300,
    //     },
    //     '16gaugeammo': {
    //         minPrice: 10000,
    //         maxPrice: 15000,
    //     },
    //     'driedtruffles': {
    //         minPrice: 10000,
    //         maxPrice: 15000,
    //     },
    //     'driedtruffles_cooked': {
    //         minPrice: 20000,
    //         maxPrice: 25000,
    //     },
    // };

    const tradeTypes = ['buy','buy','buy','buy', 'sell','sell','sell','sell', 'scrap'];
    const entries = [];

    for(let i = 0; i < amount; i++) {
        let itemId = itemIds[Math.floor(Math.random() * itemIds.length)];
        let globalItemId = itemId.split('_')[0];
        
        let globalItem = globalData[globalItemId];
        let max_quantity = globalItem.max_quantity || 1;
        let min_quantity = Math.ceil(max_quantity / 2);
        let quantity = Math.floor(Math.random() * (max_quantity - min_quantity + 1)) + min_quantity;
        let tradeType = tradeTypes[Math.floor(Math.random() * tradeTypes.length)];
        let price = 0;

        if (tradeType == 'scrap') {
            price = scrapValue(itemId, quantity);
        } else {
            const maxPrice = scrapValue(itemId, quantity) * 2.5;
            const minPrice = scrapValue(itemId, quantity) * 1.5;
            price = Math.floor(Math.random() * (maxPrice - minPrice + 1)) + minPrice;
        }

        // gen random timestamp, between now and 1 year ago
        let randTimestamp = Date.now() - Math.floor(Math.random() * 31536000000 * 2);

        // Gen random trade id
        let tradeId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        let trade = {
            trade_id: tradeId,
            item: itemId,
            itemname: itemNamer(itemId, quantity),
            price: price,
            quantity: quantity,
            date: randTimestamp,
            action: tradeType,
        };

        // await HISTORY.pushTrade(trade);
        entries.push(trade);

        console.log('Making: ' + i + '/' + amount);
    }

    entries.sort((a, b) => (a.date > b.date) ? 1 : -1);

    for(let i = 0; i < entries.length; i++) {
        await HISTORY.pushTrade(entries[i]);
        console.log('Pushing: ' + i + '/' + amount);
    }
}