const fs = require('fs')
const request = require('request')
const cheerio = require('cheerio')

const SITES = JSON.parse(fs.readFileSync('./sites.json'), 'utf8')
const RUNTIME = new Date().getTime()

let countNewTeasers = 0
let countUnchangedTeasers = 0
let countChangedTeasers = 0

clearStorage = STORAGE => {
    for (index in STORAGE) {
        const item = STORAGE[index]
        if (item.title && item.title.length == 1 && (!item.last_seen || item.last_seen < RUNTIME - 3600*1000)) {
            delete STORAGE[index]
        }
    }
    return STORAGE
}

storeTeaser = (link, title, SITE, STORAGE) => {
    
    // console.log(`store '${title}' for '${SITE.label_pretty}' ('${link}')`);

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
            const lastTitle = STORAGE[link]['title'][STORAGE[link]['title'].length-1]
            console.log('title changed!!!!!!!!')
            console.log(`- OLD: '${lastTitle}'`)
            console.log(`+ NEW: '${title}'`)
            STORAGE[link]['title'].push(title)
            STORAGE[link]['last_seen'] = RUNTIME

            // const htmlOfDiff = simplediff.htmlDiff(lastTitle, title)
            // let diffieBody = fs.readFileSync('./diffie.html').toString()
            // const htmlOfDiff = `<small>Geänderte Headline bei ZEIT Online: ${link}</small><p><script>document.write(htmlDiff('${lastTitle}', '${title}'))</script></p><hr>`
            // diffieBody = diffieBody.replace('<!-- PLACEHOLDER_FOR_NEW -->', '<!-- PLACEHOLDER_FOR_NEW -->\n\n' + htmlOfDiff)
            // fs.writeFileSync('./diffie.html', diffieBody)

            countChangedTeasers++
        }        
    }

}

handleTeaser = ($teaser, SITE, STORAGE) => {
    const link = cheerio(SITE.selector_for_title, $teaser)

    if (link.length > 0) {
        storeTeaser(link[0].attribs['href'], link[0].attribs['title'], SITE, STORAGE)
    }

    // TODO: vllt muss jede Zeitung eine eigene Klasse sein, die von BaseNewspaper erbt und solche Funktionen hier überschreibt.
    // SPIEGEL: href und title des Links () ... relativer link!
    // SZ: href des a.sz-teaser. Und da drin `sz-teaser__overline-title`+sz-teaser__title  

}

parsePage = (html, SITE) => {
    // TODO: consider https://www.npmjs.com/package/jsdom?
    const $ = cheerio.load(html);
    const teasers = $(SITE.selector_for_teaser)

	let STORAGE = JSON.parse(fs.readFileSync(`./../storage/${SITE.id}.json`), 'utf8')

    teasers.each(function(i, elem) {
    	// TODO: spätestens hier (Verwaltung des Storage) brauchen wir eigene Klassen
        handleTeaser(elem, SITE, STORAGE)
    })

    STORAGE = clearStorage(STORAGE)
    fs.writeFileSync(`./../storage/${SITE.id}.json`, JSON.stringify(STORAGE, null, 4))

	request.post(`https://pushdata.io/info@newsdiffs.de/changed_teasers_${SITE.id}/${countChangedTeasers}`)

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
        // fs.writeFileSync(`../storage/rawhtml/${SITE.id}__${fetchtimeString}.html`, body)

        handleHtmlBody(body, SITE)
        //clearStorage()
        //saveStorage()
        if (index < SITES.length-1) {
            collectSite(index+1)
        }
    })
}

collectSite(0)
