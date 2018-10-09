/*******************************************************
 * Twitter Module
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
Polling.prototype.twitter = function(urls) {
    const {JSDOM}  = require("jsdom");

    // This class
    const instance = this;
    tag = "Twitter";

        urls.map(function(site) {
            var thisSite = Utils.urlCleaner(site);
            MediaBot.emit('log', `{${tag}} checking: [${Utils.httpStrip(thisSite)}]`);

            instance.openUrl(thisSite, tag).then(function(result) {
                if (result) {
                    const htmlDom   = new JSDOM(result, {includeNodeLocations:false});
                    const htmlBody  = htmlDom.window.document.body;
                    const rawSearch = htmlBody.querySelectorAll("div.content");

                    if (rawSearch) {
                        rawSearch.forEach(record => {
                            var rawAuthor = record.querySelector("strong.fullname");
                            var rawLink   = record.querySelector("a.tweet-timestamp");
                            var rawStamp  = record.querySelector("span.js-short-timestamp");

                            if (rawAuthor && rawLink && rawStamp) {
                                var author    = rawAuthor.innerHTML;
                                var url       = `https://twitter.com${rawLink.href}`;
                                var date      = new Date( parseInt(rawStamp.getAttribute("data-time-ms")) ).toISOString();

                                MediaBot.emit('polling-data', {
                                    name:   author,
                                    url:    url,
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
        });
    }
