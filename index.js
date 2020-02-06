const request = require('sync-request')
const dateFormat = require('dateformat');
const fs = require('fs')
const {google} = require('googleapis');

const calendar = require("./src/calendar")
const resourcesPath = './res/'

async function main() {

    let iCalLink = 'http://edt.uca.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=3348&nbWeeks=3&calType=ical&projectId=3'
    let iCal = await getICal(iCalLink)

    if(fs.existsSync(resourcesPath + 'ical.txt'))
    {
        let oldICal = fs.readFileSync(resourcesPath + 'ical.txt').toString()
  
        let iCalArray = iCal.split('\n')
        let oldICalArray = oldICal.split('\n')

        let same = true
        for(let i = 0; i < iCal.length; i++) {
            if(iCalArray[i] != oldICalArray[i]) {
                console.log(iCalArray[i])
                if(iCalArray[i].startsWith('DTSTAMP'))
                    continue

                same = false
            }
        }

        if(same) {
            process.exit(1)
        }
    }

    console.log('Updating')

    fs.writeFileSync(resourcesPath + 'ical.txt', iCal)

    auth = await calendar.connect('')

    calendarID = await getCalendar(auth)
    if(!calendarID) {
        calendarID = await createCalendar(auth)
    }

    let date = new Date()
    date.setHours(0)
    date.setMinutes(0)
  
    for(let i = 0; i < 31; i++) {
        let agenda = await getEvents(auth, date, calendarID)
        let cours = await getCours(iCal, date)
       
        agenda.forEach(async event => {
            let contains = false
    
            cours.forEach(async cour => {
                let debutClone = new Date(cour.debut)
                debutClone.setHours(cour.debut.getHours() + - 1)

                let finClone = new Date(cour.fin)
                finClone.setHours(cour.fin.getHours() + - 1)
    
                let sameDebut = debutClone.toISOString().substring(0, 19) + 'Z' == event.start.dateTime
                let sameFin = finClone.toISOString().substring(0, 19) + 'Z' == event.end.dateTime
              
                if(event.summary == cour.nom && sameDebut && sameFin) {
                    contains = true
                }
            })

            if(!contains) {
                agenda.splice(agenda.indexOf(event), 1 );
                await removeEvent(auth, event.id, calendarID)
            }
        })
    
        cours.forEach(async cour => {
            let contains = false
    
            agenda.forEach(async event => {
                let debutClone = new Date(cour.debut)
                debutClone.setHours(cour.debut.getHours() + - 1)

                let finClone = new Date(cour.fin)
                finClone.setHours(cour.fin.getHours() + - 1)
    
                let sameDebut = debutClone.toISOString().substring(0, 19) + 'Z' == event.start.dateTime
                let sameFin = finClone.toISOString().substring(0, 19) + 'Z' == event.end.dateTime
              
                if(event.summary == cour.nom && sameDebut && sameFin) {
                    contains = true
                }
            })
    
            if(!contains) addEvent(auth, cour, calendarID)
        })

        date.setDate(date.getDate() + 1)
    }
}

// Functions
async function getICal(iCalLink) {
    return new Promise(async value => {
        value(await request('GET', iCalLink).getBody('utf8'))
    })
}

async function getDate(str) {
    year = str.substring(0, 4)
    month = str.substring(4, 6)
    day = str.substring(6, 8)

    hours = (Number.parseInt(str.substring(9, 11)) + 2)
    if(hours < 10) hours = "0" + hours
    minutes = str.substring(11, 13)
    return new Date(`${year}-${month}-${day}T${hours}:${minutes}`)
}

async function getCours(iCal, date) {
    let dateParse = dateFormat(date, 'yyyymmdd');
    let cours = []

    let read
    await iCal.split('\n').forEach( async (line) => {
        line = line.replace('\r', '')
        if(line.startsWith(`DTSTART:${dateParse}`)) {
            cours.push({
                nom: '',
                salle: '',
                debut: '',
                fin: ''
            })
    
            read = true
        }
    
        if(line.startsWith('END:VEVENT') && read) {
            read = false
        }
    
        if(read) {
            let map = line.split(':')
            switch(map[0]) {
                case "SUMMARY":
                    cours[cours.length - 1 ].nom = map[1]
                    break
                case "DTSTART":
                    cours[cours.length - 1 ].debut = await getDate(map[1])
                    break
                case "DTEND":    
                    cours[cours.length - 1 ].fin = await getDate(map[1])
                    break
                case "LOCATION":
                    cours[cours.length - 1 ].salle = map[1]
                    break
            }
        }
    })

    return cours
}

// GOOGLE API
async function getEvents(auth, dateDebut, calendarID) {
	return new Promise( value => {
        let dateFin = new Date(dateDebut)
        dateFin.setHours(23)

        const calendar = google.calendar({version: 'v3', auth})
        
		calendar.events.list({
			'calendarId': calendarID,
            'timeMin': dateDebut.toISOString(),
            'timeMax': dateFin.toISOString(),
			'singleEvents': true,
			'orderBy': 'startTime',
		}, async (err, res) => {
			if (err) {
                console.log('The API returned an error: ' + err)
                value(undefined)
            }
			
			const events = await res.data.items;

			value(events)
		})
	})
}


async function addEvent(auth, cour, calendarID) {
	var event = {
		'summary': cour.nom,
		'location': cour.salle,
		'start': {
			'dateTime': cour.debut.toISOString().substring(0, 19) + "+01:00",
			'timeZone': 'Europe/Paris'
		},
		'end': {
			'dateTime': cour.fin.toISOString().substring(0, 19) + "+01:00",
			'timeZone': 'Europe/Paris'
		},
		'reminders': {
            'useDefault': false,
            'overrides': [
              {'method': 'popup', 'minutes': 30},
            ],
          },
        'sequence': 139
	};
	
	const calendar = google.calendar({version: 'v3', auth});
	await calendar.events.insert({
		'calendarId': calendarID,
		'resource': event
    })
	
}

async function removeEvent(auth, id, calendarID) {
    const calendar = google.calendar({version: 'v3', auth});
    calendar.events.delete({
        'calendarId': calendarID,
        'eventId': id
    }, function(err) {
        if (err) {
          console.log('The API returned an error: ' + err);
          return;
        }
    })
}

async function getCalendar(auth) {
    return new Promise( async value => {
        const calendarSession = google.calendar({version: 'v3', auth});
        let res = await calendarSession.calendarList.list()
        let calendars = res.data.items

        calendars.forEach(calendar => {
            if(calendar.summary == 'ENT UCA') {
                value(calendar.id)
            }
        })

        value(undefined)
    })
}

async function createCalendar(auth) {
    return new Promise( async value => {
        const calendar = google.calendar({version: 'v3', auth});
        await calendar.calendars.insert({
            'resource': {
                'summary': "ENT UCA"
            }
        }).then(res => {
            value(res.data.id)
        })
    })
}

async function dropCalendar(auth) {
    const calendarSession = google.calendar({version: 'v3', auth});
    let res = await calendarSession.calendarList.list()
    let calendars = res.data.items

    calendars.forEach(calendar => {
        if(calendar.summary == 'ENT UCA'){
            calendarSession.calendars.delete({
                calendarId: calendarr.id
            })
        }
    })
}



// Main
main()