var self = module.exports = {
    processCoinStatus: function(message) {
        let responseMessage = "";
        let originalMessage = message.text;
        console.log(originalMessage);
        console.log(message.text.substr(6, message.text.length));
        let theMessage = message.text.substr(6, message.text.length);
        theMessage = theMessage.toUpperCase();
        console.log(theMessage);

        let splitMessage = [];
        let sp = theMessage.split('/');
        for (let i = 0; i < sp.length; i++) {
            let sub = sp[i].split(' ');
            for (let j = 0; j < sub.length; j++) {
                splitMessage.push(sub[j]);
            }
        }

        try {
            let foundExchange = [];
            let foundExchangeAlias = [];
            Object.keys(EXCHANGES).forEach((singleExchange) => {
                let exchange = EXCHANGES[singleExchange];
                let foundMatch = splitMessage.diff(exchange.triggers);
                if (foundMatch[0]) {
                    foundExchange.push(singleExchange);
                    foundExchangeAlias.push(foundMatch[0]);
                }
            });
            if (foundExchange.length < 1 && !foundExchange) {
                return;
            }

            let skip = false;
            let foundCoin;
            let sql;
            if (foundExchange[0] === "bittrex") {
                sql = "SELECT * FROM statuses WHERE exchange = 1";
            } else if (foundExchange[0] === "binance") {
                sql = "SELECT * FROM statuses WHERE exchange = 2";
            } else {
                return;
            }

            db.all(sql, function (err, rows) {
                rows.forEach(function (row) {
                    let coinStatus = {};
                    coinStatus.exchange = row.exchange;
                    coinStatus.currency = row.currency;
                    coinStatus.marketName = row.market_name;
                    coinStatus.lastSynced = row.last_synced;
                    coinStatus.blockHeight = row.block_height;
                    coinStatus.walletConnections = row.wallet_connections;
                    coinStatus.bhUpdateHtml = row.bh_update_html;
                    coinStatus.lastChecked = row.last_checked;
                    coinStatus.statusState = row.status_state;
                    coinStatus.notice = row.notice;
                    if (row.market_name) {
                        console.log("Addming market");
                        marketStatuses[row.market_name] = coinStatus;
                    } else {
                        console.log("Addming coin");
                        coinsStatuses[row.currency] = coinStatus;
                    }
                });

                // Market check
                let markets = Object.keys(marketStatuses);
                let foundMarkets;
                let coinWithinLimit = false;
                console.log(splitMessage[1]);
                for (let i = 0; i < markets.length; i++) {
                    if (markets[i].indexOf(splitMessage[1]) !== -1) {
                        console.log("Found market");
                        skip = true;
                        foundMarkets = marketStatuses[markets[i]];
                        foundCoin = marketStatuses[markets[i]];
                        console.log(foundMarkets);
                        coinWithinLimit = true;
                    }
                }
                let foundCoins;
                if (!skip) {
                    console.log("Not skipping");
                    foundCoins = splitMessage.diff(Object.keys(coinsStatuses));
                    if (foundCoins.length < 0 && !foundCoins) {
                        return;
                    }

                    foundCoin = coinsStatuses[foundCoins[0]];
                    for (let i = 0; i < foundCoins.length; i++) {
                        let coin = foundCoins[i];
                        if (splitMessage[0] && splitMessage[0].indexOf(coin) !== -1) {
                            coinWithinLimit = true;
                        }
                        if (splitMessage[1] && splitMessage[1].indexOf(coin) !== -1) {
                            coinWithinLimit = true;
                        }
                        if (splitMessage[2] && splitMessage[2].indexOf(coin) !== -1) {
                            coinWithinLimit = true;
                        }
                    }
                }
                let exchangeWithinLimit = false;
                for (let i = 0; i < foundExchangeAlias.length; i++) {
                    let exchange = foundExchangeAlias[i];
                    if (splitMessage[0] && splitMessage[0].indexOf(exchange.toUpperCase()) !== -1) {
                        exchangeWithinLimit = true;
                    }
                    if (splitMessage[1] && splitMessage[1].indexOf(exchange.toUpperCase()) !== -1) {
                        exchangeWithinLimit = true;
                    }
                    if (splitMessage[2] && splitMessage[2].indexOf(exchange.toUpperCase()) !== -1) {
                        exchangeWithinLimit = true;
                    }
                }

                if (!exchangeWithinLimit || !coinWithinLimit) {
                    return;
                }

                if (skip) {
                    responseMessage = "*" + foundCoin.marketName + "*";
                } else {
                    responseMessage = "*" + foundCoin.currency + "*";
                }
                responseMessage += "\n\n";
                if (foundCoin.notice) {
                    responseMessage += "_Important notes_\n";
                    responseMessage += "*" + foundCoin.notice + "*\n\n";
                }
                responseMessage += "_Nerd data_\n";
                responseMessage += "```";
                    if(foundCoin.currency) {
                        responseMessage += "currency: " + foundCoin.currency + "\n";
                    }
                    if(foundCoin.marketName) {
                        responseMessage += "market_name: " + foundCoin.marketName + "\n";
                    }
                    responseMessage += "status: " + foundCoin.statusState + "\n" +
                    "block_height: " + foundCoin.blockHeight + "\n" +
                    "wallet_connections: " + foundCoin.walletConnections + "\n" +
                    "bh_update_html: " + foundCoin.bhUpdateHtml + "\n" +
                    "```\n\n";
                    responseMessage += "_Meta data_\n" +
                    "Status page: " + EXCHANGES[foundExchange[0]].status_page + "\n" +
                    "Last scrape: " + foundCoin.lastSynced + " UTC";
                self.sendMessage(message, responseMessage);
            });
        } catch (e) {
            console.log('wtf is this shit?');
            console.log(e);
        }
    },

    sendMessage: function(message, responseMessage) {
        let messageObject = {
            channel: message.channel,
            type: RTM_EVENTS.MESSAGE,
        };
        console.log("is not Shenanigans");
        let thread = message.ts;
        if (message.thread_ts) {
            thread = message.thread_ts;
        }
        messageObject = Object.assign({}, messageObject, {
            thread_ts: thread,
        });

        messageObject = Object.assign({}, messageObject, {
            text: responseMessage,
        });
        console.log(messageObject);

        rtm.send(messageObject);
    }
}
