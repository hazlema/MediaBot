/*******************************************************
 * YouTube Module
 * Every polling module must be of class poll
 *
 * Send logging data to terminal and web:
 * MediaBot.emit('log', [text]);
 *
 * Send error string:
 * MediaBot.emit('notify', [text]);
 *
 * Send log & error:
 * MediaBot.emit('log-notify', [text]);
 *
 * Send data to database:
 * MediaBot.emit('polling-data', { name, url, date, source });
 ********************************************************/
Polling.prototype.youtube = function(urls) {
    const ago      = require("ago");
    const isNumber = require("isnumber");
    const {JSDOM}  = require("jsdom");

    // This class
    const instance = this;
    const tag = "YouTube";

        urls.map(function(site) {
            var thisSite = Utils.urlCleaner(site);
            MediaBot.emit('log', `{${tag}} checking: [${Utils.httpStrip(thisSite)}]`);

            instance.openUrl(thisSite, tag).then(function(result) {
                if (result) {
                    var htmlDom   = new JSDOM(result, {includeNodeLocations:false});
                    var htmlBody  = htmlDom.window.document.body;
                    var rawAuthor = htmlBody.querySelector("img.appbar-nav-avatar");
                    var rawSearch = htmlBody.querySelectorAll("div.yt-lockup-content");

                    if (rawAuthor && rawSearch) {
                        var author = rawAuthor.getAttribute("title");

                        rawSearch.forEach(record => {
                            var rawLink   = record.querySelector("a.yt-uix-tile-link");
                            var rawItems  = record.querySelectorAll("li");
                            
                            if (rawLink && rawItems) {
                                var link = `https://www.youtube.com${rawLink.href}`;
                                var date = new Date().toISOString();

                                if (rawItems.length >= 1) {
                                    var rawDate = rawItems[1].innerHTML;
                                    var parse   = rawDate.split(' ');

                                    if (parse.length == 3 && isNumber(parse[0]) && parse[1])
                                        date = new Date(ago(parse[0], parse[1])).toISOString();
                                }

                                MediaBot.emit('polling-data', {
                                    name:   author,
                                    url:    link,
                                    date:   date,
                                    source: tag.toLowerCase()
                                });
                            }
                        });
                    }
                }
            }).catch(function(e) {
                MediaBot.emit('log-notify', `{${tag}} <WARNING> parse error [${e}], url: [${Utils.httpStrip(thisSite)}]`);
            });
        })
    }
