// ==UserScript==
// @name         Save Stories
// @namespace    https://github.com/ARezaK/FallenLondon
// @version      1.0
// @description  Track FL
// @author       ARezaK
// @match        http://tampermonkey.net/scripts.php?locale=en
// @include      http://*fallenlondon.storynexus.com/Gap/Load*
// @require      http://code.jquery.com/jquery-1.11.3.min.js
// @require      https://github.com/pouchdb/pouchdb/releases/download/6.3.4/pouchdb-6.3.4.min.js
// @require      https://raw.githubusercontent.com/lodash/lodash/3.8.0/lodash.js
// @require http://stringjs.com/string.js
// @require https://raw.githubusercontent.com/jackmoore/colorbox/master/jquery.colorbox-min.js
// @grant        none
// ==/UserScript==


(function ($, undefined) {
    $(function () {

        window.dbOperations = {
            updateOrIgnoreBranch: function(dbBranch, scraped) {
                if (dbBranch.isTerminal) {
                    return dbOperations.handleExistingTerminalBranch(dbBranch, scraped);
                }
                else if(scraped.isSocial){
                    if(dbBranch.isSocial){
                        console.log("ignoring social matching branch");
                    }
                    else{
                        dbBranch.isSocial = true;

                        return branchDb.put(dbBranch).then(function(resp) {
                            return console.log('updated branch to be social', resp);
                        })["catch"](function(err) {
                            return console.log('failed to update branch!', err);
                        });
                    }
                }
                else {
                    return console.log('ignoring possibly different non-result branch for now', scraped);
                }
            },

            handleExistingTerminalBranch: function(dbBranch, scraped){
                var equivName, existingResult, mergeResult, newResults;
                equivName = function(b) {
                    return b.title === scraped.results[0].title;
                };

                existingResult = _.find(dbBranch.results, equivName);
                if (!existingResult) {
                    return dbOperations.scrapeNewBranch(scraped, dbBranch);
                }
                else{
                    return dbOperations.mergeExistingBranch(dbBranch, scraped);
                }
            },

            scrapeNewBranch: function(scraped, dbBranch){
                console.log('added new result', scraped.results[0]);
                dbBranch.results = dbBranch.results.concat(scraped.results);
                dbBranch.isSocial = scraped.isSocial;
                return branchDb.put(dbBranch).then(function(resp) {
                    return console.log('updated branch', resp);
                })["catch"](function(err) {
                    return console.log('failed to update branch!', err);
                });
            },

            mergeExistingBranch: function(dbBranch, scraped){
                newResults = _.map(dbBranch.results, function(r) {
                    if (_.filter(dbBranch.results, function(r) {
                        return r.type === scraped.results[0].type;
                    })) {
                        return dbOperations.mergeResult(r, scraped.results[0]);
                    } else {
                        return r;
                    }
                });
                dbBranch.results = newResults;
                return branchDb.put(dbBranch).then(function(resp) {
                    return console.log('updated known result', scraped.results[0], newResults);
                })["catch"](function(err) {
                    return console.log('failed to update known branch!', err);
                });
            },

            mergeResult: function(r1, r2) {
                var cloneR, newItems;
                cloneR = _.cloneDeep(r1);
                cloneR.items = _.map(cloneR.items, function(i) {
                    var inR2;
                    inR2 = _.find(r2.items, function(i2) {
                        return i2.name === i.name;
                    });
                    if (!(_.isArray(i.count))) {
                        i.count = [i.count, i.count];
                    }
                    i.count = _.map(i.count, function(c) {
                        if (_.isString(c)) {
                            return parseInt(c);
                        } else {
                            return c;
                        }
                    });
                    if (inR2) {
                        if (_.isArray(i.count)) {
                            if (i.count[0] > inR2.count[0]) {
                                i.count[0] = inR2.count[0];
                            } else if (i.count[1] < inR2.count[1]) {
                                i.count[1] = inR2.count[1];
                            }
                        }
                    }
                    return i;
                });
                newItems = _.filter(r2.items, function(newI) {
                    return !(_.any(cloneR.items, function(oldI) {
                        return oldI.name === newI.name;
                    }));
                });
                cloneR.items = cloneR.items.concat(newItems);
                cloneR.qualities = _.filter(cloneR.qualities, function(q) {
                    return _.isObject(q);
                });
                cloneR.qualities = cloneR.qualities.concat(_.filter(r2.qualities, function(newQ) {
                    return !(_.any(cloneR.qualities, function(oldQ) {
                        return oldQ.quality === newQ.quality;
                    }));
                }));
                return cloneR;
            },

        };

        window.dbQueries = {
            eventsForBranch: function(branchId) {
                return _.filter(storyDB.events, function(evt) {
                    return _.includes(evt.branches, String(branchId));
                });
            },
            showBranch: function(id) {
                return branchDb.get(String(id)).then(function(result) {
                    return console.log(result);
                })["catch"](function(err) {
                    return console.log('didnt find branch', err);
                });
            },
            showEvent: function(id) {
                return eventDb.get(String(id)).then(function(result) {
                    return console.log(result);
                })["catch"](function(err) {
                    return console.log('didnt find event', err);
                });
            },
            resultExists: function(table, resultType) {
                var dbObj;
                dbObj = storyDB[table];
                if (dbObj) {
                    return _.any(dbObj.results, 'type', resultType);
                } else {
                    return false;
                }
            },
            branchesWithItem: function(item) {
                return branchDb;
            },
            resultKnown: function(resultsList, newResult) {
                var equivNew;
                equivNew = function(extant) {
                    return extant.type === newResult.type;
                };
                return _.any(resultsList, equivNew);
            },
            searchFor: function(target, nToShow) {
                nToShow = nToShow || 3;
                var hasItem = function(result, target, direction){
                    direction = direction || "gained";
                    return _.any(result.items, function(i){
                        return (i.name == target && i.direction == "gained");
                    });
                };

                var itemAmt = function(branch, target, direction){
                    direction = direction || "gained";
                    res = _.find(branch.results, function(res){ return hasItem(res, target, direction); });
                    return _.find(res.items, function(i){
                        return (i.name == target && i.direction == direction);
                    }).count[1];
                };

                branchDb.query(function (doc, emit) {
                    if(_.any(doc.results, function(r){ return hasItem(r, target);})){
                        /* emit(itemAmt(doc, target)); */
                        emit(true);
                    } else {
                        /* emit(0); */
                        emit(false);
                    }

                }, {key: true, include_docs: true}).then(function (result) {
                    if(result.rows.length == 0){
                        console.log('none found');
                    }
                    else {
                        best = _.sortBy(result.rows, function(r){ return itemAmt(r.doc, target); }).reverse();

                        _.each(_.range(nToShow), function(i) {
                            if(best[i])
                                console.log('#' + i + ' best: ' + itemAmt(best[i].doc, target), best[i].doc);
                        });
                    }

                }).catch(function (err) {
                    console.log('err', err);
                });
            },
            resultsForEvent: function(eventId) {
                var itemsDescString, makeResultsObj, qualitiesDescString;
                itemsDescString = function(items) {
                    return _.map(items, function(i) {
                        return i.name + " (" + i.count[0] + " - " + i.count[1] + ")";
                    });
                };
                qualitiesDescString = function(qualities) {
                    return _.map(qualities, function(q) {
                        return q.quality + " (" + q.direction + ")";
                    });
                };
                makeResultsObj = function(resultList) {
                    return _.reduce(resultList, function(acc, result) {
                        if (!acc[result.title]) {
                            acc[result.title] = {};
                        }
                        if (acc[result.title][result.type]) {
                            acc[result.title][result.type].items = acc[result.name][result.type].items + itemsDescString(result.items).join("<br>");
                            acc[result.title][result.type].qualities = acc[result.name][result.type].qualities + qualitiesDescString(result.qualities).join("<br>");
                        } else {
                            acc[result.title][result.type] = {
                                items: itemsDescString(result.items).join("<br>"),
                                qualities: qualitiesDescString(result.qualities).join("<br>")
                            };
                        }
                        return acc;
                    }, {});
                };
                return new Promise(function(mainRes, mainRej) {
                    return eventDb.get(eventId).then(function(dbEvt) {
                        var branchPromises;
                        branchPromises = _.map(dbEvt.branches, function(br) {
                            return new Promise(function(resi, reji) {
                                return branchDb.get(br).then(function(dbBranch) {
                                    var branchDesc;
                                    branchDesc = fl.annotator.branchAttrs.shortDesc(dbBranch);
                                    return resi(dbBranch);
                                }, function(err) {
                                    return resi(void 0);
                                });
                            });
                        });
                        return Promise.all(branchPromises).then(function(branches) {
                            return mainRes(JSON.stringify(_.map(_.compact(branches), function(b) {
                                return makeResultsObj(b.results);
                            }), null, 2).replace(/\\n/g, "<br>").replace(" ", "&nbsp;"));
                        }, function(err) {
                            console.log('item scraper rejected?', err);
                            return mainRes("Error");
                        });
                    });
                });
            }
        };

        var fl = {
            util: {
                clone: function (obj) {
                    return JSON.parse(JSON.stringify(obj));
                },
                iShift: function (obj) {
                    var n = this.clone(obj);
                    n.shift();
                    return n;
                },

                waitForAjax: function (interval) {
                    interval = interval || 0;
                    return new Promise(function (resolve, reject) {
                        var pollForAjax;
                        pollForAjax = function (interval) {
                            if ($.active === 0) {
                                resolve('instant');
                            } else {
                                return setTimeout(function () {
                                    return pollForAjax(interval);
                                }, interval);
                            }
                        };
                        return pollForAjax(interval);
                    });
                },

                waitForElementToDisplay: function (selector, time, cb) {
                    if (document.querySelector(selector) !== null) {
                        cb();
                    } else {
                        setTimeout(function () {
                            fl.util.waitForElementToDisplay(selector, time, cb);
                        }, time);
                    }
                },

                maxBy: function (arr, fn, init) {
                    var best = null;
                    var maxVal = init || 0;
                    $.map(arr, function (obj){
                        var test = fn(obj);
                        if(test > maxVal) {
                            best = obj;
                            maxVal = test;
                        }
                    });

                    return best;
                },
            },

            linkAttrs: function() {
                $('#infoBarQImage209 > img').live('click', fl.cw);
                $('#infoBarQImage210 > img').live('click', fl.cs);
                $('#infoBarQImage211 > img').live('click', fl.cd);
                $('#infoBarQImage212 > img').live('click', fl.cp);
            },

            parseAttribute: function(str) {
                var matches = str.match(/(\S+)\s*([+-])(\d*)/);
                var m = fl.util.iShift(matches);
                if(m[1] == '+')
                    return [m[0], parseInt(m[2])];
                else
                    return [m[0], 0 - parseInt(m[2])];
            },

            parseAttributes: function (attrString){
                var attrs = {};
                $.map(attrString.split(';'), function(s){
                    var parsed = fl.parseAttribute(s);
                    attrs[parsed[0]] = parsed[1];
                });

                return attrs;
            },

            equippedValue: function(category, attribute) {
                var item = $('#InvCat-' + category + ' a[onclick^="unadoptThing"]');
                var textEl = $(item).find('span strong')[1];
                var attrs = {};
                if(textEl)
                    attrs = fl.parseAttributes(textEl.textContent);
                else
                    attrs = {};

                return attrs[attribute] || 0;
            },

            bestOfType: function(category, attribute) {
                var currentVal = fl.equippedValue(category, attribute);
                var selector = '#InvCat-' + category + ' a[onclick^="adoptThing"]';
                var items = $.map($(selector), function (el) {
                    var textEl = $(el).find('span strong')[1];
                    var attrs;
                    if (textEl) {
                        attrs = fl.parseAttributes(textEl.textContent);
                    } else {
                        attrs = {};
                    }

                    return {el: el,
                            attrs: attrs};
                });

                return fl.util.maxBy(items, function(i){
                    return i.attrs[attribute];
                }, currentVal);
            },

            chooseBest: function(attribute) {
                return new Promise(function(resolve, reject){
                    var goBackToStory = false;
                    if($('#tabnav > li > a.selected').text().trim() != "MYSELF"){
                        goBackToStory = true;
                        $('#meTab').click();
                    }


                    fl.util.waitForElementToDisplay('#inventory', 500, function(){
                        var categories = ['Gloves', 'Hat', 'Clothing', 'Weapon', 'Boots', 'Companion'];
                        $.map(categories, function(cat) {
                            var best = fl.bestOfType(cat, attribute);
                            if(best)
                                best.el.click();
                            return best;
                        });

                        fl.util.waitForAjax().then(function(){
                            if(goBackToStory){
                                console.log('going back');
                                $('#storyTab').click();
                            }
                            fl.util.waitForAjax().then(resolve);
                        });
                    });
                });
            },

            cd: function(){
                fl.chooseBest('Dangerous');
            },
            cp: function(){
                fl.chooseBest('Persuasive');
            },
            cs: function(){
                fl.chooseBest('Shadowy');
            },
            cw: function(){
                fl.chooseBest('Watchful');
            },

            tryAgain: function(){
                $('input[value="TRY THIS AGAIN"]').click();
            },
            chooseStorylet: function(name){
                $('div.storylet:contains("' + name + '")').find('div.go input').click();
            },
            enhancePage: function(){
                fl.linkAttrs();
            },
            chooseAndAgain: function(name) {
                return new Promise(function(resolve, reject) {
                    fl.chooseStorylet(name);
                    fl.util.waitForAjax().then(function() {
                        fl.tryAgain();
                        fl.util.waitForAjax().then(resolve);
                    });
                });
            },

            doNTimes: function(n, todo) {
                return fl.chooseAndAgain(todo).then(function() {
                    if (n > 2) {
                        fl.doNTimes(n - 1, todo);
                    }
                    else if (n == 2) {
                        fl.chooseStorylet(todo);
                    } else {
                        console.log('done');
                    }
                });
            },

            autoPickCard: function(){
                var actOnCard = function(eventId){
                    return new Promise(function(resolve, reject){
                        fl.util.waitForAjax().then(function(){
                            eventDb.get(String(eventId)).then(function(dbEvt) {
                                if(dbEvt.preferredChoice){
                                    if(dbEvt.preferredChoice == "discard"){
                                        discardEl = $('#cards li').has("input[onclick='beginEvent(" + eventId + ");']").children('input[value="DISCARD"]');
                                        $(discardEl).click();
                                        fl.util.waitForAjax().then(function() {
                                            console.log("discard", dbEvt);
                                            resolve({acted: true, reason: "discarded"});
                                        });
                                    }
                                    else {
                                        cardEl = $('#cards li a').has("input[onclick='beginEvent(" + eventId + ");']").children('input');
                                        $(cardEl).click();
                                        fl.util.waitForAjax().then(function() {
                                            fl.optThenChoose(dbEvt.preferredChoice).then(function(){
                                                fl.util.waitForAjax().then(function() {
                                                    console.log("onwards!");
                                                    $('input[value="ONWARDS!"]').click();
                                                    fl.util.waitForAjax().then(function(){
                                                        resolve({acted: true, reason: "picked " + dbEvt.preferredChoice + " for " + dbEvt.title + " (" + dbEvt._id + ")"});
                                                    });
                                                });
                                            });
                                        });
                                    }
                                }
                                else {
                                    resolve({acted: false, reason: "no preferred choice for " + dbEvt.title + " (" + dbEvt._id + ")"});
                                }
                            });
                        });
                    });
                };

                var actOnAvailableCards = function(){
                    return new Promise(function(resolve, reject) {
                        fl.util.waitForAjax().then(function(){
                            var acted = false;
                            var lastReason = "<default>";
                            var cards = fl.scraper.visibleCards();
                            var nCards = cards.length;
                            var maybeActOnN = function(n) {
                                if(!acted){
                                    actOnCard(cards[n]).then(function(result){
                                        acted = result.acted;
                                        lastReason = result.reason;

                                        if(!acted && (nCards > n + 1)){
                                            maybeActOnN(n + 1);
                                        }
                                        else if (nCards > n + 1) {
                                            resolve({acted: acted, reason: "no cards"});
                                        }
                                        else {
                                            resolve({acted: acted, reason: lastReason});
                                        }
                                    });
                                }
                                else {
                                    resolve({acted: acted, reason: lastReason});
                                }
                            };

                            maybeActOnN(0);
                        });
                    });
                };

                if($('#cards li a').length > 0){
                    return actOnAvailableCards();
                }
                else if($('#cardDeckLink')[0]){
                    $('#cardDeckLink').click();
                    return actOnAvailableCards();
                }
                else{
                    return new Promise(function(res,rej){ res({acted: false, reason: "no cards"});});
                }
            },

            autoCards: function(dontDraw){
                fl.autoPickCard().then(function(result){
                    if(result.acted){
                        fl.util.waitForAjax().then(function(){
                            fl.autoCards(dontDraw);
                        });
                    }
                    else {
                        fl.util.waitForAjax().then(function(){
                            if(fl.scraper.visibleCards().length < 3 && $('#cardDeckLink')[0]){
                                if(!dontDraw){
                                    $('#cardDeckLink').click();
                                    fl.util.waitForAjax().then(fl.autoCards);
                                }
                                else {
                                    console.log("autocards finished current set");
                                }
                            }
                            else{
                                console.log("autoCards finished because: " + result.reason);
                            }
                        });
                    }
                });
            },

            optThenChoose: function(title) {
                return new Promise(function(resolve, reject){
                    var qanda = fl.scraper.qualityAndOddsForStorylet(title) || [];
                    var quality = qanda[0];
                    var odds = qanda[1];
                    var tryOpt = quality && odds && (odds != "100");

                    if(tryOpt){
                        // probably should have a whitelist/ordering etc
                        fl.chooseBest(quality).then(function(){
                            console.log("done choosing!");
                            fl.chooseStorylet(title);
                            fl.util.waitForAjax().then(function(){
                                resolve("chose");
                            });
                        });
                    } else {
                        fl.chooseStorylet(title);
                        fl.util.waitForAjax().then(function(){
                            resolve("chose");
                        });
                    }
                });
            }
        };

        fl.scraper = {
            accountName: function(){
                return $('.subscription-username').text().trim().toLowerCase().replace(/ /g,'');
            },
            eventTitle: function () {
                return $('div.storylet_flavour_text h3').text().trim();
            },
            eventText: function (){
                return $('div.storylet_flavour_text p').text().trim();
            },
            isResult: function () {
                return ($('.quality_update_box').length !== 0);
            },
            isInvitation: function () {
                return !!$('.externalInviteButton')[0];
            },
            isSocial: function () {
                return !!$('select#targetCharacterId')[0] || fl.scraper.isInvitation();
            },
            isTerminal: function () {
                return (fl.scraper.isResult() || fl.scraper.isSocial());
            },
            isSuccess: function () {
                return !!$('div.quality_update_box:contains("succeeded")')[0];
            },
            isFail: function () {
                return !!$('div.quality_update_box:contains("failed")')[0];
            },
            isInevitable: function () {
                return this.isResult() && !(this.isSuccess() || this.isFail());
            },
            isLuck: function() {
                return $('#quality_update:contains("Luck")').length > 0;
            },
            isFortunate: function() {
                return this.isLuck() && $('#quality_update:contains("Luck")').siblings('p:contains("fortunate")').length > 0;
            },
            isUnlucky: function() {
                return this.isLuck() && $('#quality_update:contains("Luck")').siblings('p:contains("unlucky")').length > 0;
            },
            resultType: function() {
                if (!this.isResult()) {
                    return 'subBranch';
                } else if (this.isFortunate()) {
                    return 'fortunate';
                } else if (this.isUnlucky()) {
                    return 'unlucky';
                } else if (this.isSuccess()) {
                    return 'success';
                } else if (this.isFail()) {
                    return 'fail';
                } else if (this.isInevitable()) {
                    return 'inevitable';
                } else {
                    console.log('unknown result type');
                    return 'unknown';
                }
            },
            branchesForEvent: function() {
                var branchEls, getIds;
                getIds = function (els) {
                    return _.map(els, function (el) {
                        return el.id.match(/branch(\d+)/)[1];
                    });
                };
                branchEls = $('div.storylet[id^="branch"]');
                if (branchEls.length > 0) {
                    return getIds(branchEls);
                } else {
                    return [];
                }
            },
            branchTitle: function(id) {
                return $('#branch' + id + ' h5').text().trim();
            },
            branchText: function(id) {
                return $('#branch' + id + ' p').text().trim();
            },
            updatedQualities: function () {
                var extractQuality, qualityEls;
                extractQuality = function (e) {
                    var eText, matches, regexes, theRegex;
                    regexes = {
                        lostGained: {
                            regex: /You've (lost|gained) a (new)? quality: (\w+)/,
                            qualityN: 3,
                            directionN: 1
                        },
                        incDec: {
                            regex: /(.+) is (increasing|dropping)\.\.\./,
                            qualityN: 1,
                            directionN: 2
                        },
                        changedLevel: {
                            regex: /(.+) has (increased|dropped) to (\d+)/,
                            qualityN: 1,
                            directionN: 2
                        }
                    };
                    eText = $(e).text();
                    theRegex = _.find(regexes, function (r) {
                        return eText.match(r.regex);
                    });
                    if (theRegex) {
                        matches = eText.match(theRegex.regex);
                        return {
                            quality: matches[theRegex.qualityN],
                            direction: matches[theRegex.directionN]
                        };
                    } else {
                        return null;
                    }
                };
                qualityEls = $('div.quality_update_box p');
                return _.compact(_.map(qualityEls, extractQuality));
            },
            updatedItems: function () {
                var extractionRegex, updateEls;
                extractionRegex = /You\'ve (lost|gained) (\d+) x ([^(]+)/;
                updateEls = $('div.quality_update_box p');
                updateEls = _.filter(updateEls, function (el) {
                    return $(el).text().match(extractionRegex);
                });
                return _.map(updateEls, function (i) {
                    var matched = $(i).text().match(extractionRegex);
                    return {
                        name: matched[3].trim(),
                        count: [parseInt(matched[2], 10), parseInt(matched[2], 10)],
                        direction: matched[1]
                    };
                });
            },
            getResult: function () {
                if (!fl.scraper.isResult()) {
                    return [];
                } else {
                    return [
                        {
                            title: fl.scraper.eventTitle(),
                            text: fl.scraper.eventText(),
                            type: fl.scraper.resultType(),
                            qualities: fl.scraper.updatedQualities(),
                            items: fl.scraper.updatedItems()
                        }
                    ];
                }
            },
            scrapeEvent: function() {
                return {
                    title: fl.scraper.eventTitle(),
                    text: fl.scraper.eventText(),
                    isTerminal: fl.scraper.isTerminal(),
                    isSocial: fl.scraper.isSocial(),
                    results: fl.scraper.getResult(),
                    branches: fl.scraper.branchesForEvent(),
                    time: (new Date).getTime()
                };
            },
            scrapeBranch: function() {
                return {
                    isTerminal: fl.scraper.isTerminal(),
                    isSocial: fl.scraper.isSocial(),
                    subBranches: fl.scraper.branchesForEvent(),
                    results: fl.scraper.getResult(),
                    time: (new Date).getTime()
                };
            },
            currentLocation: function() {
                return $('#topMap img:not([class])').attr('alt');
            },

            qualityAndOddsForStorylet: function(title) {
                var challengeTxt = fl.challengElForStorylet(fl.storyletFor(title)).text();

                if(challengeTxt && challengeTxt.length > 0){
                    var lines = challengeTxt.split("\n");
                    var result = _.map(lines, function(s){
                        return s.trim();
                    }).join(" ").match(/Your (\w+) quality gives you a (.*)% chance of success/);
                    if(result){
                        var quality = result[1];
                        var odds = result[2];
                        return [quality, odds];
                    } else {
                        return []
                    }
                }
                return undefined;
            }
        };




        var $, jQuery;

        $ = jQuery = window.jQuery; //crap needed b/c of the grants for GM_XXXValue

        // EC stuff


        var remoteDb = ""; // set it to an ip address (http://localhost:5984) or e.g http://104.121.90.64:5984 or http://anna:secret@127.0.0.1:5984 if using remote or 'local' if not
        console.log('connected');
        var branchDb = new PouchDB('branches');
        var eventDb  = new PouchDB('events');
        var charDB   = new PouchDB('char_' + fl.scraper.accountName());
        if(remoteDb){
            branchDb.sync(remoteDb + '/fl_branches/', {live: true, retry: true});
            eventDb.sync(remoteDb + '/fl_events/', {live: true, retry: true});
            charDB.sync(remoteDb + 'char_' + fl.scraper.accountName(), {live: true, retry: true});
        }
        var qualitiesDb = new PouchDB('qualities');

        window.qs = dbQueries;

        fl.storyletFor = function(title) { return $('div.storylet:contains("' + title + '")'); };

        fl.challengElForStorylet = function(storylet){ return storylet.find('.challenge.cf'); };

        var captureSubmitBranchChoice = function(){
            var oldFun = SubmitBranchChoice;
            SubmitBranchChoice = function(form){
                var branchId = $(form).find('input[name="branchId"]').val();
                if(branchId){
                    title = fl.scraper.branchTitle(branchId);
                    text =  fl.scraper.branchText(branchId);
                    var ret = oldFun(form);
                    fl.util.waitForAjax().then(function(){
                        upsertBranch(title, text, parseInt(branchId));
                    });
                    return false;
                }
                else {
                    oldFun(form);
                    return false;
                }
            };
        };

        var setEventChoice = function(eventId, choice) {
            eventDb.get(eventId).then(function(evt){
                evt.preferredChoice = choice;

                eventDb.put(evt).then(function(){
                    console.log("Event " + evt.title + " (" + evt._id + ") set to '" + evt.preferredChoice + "'");
                });
            });
        };

        var toggleChoiceForEvent = function(eventId, choice){
            eventDb.get(eventId).then(function(evt){
                if(evt.preferredChoice != choice){
                    evt.preferredChoice = choice;
                }
                else{
                    evt.preferredChoice = undefined;
                }
                eventDb.put(evt).then(function(){
                    console.log("Event " + evt.title + " (" + evt._id + ") toggled to '" + evt.preferredChoice + "'");
                });
            });
        };




        var captureBeginEvent, captureDrawCards, captureLoadContent, captureLoadMainContent, capturePlanMarkers, currentTab, wrapEvents;

        window.storyDB = {
            events: {},
            branches: {}
        };

        window.upsertEvent = function(id) {
            return eventDb.get(String(id)).then(function(evt) {
                var plans;
                plans = $('.storylet').has('a.bookmark-plan.active');
                if (!evt.preferredChoice && plans.length > 0) {
                    evt.preferredChoice = $(plans[0]).find('h5').text();
                    return eventDb.put(evt).then(function(resp) {
                        return console.log('updated event preference', evt);
                    })["catch"](function(err) {
                        return console.log('updating event preference failed!', err);
                    });
                } else {
                    return console.log('already have ' + id, evt);
                }
            })["catch"](function(err) {
                var newEvt;
                newEvt = fl.scraper.scrapeEvent();
                console.log(newEvt);
                newEvt._id = String(id);
                //this is where i update my characters storlyine
                var object_to_put = {'time': newEvt.time, 'type': 'event', 'id_': String(id)};
                object_to_put._id = String(newEvt.time); //couchdb requires this for some dumb reason
                charDB.put(object_to_put);
                return eventDb.put(newEvt).then(function(resp) {
                    return console.log('saved new event', resp);
                })["catch"](function(err) {
                    return console.log('saving new event failed!', err);
                });
            });
        };


        window.upsertBranch = function(title, text, id) {
            var scraped;
            scraped = fl.scraper.scrapeBranch();
            scraped.title = title;
            scraped.text = text;
            scraped._id = String(id);
            //this is where i update my characters storlyine
            var object_to_put = {'time': scraped.time, 'pass_or_fail': scraped.results[0].type, 'type': 'branch', 'id_': String(id)};
            object_to_put._id = String(scraped.time); //couchdb requires this for some dumb reason
            charDB.put(object_to_put);
            return branchDb.get(String(id)).then(function(dbBranch) {
                return dbOperations.updateOrIgnoreBranch(dbBranch, scraped);
            }, function(err) {
                console.log('missing branch ' + id, err);
                return branchDb.put(scraped).then(function(resp) {
                    return console.log('saved new branch', resp, 'with result', scraped.results[0]);
                }, function(err) {
                    return console.log('saving new branch failed!', err);
                });
            });
        };


        capturePlanMarkers = function(eventId) {
            var storyletEls;
            storyletEls = $('.storylet').has('a.bookmark-plan');
            return $.each(storyletEls, function(indx, el) {
                var planEl;
                planEl = $(el).find('.bookmark-plan');
                return $(planEl).click(function() {
                    return fl.util.waitForAjax().then(function() {
                        if (planEl.hasClass("active")) {
                            return setEventChoice(String(eventId), $(el).find('h5').text());
                        } else {
                            return setEventChoice(String(eventId), void 0);
                        }
                    });
                });
            });
        };


        captureBeginEvent = function() {
            var oldFn;
            oldFn = window.beginEvent;
            return window.beginEvent = function(id) {
                oldFn(id);
                return fl.util.waitForAjax().then(function() {
                    console.log("beginning " + id);
                    upsertEvent(parseInt(id));
                    fl.annotator.annotateBranches();
                    return capturePlanMarkers(id);
                });
            };
        };


        captureLoadMainContent = function() {
            var oldFn;
            oldFn = window.loadMainContent;
            return window.loadMainContent = function() {
                var contentAddr, eventId;
                contentAddr = arguments[0];
                if (contentAddr.match(/Begin\\?eventid=(\\d+)$/)) {
                    eventId = contentAddr.match(/Begin\\?eventid=(\\d+)$/)[1];
                    oldFn.apply(window, arguments);
                    return fl.util.waitForAjax().then(function() {
                        console.log("trying " + eventId + " again");
                        upsertEvent(parseInt(eventId));
                        fl.annotator.annotateBranches();
                        fl.annotator.annotateEvents();
                        return fl.annotator.annotateCards();
                    });
                } else {
                    oldFn.apply(window, arguments);
                    return fl.util.waitForAjax().then(function() {
                        fl.annotator.annotateBranches();
                        fl.annotator.annotateEvents();
                        return fl.annotator.annotateCards();
                    });
                }
            };
        };


        captureLoadContent = function() {
            var oldFn;
            oldFn = window.loadMainContentWithParams;
            return window.loadMainContentWithParams = function() {
                var id, params, title;
                params = arguments[1];
                if (params['branchid']) {
                    id = params['branchid'];
                    title = fl.scraper.branchTitle(id);
                    text =  fl.scraper.branchText(id);
                    oldFn.apply(window, arguments);
                    return fl.util.waitForAjax().then(function() {
                        return upsertBranch(title, text, parseInt(id));
                    });
                } else {
                    return oldFn.apply(window, arguments);
                }
            };
        };

        captureDrawCards = function() {
            return $(document).on('click', '#card_deck', function() {
                return fl.util.waitForAjax().then(function() {
                    return fl.annotator.annotateCards();
                });
            });
        };

        fl.annotator = {
            getShortDescription: function(dbEvt) {
                var collapsedDesc, resultSummary;
                collapsedDesc = function(shortDs) {
                    if (_.all(shortDs, function(sd) {
                        return sd !== "Unknown";
                    })) {
                        return "Explored";
                    } else if (_.any(shortDs, function(sd) {
                        return sd !== "Unknown";
                    })) {
                        return "Partial";
                    } else {
                        return "Unknown";
                    }
                };
                resultSummary = function(branch) {
                    var descs, itemDesc;
                    itemDesc = function(item) {
                        return item.count[0] + " to " + item.count[1] + " " + item.name;
                    };
                    descs = _.map(['success', 'fail'], function(outcome) {
                        return _.map(_.flatten(_.pluck(_.filter(branch.results, {
                            type: outcome
                        }), 'items')), itemDesc).join(', ');
                    });
                    return "<strong>" + branch.title + ":</strong><br>On success, you could receive " + (descs[0] || 'nothing nice') + ".<br>On failure, " + (descs[1] || 'nothing nice');
                };
                return new Promise(function(resolve, reject) {
                    var branchPromises;
                    if (dbEvt.isTerminal) {
                        return resolve("Inevitable");
                    } else if (dbEvt.branches.length === 0) {
                        return resolve("Inconsistent!");
                    } else {
                        branchPromises = _.map(dbEvt.branches, function(br) {
                            return new Promise(function(resi, reji) {
                                return branchDb.get(br).then(function(dbBranch) {
                                    var branchDesc;
                                    branchDesc = fl.annotator.branchAttrs.shortDesc(dbBranch);
                                    return resi({
                                        completion: branchDesc,
                                        resultsDesc: resultSummary(dbBranch)
                                    });
                                }, function(err) {
                                    return resi({
                                        completion: "Unknown",
                                        resultsDesc: "Unknown"
                                    });
                                });
                            });
                        });
                        return Promise.all(branchPromises).then(function(res) {
                            return resolve({
                                completion: collapsedDesc(_.pluck(res, 'completion')),
                                resultDesc: _.pluck(res, 'resultsDesc').join("<br>\n")
                            });
                        }, function() {
                            console.log('i guess rejected?', arguments);
                            return resolve({
                                completion: "Error",
                                resultsDesc: "Error"
                            });
                        });
                    }
                });
            },
            branchAttrs: {
                shortDesc: function(dbBranch) {
                    switch (dbBranch.results.length) {
                        case 0:
                            if (dbBranch.isSocial) {
                                return "Social";
                            } else if (dbBranch.subBranches.length > 0) {
                                return "Transition";
                            } else {
                                return "Unknown";
                            }
                            break;
                        case 1:
                            if (dbBranch.results[0].type === 'inevitable') {
                                return 'Inevitable';
                            } else {
                                return 'Partial';
                            }
                            break;
                        case 2:
                            return "Explored";
                        default:
                            return "wtf is going on here?";
                    }
                },
                completenessDesc: function(dbBranch) {
                    switch (dbBranch.results.length) {
                        case 0:
                            return "Branch unexplored";
                        case 1:
                            return dbBranch.results[0].type + ' result known';
                        case 2:
                            return "both " + dbBranch.results[0].type + " and " + dbBranch.results[1].type + " known";
                        default:
                            return "we have " + dbBranch.results.length + " results for this branch. what is going on?";
                    }
                },
                colorForBranch: function(dbBranch) {
                    var cs;
                    cs = fl.annotator.branchColors;
                    switch (dbBranch.results.length) {
                        case 0:
                            if (dbBranch.isSocial) {
                                return cs.social;
                            } else if (dbBranch.subBranches.length > 0) {
                                return cs.transition;
                            } else {
                                return cs.unexplored;
                            }
                            break;
                        case 1:
                            if (dbBranch.results[0].type === 'inevitable') {
                                return cs.full;
                            } else {
                                return cs.partial;
                            }
                            break;
                        case 2:
                            return cs.full;
                        default:
                            return cs.unknown;
                    }
                }
            },
            branchColors: {
                unexplored: 'rgba(255, 138, 47, 0.45)',
                partial: 'rgba(175, 190, 255, 0.42)',
                full: 'rgba(8, 214, 76, 0.16)',
                unknown: 'rgba(228, 0, 25, 0.20)',
                social: 'rgba(8, 214, 76, 0.16)',
                transition: 'rgba(8, 214, 76, 0.16)'
            },
            annotateEvent: function(eventId) {
                var applyAnnotation, cs, eventColors, eventEl;
                eventEl = $('.storylet').has("input[onclick='beginEvent(" + eventId + ");']");
                cs = fl.annotator.branchColors;
                eventColors = {
                    Explored: cs.full,
                    Partial: cs.partial,
                    Unexplored: cs.unexplored,
                    Unknown: cs.unknown
                };
                applyAnnotation = function(annotationBody, shortD) {
                    var annotationId, button, eventAnnotation;
                    button = '<br><input type="button" class="standard_btn">';
                    annotationId = "#eventAnnotation" + eventId;
                    eventAnnotation = "<br><div id='eventAnnotation" + eventId + "'><div class='toggle'></div><div class='annotation'></div></div>";
                    $(eventEl).append(eventAnnotation);
                    $(annotationId).find('.toggle').append(button).find('input').attr('style', "width: 95px !important; background-color: " + eventColors[shortD.completion] + ";").val(shortD.completion).click(function(e) {
                        return $(annotationId).find('.annotation').toggle();
                    });
                    $(annotationId).find('.annotation').append("<div style='font-size: 0.8em; width: 400px;'>" + shortD.resultDesc + "</div>").append(annotationBody).hide();
                    return $(annotationId).css('position', 'relative').css('left', '83px').css('bottom', '26px').css('margin-bottom', '-26px').css('width', '250px');
                };
                if (eventEl) {
                    return eventDb.get(String(eventId)).then(function(dbEvt) {
                        return fl.annotator.getShortDescription(dbEvt).then(function(shortD) {
                            return applyAnnotation(renderjson(dbEvt), shortD);
                        }, function(err) {
                            console.log('shortD err', err);
                            return applyAnnotation(renderjson(dbEvt), "Err");
                        });
                    }, function(err) {
                        return applyAnnotation("<p>Never Visited</p>", {
                            completion: "Unexplored",
                            resultDesc: "Unexplored"
                        });
                    });
                }
            },
            annotateBranch: function(branchId) {
                var appendFullInfo, applyAnnotations;
                applyAnnotations = function(shortD, fullD, bgColor) {
                    var annotation, branchEl, infoButton, storylet_lhs;
                    annotation = '<br><input type="button" class="standard_btn">';
                    branchEl = $("#branch" + branchId);
                    storylet_lhs = $("#branch" + branchId + " .storylet_lhs");
                    storylet_lhs.append(annotation);
                    infoButton = $("#branch" + branchId + " .storylet_lhs input");
                    branchEl.append("<div id=branchAnnotation" + branchId + ">" + fullD + "</div>");
                    $("#branchAnnotation" + branchId).hide();
                    infoButton.css('background-color', bgColor).css('max-width', '80px').attr('value', shortD);
                    return infoButton.click(function(evt) {
                        return $("#branchAnnotation" + branchId).toggle();
                    });
                };
                appendFullInfo = function(parentEl, dbBranch) {
                    return $(parentEl).append(renderjson(dbBranch));
                };
                return branchDb.get(branchId).then(function(dbBranch) {
                    applyAnnotations(fl.annotator.branchAttrs.shortDesc(dbBranch), fl.annotator.branchAttrs.completenessDesc(dbBranch), fl.annotator.branchAttrs.colorForBranch(dbBranch));
                    return appendFullInfo($("#branchAnnotation" + branchId), dbBranch);
                }, function(err) {
                    return applyAnnotations("Unknown", "Never Explored", fl.annotator.branchColors.unexplored);
                });
            },
            annotateCard: function(eventId) {
                var cardEl;
                cardEl = $('#cards li').has("input[onclick='beginEvent(" + eventId + ");']");
                if (cardEl) {
                    return eventDb.get(String(eventId)).then(function(dbEvt) {
                        return fl.annotator.getShortDescription(dbEvt).then(function(shortD) {
                            return dbQueries.resultsForEvent(eventId).then(function(itemsDesc) {
                                $(cardEl).find('span.tt').append("<p><strong>" + shortD.completion + "</strong></p>");
                                return $(cardEl).find('span.tt').append("<p>" + itemsDesc + "</p>");
                            });
                        }, function() {
                            return $(cardEl).find('span.tt').append("<p>Err</p>");
                        });
                    }, function() {
                        return $(cardEl).find('span.tt').append("<p>Never Visited</p>");
                    });
                }
            },
            annotateBranches: function() {
                return _.each(fl.scraper.branchesForEvent(), fl.annotator.annotateBranch);
            },
            annotateEvents: function() {
                return _.each(fl.scraper.eventsOnPage(), fl.annotator.annotateEvent);
            },
            annotateCards: function() {
                return fl.util.waitForAjax().then(function() {
                    return _.each(fl.scraper.visibleCards(), fl.annotator.annotateCard);
                });
            }
        };

        wrapEvents = function() {
            captureBeginEvent();
            captureLoadContent();
            captureLoadMainContent();
            captureSubmitBranchChoice();
            return captureDrawCards();
        };

        fl.scraper.eventsOnPage = function() {
            var evtEls;
            evtEls = $('.storylet').has('input[onclick^="beginEvent"]');
            return _.map(evtEls, function(el) {
                return $(el).find('input[onclick^="beginEvent"]').attr('onclick').match(/beginEvent\((\d+)\)/)[1];
            });
        };

        fl.scraper.visibleCards = function() {
            var cardEls;
            cardEls = $('#cards li').has('input[onclick^="beginEvent"]');
            return _.map(cardEls, function(el) {
                return $(el).find('input[onclick^="beginEvent"]').attr('onclick').match(/beginEvent\((\d+)\)/)[1];
            });
        };

        fl.scraper.updatedQualities = function() {
            var extractQuality, qmap, qualityEls;
            extractQuality = function(e) {
                var eText, matches, regexes, theRegex;
                regexes = {
                    lostGained: {
                        regex: /You've (lost|gained) a (new)? quality: (\w+)/,
                        qualityN: 3,
                        directionN: 1
                    },
                    incDec: {
                        regex: /(.+) is (increasing|dropping)\.\.\./,
                        qualityN: 1,
                        directionN: 2
                    },
                    changedLevel: {
                        regex: /(.+) has (increased|dropped) to (\d+)/,
                        qualityN: 1,
                        directionN: 2
                    },
                    occurrence: {
                        regex: /An occurrence! Your '(.+)' Quality is now (\d+)/,
                        qualityN: 1,
                        directionN: 2
                    },
                    hasFone: {
                        regex: /Your '(.+)' Quality has (gone)/,
                        qualityN: 1,
                        directionN: 2
                    }
                };
                eText = $(e).text();
                theRegex = _.find(regexes, function(r) {
                    return eText.match(r.regex);
                });
                if (theRegex) {
                    matches = eText.match(theRegex.regex);
                    return {
                        quality: matches[theRegex.qualityN],
                        direction: matches[theRegex.directionN]
                    };
                } else {
                    return null;
                }
            };
            qualityEls = $('div.quality_update_box p');
            qmap = _.map(qualityEls, extractQuality);
            return _.compact(qmap);
        };

        fl.scraper.qualities = {
            getLhsQualities: function() {
                var actionsObj, parseQuality, ret;
                parseQuality = function(el) {
                    var extractionRegex, parts;
                    extractionRegex = /([\w\s]+) (\d+)\s+([+-]\d+)?/;
                    parts = $(el).text().match(extractionRegex);
                    return {
                        _id: parts[1],
                        natural: parts[2],
                        bonus: parts[3] || 0
                    };
                };
                actionsObj = {
                    id: 'ACTIONS',
                    natural: $('#infoBarCurrentActions').text(),
                    bonus: 0
                };
                ret = _.map($('span[id ^= "infoBarQLevel"].red').parent(), parseQuality);
                return ret = ret.concat(actionsObj);
            }
        };

        fl.updateQualities = function() {
            return qualitiesDb.bulkDocs(fl.scraper.qualities.getLhsQualities()).then(function() {
                return console.log('qual update');
            }, function() {
                return console.log('failed qual update');
            });
        };

        currentTab = function() {
            return $('#tabnav > li > a.selected').text().trim();
        };

        $(function() {
            wrapEvents();
            return fl.util.waitForAjax().then(function() {
                fl.annotator.annotateBranches();
                fl.annotator.annotateEvents();
                return fl.annotator.annotateCards();
            });
        });




        // END EC stuff

        /*
    var i = 0; // set timer to 0

    function download(filename) {
        if(i != 1){ //if timer is not 1 dont download
            return;
        }
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(document.documentElement.outerHTML));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }
    document.addEventListener("submit", function(){ // reset timer when clicking submit
        i=0;
        console.log('submit');
    });

    $(".standard_btn").live('click', function() { { i=0; console.log('submit'); }}); // reset timer when clicking standard_btn.

    document.addEventListener("DOMNodeInserted", function(e) {
        var element = e.target;
        var title = $("#mainContentViaAjax > div.storylet_flavour_text > h3");
        if ($("#perhapsnotbtn").length > 0 || $('input[value="TRY THIS AGAIN"]').length >0 || $('input[value="ONWARDS!"]').length >0 ){ // means we have clicked a story
            console.log("download ready");
            i++; // start timer
            var milliseconds = (new Date).getTime();

            var content_ = $("#mainContentViaAjax").html();

            var reg = /contentKey=(\d+)/;
            var event_id = content_.match(reg)[1];

            var filename = milliseconds + '-' + title.text().trim() + '-' + event_id + '-' +  '.html';
            download(filename);
            return;
        }

        console.log("appending title");

    });*/
    });
})(window.jQuery.noConflict(true));
