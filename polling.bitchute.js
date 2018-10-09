/*******************************************************
* BitChute Module
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
*******************************************************/
Polling.prototype.bitchute = function(urls) {
    const FeedParser = require('feedparser');
    const Stream     = require('stream').Readable;

    // This class
    const instance = this;
    const tag      = "BitChute";

    urls.map(function(site) {
        const thisSite = Utils.urlCleaner(site);
        MediaBot.emit('log', `{${tag}} checking: [${Utils.httpStrip(thisSite)}]`);

        instance.openUrl(thisSite, tag).then(function(result) {
            if (result) {
                // Convert HTML into a stream
                var readable = new Stream();
                readable.push(result);
                readable.push(null);
        
                // Pipe to feedparser
                readable.pipe(new FeedParser())
                    .on('error', function (error) {
                        MediaBot.emit('log-notify', `{BitChute} <WARNING> feedparser error: [${error.message}]`);
                    })
                    .on('readable', function() {
                        var stream = this;
                        var item;
                        
                        while (item = stream.read()) {
                            if (item !== null) {
                                MediaBot.emit('polling-data', {
                                    name:  item['meta']['title'],
                                    url:   item['link'].replace('embed', 'video'),
                                    date:  item['pubdate'],
                                    source: tag.toLowerCase()
                                });
                            }
                        }
                    });
            }
        }).catch(function(e) {
            MediaBot.emit('log-notify', `{${tag}} <WARNING> parse error [${e}], url: [${Utils.httpStrip(thisSite)}]`);
        });
    });   
}
