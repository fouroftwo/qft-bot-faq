const CONTINUOUS_REPORT = 0;
const FULL_REPORT = 1;
const CONFIGURATION = require('./configuration-local.json');
const botChannel = CONFIGURATION['bot-channel'] || 'G854US8MR';
var self = module.exports = {
    processCoinStatus: function(message) {
        let exchange = 0;
        let responseMessage = "";
        let originalMessage = message.text;
        //console.log(originalMessage);
        //console.log(message.text.substr(6, message.text.length));
        let theMessage = message.text.substr(6, message.text.length);
        theMessage = theMessage.toUpperCase();
        //console.log(theMessage);

        let splitMessage = [];
        let sp = theMessage.split('/');
        for (let i = 0; i < sp.length; i++) {
            let sub = sp[i].split(' ');
            for (let j = 0; j < sub.length; j++) {
                splitMessage.push(sub[j]);
            }
        }

        try {
            if(splitMessage.indexOf('gimmestats'.toUpperCase()) !== -1) {
                self.sendCoinScraperReport(botChannel, FULL_REPORT);
                return;
            }
        } catch(error) {
            console.log(error);
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
                exchange = 1;
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

                switch(exchange) {
                    case 1:
                        responseMessage = ":bittrex: | ";
                        break;
                    case 2:
                        responseMessage = ":binance: | ";
                        break;
                    case 3:
                        responseMessage = ":hitbit: | ";
                        break;
                }

                if (skip) {
                    responseMessage += "*" + foundCoin.marketName + "*";
                } else {
                    responseMessage += "*" + foundCoin.currency + "*";
                }
                responseMessage += "\n\n";
                if (foundCoin.notice) {
                    if(foundCoin.notice.toLowerCase().indexOf("delisted") !== -1 || foundCoin.notice.toLowerCase().indexOf("remove") !== -1) {
                        responseMessage += "*Notice: " + foundCoin.notice + "*\n";
                    } else {
                        responseMessage += "Notice: " + foundCoin.notice + "\n";
                    }
                } else {
                    responseMessage += "No special notice recorded\n";
                }
                responseMessage += "_Status page:_ " + EXCHANGES[foundExchange[0]].status_page + "\n" +
                "_Last scrape: " + foundCoin.lastSynced + " UTC_";
                self.sendMessage(message, responseMessage);
            });
        } catch (e) {
            console.log('wtf is this shit?');
            console.log(e);
        }
    },

    sendCoinScraperReport: function(botChannel, type) {
        let delisterSql = "SELECT * FROM statuses WHERE reported_in_slack IS NOT 1 AND notice <> '' AND notice <> '—' ORDER BY exchange";
        let delisterMessage = "*LATEST COIN REPORT*\n";
        if(type === 1) {
            delisterSql = "SELECT * FROM statuses WHERE notice <> '' AND notice <> '—' ORDER BY exchange";
            delisterMessage = "*COMPLETE COIN SCRAPER REPORT*\n";
        }
        let coinStatuses = {};
        try {
            db.all(delisterSql, function (err, rows) {
                //console.log(rows);
                if(rows.length == 0) {
                    return;
                }
                rows.forEach(function (row) {
                    let coinStatus = {};
                    coinStatus.exchange = row.exchange;
                    coinStatus.coin = row.currency;
                    coinStatus.marketName = row.market_name;
                    coinStatus.lastSynced = row.last_synced;
                    coinStatus.notice = row.notice;
                    coinStatuses[row.currency] = coinStatus;
                    //console.log("Exchange: " + row.exchange + ", last synced: " + row.last_synced + ", notice: " + row.notice);
                });
                //console.log(Object.keys(coinStatuses));
                let coinStatusesCoins = Object.keys(coinStatuses );
                for(let i = 0; i < coinStatusesCoins.length; i++) {
                    switch(coinStatuses[coinStatusesCoins[i]].exchange) {
                        case 1:
                            delisterMessage += ":bittrex: | ";
                            break;
                        case 2:
                            delisterMessage += ":binance: | ";
                            break;
                        case 3:
                            delisterMessage += ":hitbit: | ";
                            break;
                    }

                    if(coinStatuses[coinStatusesCoins[i]].coin) {
                        delisterMessage += coinStatuses[coinStatusesCoins[i]].coin + "\n";
                    } else {
                        delisterMessage += coinStatuses[coinStatusesCoins[i]].marketName + "\n";
                    }
                    if(coinStatuses[coinStatusesCoins[i]].notice.toLowerCase().indexOf("delisted") !== -1 || coinStatuses[coinStatusesCoins[i]].notice.toLowerCase().indexOf("remove") !== -1) {
                        delisterMessage += "*Notice: " + coinStatuses[coinStatusesCoins[i]].notice + "*\n";
                    } else {
                        delisterMessage += "Notice: " + coinStatuses[coinStatusesCoins[i]].notice + "\n";
                    }
                    delisterMessage += "_Scraped: " + coinStatuses[coinStatusesCoins[i]].lastSynced + "_\n\n";
                }
                let responseMessageSplit = delisterMessage.match(/(.|[\r\n]){1,3999}/g);
                for(let j = 0; j < responseMessageSplit.length; j++) {
                    rtm.sendMessage(responseMessageSplit[j], botChannel);
                }
                delisterSql = "UPDATE statuses SET reported_in_slack = 1 WHERE reported_in_slack IS NOT 1 AND notice <> '' AND notice <> '—' ORDER BY exchange";
                db.run(delisterSql);
            });
        } catch(error) {
            console.log(error);
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
