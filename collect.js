const fs = require('fs')
const request = require('request')
const cheerio = require('cheerio')

const SITES = JSON.parse(fs.readFileSync('./sites.json'), 'utf8')

storeTeaser = (link, title, SITE) => {
    
    console.log(`store '${title}' for '${SITE.label_pretty}' ('${link}')`);
    /*
    let STORAGE = 

    if (!STORAGE[link]) {
        STORAGE[link] = { 
            link, 
            'title': [title],
            'last_seen': RUNTIME }
        countNewTeasers++
    } else {
        if (STORAGE[link]['title'][STORAGE[link]['title'].length-1] == title) {
            //console.log('title exists')
            STORAGE[link]['last_seen'] = RUNTIME
            countUnchangedTeasers++
        } else {
            console.log('title changed!!!!!!!!')
            console.log(`- OLD: '${STORAGE[link]['title'][STORAGE[link]['title'].length-1]}'`)
            console.log(`+ NEW: '${title}'`)
            STORAGE[link]['title'].push(title)
            STORAGE[link]['last_seen'] = RUNTIME
            countChangedTeasers++
        }        
    }
    */
}

handleTeaser = ($teaser, SITE) => {
    const link = cheerio(SITE.selector_for_title, $teaser)

    if (link.length > 0) {
        storeTeaser(link[0].attribs['href'], link[0].attribs['title'], SITE)
    }

    // TODO: vllt muss jede Zeitung eine eigene Klasse sein, die von BaseNewspaper erbt und solche Funktionen hier überschreibt.
    // SPIEGEL: href und title des Links () ... relativer link!
    // SZ: href des a.sz-teaser. Und da drin `sz-teaser__overline-title`+sz-teaser__title  

}

parsePage = (html, SITE) => {
    // TODO: consider https://www.npmjs.com/package/jsdom?
    const $ = cheerio.load(html);
    const teasers = $(SITE.selector_for_teaser)

    teasers.each(function(i, elem) {
        handleTeaser(elem, SITE)
    })

    return teasers.length
}

handleHtmlBody = (body, SITE) => {
    const numberOfTeasersFound = parsePage(body, SITE)
    console.log(`Found ${numberOfTeasersFound} teasers on ${SITE.label_pretty}.`)
}

collectSite = index => {
    const SITE = SITES[index]
    console.log(`collecting ${SITE.url}`);

    request(SITE.url, function (error, response, body) {

        if ( error ) {
            console.error( error );
        }

        // console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received

        const fetchtime = new Date()
        // TODO: helper function for beautiful mysql format datetimes with leading zeros
        const fetchtimeString = `${fetchtime.getDate()}-${fetchtime.getMonth()+1}-${fetchtime.getFullYear()}_${fetchtime.getHours()}-${fetchtime.getMinutes()}`
        fs.writeFileSync(`../storage/rawhtml/${SITE.id}__${fetchtimeString}.html`, body)

        handleHtmlBody(body, SITE)
        //clearStorage()
        //saveStorage()
        if (index < SITES.length-1) {
            collectSite(index+1)
        }
    })
}

collectSite(0)
