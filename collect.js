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
        if (item.versions && item.versions.length == 1 && (!item.last_seen || item.last_seen < RUNTIME - 3600*1000)) {
            delete STORAGE[index]
        }
    }
    return STORAGE
}

storeTeaser = (link, title, text, SITE, STORAGE) => {
    
	if (!link) {
		return
	}

	// TODO: another reason for site-specific classes

	// filter stuff like immobilienmarkt.faz.net, leserreisen.faz.net, abo.faz.net
	if (link.indexOf('faz.net')>=0 && link.indexOf('www.faz.net')<0) {
		return
	}

    // console.log(`store '${title}' for '${SITE.label_pretty}' ('${link}')`);

    if (!STORAGE[link]) {
        STORAGE[link] = { 
            'link': link, 
            'versions': [{
                'title': title,
                'text': text,
                'seen': RUNTIME
            }],
            'first_seen': RUNTIME,
            'last_seen': RUNTIME }
        countNewTeasers++
    } else {
        const latestVersionIndex = STORAGE[link]['versions'].length-1
        const latestVersion = STORAGE[link]['versions'][latestVersionIndex]
        if (latestVersion['title'] == title && latestVersion['text'] == text) {
            //console.log('title exists')
            STORAGE[link]['last_seen'] = RUNTIME
            countUnchangedTeasers++
        } else {
            if (latestVersion['title'] !== title) {
                console.log(`title changed @${SITE.id} !!!!!!!!`)
                console.log(`- OLD: '${latestVersion['title']}'`)
                console.log(`+ NEW: '${title}'`)                
            }
            if (latestVersion['text'] !== text) {
                console.log(`text changed @${SITE.id} !!!!!!!!`)
                console.log(`- OLD: '${latestVersion['text']}'`)
                console.log(`+ NEW: '${text}'`)                
            }
            STORAGE[link]['versions'].push({
                'title': title,
                'text': text,
                'seen': RUNTIME
            })
            STORAGE[link]['last_seen'] = RUNTIME
            countChangedTeasers++
        }        
    }

}

handleTeaser = ($teaser, SITE, STORAGE) => {
    const linkElement = cheerio(SITE.selector_for_title, $teaser)

    if (linkElement.length > 0) {
        const link = linkElement[0].attribs['href']
        const title = linkElement[0].attribs['title']
        const text = cheerio(SITE.selector_for_text, $teaser).text().trim()
        if (title && title.length && text && text.length) {
            storeTeaser(link, title, text, SITE, STORAGE)
        }
    }

    // TODO: vllt muss jede Zeitung eine eigene Klasse sein, die von BaseNewspaper erbt und solche Funktionen hier überschreibt.
    // SPIEGEL: href und title des Links () ... relativer link!
    // SZ: href des a.sz-teaser. Und da drin `sz-teaser__overline-title`+sz-teaser__title  

    // TODO: Umgang mit Teasern die keinen Text haben, z.B. News auf der HP oder Buzzbox. Und vllt sogar doppelt drauf sind: normal mit Text, Buzzbox ohne Text.

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
    fs.writeFileSync(`./../storage/${SITE.id}.json`, JSON.stringify(STORAGE, null, 2))

	request.post(`https://pushdata.io/info@newsdiffs.de/changed_teasers_${SITE.id}/${countChangedTeasers}`)

    return teasers.length
}

handleHtmlBody = (body, SITE) => {
    const numberOfTeasersFound = parsePage(body, SITE)
    // console.log(`Found ${numberOfTeasersFound} teasers on ${SITE.label_pretty}.`)
}

collectSite = index => {
    const SITE = SITES[index]
    // console.log(`collecting ${SITE.url}`);

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
