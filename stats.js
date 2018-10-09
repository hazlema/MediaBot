/*******************************************
 * Simple data storage class for
 * maintaining statistics
 ********************************************/
class Stats {
    constructor() {
        this.posts = 0;      
        this.inserts = 0;
        this.rebuilds = 0;
        this.skips = 0;
    }    

    inc(stat) {
        switch (stat) {
            case "post": this.posts += 1; break;
            case "insert": this.inserts += 1; break;
            case "delete": this.deletes += 1; break;
            case "rebuild": this.rebuilds += 1; break;
            case "skip": this.skips += 1; break;
        }
    }
}

module.exports = { Stats };