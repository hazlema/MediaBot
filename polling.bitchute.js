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
    const tag        = "BitChute";
    const FeedParser = require('feedparser');
    
    urls.map(function(site) {
        const thisSite = Utils.urlCleaner(site);
        const bitFeed  = new FeedParser();
        
        MediaBot.emit('log', `{${tag}} checking: [${Utils.httpStrip(thisSite)}]`);
        
        request
            .get(thisSite)
            .on('response', function(response) {
                if (response.statusCode != 200) {
                    MediaBot.emit('log-notify', `{${tag}} <WARNING> http error: [${response.statusCode}], url: [${Utils.httpStrip(url)}]`);
                }
            })
            .on('error', function(response) {
                MediaBot.emit('log-notify', `{${tag}} <WARNING> request error: [${response}], url: [${Utils.httpStrip(url)}]`);
            })
            .pipe(bitFeed);
        
        bitFeed.on('error', function (error) {
            console.log(error);
            MediaBot.emit('log', `{BitChute} <WARNING> feedparser error: [${error.message}]`);
            MediaBot.emit('notify', `{BitChute} <WARNING> feedparser error: [${error.message}]`);
        });
        
        bitFeed.on('readable', function() {
            var stream = this;
            var item;
            
            while (item = stream.read()) {
                if (item !== null) {
                    MediaBot.emit('polling-data', {
                        name:  item['meta']['title'],
                        url:   item['link'].replace('embed', 'video'),
                        date:  item['pubdate'],
                        source: 'bitchute'
                    });
                }
            }
        });
    });   
}
