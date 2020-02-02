const request = require('sync-request')
const dateFormat = require('dateformat');

const {google} = require('googleapis');

const oui = require("./src/oui")


let calendar
async function main() {


	
	auth = await oui.connect('token')
    cours = await getCours()
    calendar =  google.calendar({version: 'v3', auth})
    addCalendar(auth)
    await calendar.calendarList.list().then( cal => {
    console.log(cal.data.items)
   })
   // await cours.forEach( async cour => { addEvents(auth, cour) })

    //events = await listEvents(auth)
    /*events.forEach(async event => {
        await supprimerEvent(auth, event.id)
    })*/
    //console.log(events)
	
}

async function addCalendar(auth) {
	const calendar = google.calendar({version: 'v3', auth});
	await calendar.calendars.insert({
        'resource': {
            'summary': "ENT UCA"
        }
    })
	
}
async function getCours() {
    let dateDemain = new Date()
    dateDemain.setDate(dateDemain.getDate() + 1)
    let date = dateFormat(dateDemain, 'yyyymmdd');
    let response = await request('GET', 'http://edt.uca.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=3348&nbWeeks=3&calType=ical&projectId=3').getBody('utf8')
    
    let cours = []

    let read
    await response.split('\n').forEach( async (line) => {
        line = line.replace('\r', '')
        if(line.startsWith(`DTSTART:${date}`)) {
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

async function getDate(str) {
    year = str.substring(0, 4)
    month = str.substring(4, 6)
    day = str.substring(6, 8)

    hours = (Number.parseInt(str.substring(9, 11)) + 2)
    if(hours < 10) hours = "0" + hours
    minutes = str.substring(11, 13)
    return new Date(`${year}-${month}-${day}T${hours}:${minutes}`)
}

// GOOGLE API

async function listEvents(auth) {
	return new Promise( retour => {
		const calendar = google.calendar({version: 'v3', auth});
		calendar.events.list({
			calendarId: 'primary',
			timeMin: (new Date()).toISOString(),
			maxResults: 20,
			singleEvents: true,
			orderBy: 'startTime',
		}, async (err, res) => {
			if (err) retour(console.log('The API returned an error: ' + err));
			
			const events = res.data.items;
			if (events.length) {
				retour(events)
			} else {
				console.log('No upcoming events found.');
			}
		});
	})
}

async function addEvents(auth, cour) {
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
			'useDefault': true	
        },
        'sequence': 1819
	};
	
	const calendar = google.calendar({version: 'v3', auth});
	await calendar.events.insert({
		'calendarId': 'primary',
		'resource': event
    })
	
}

async function supprimerEvent(auth, id) {
    const calendar = google.calendar({version: 'v3', auth});
    calendar.events.delete({
        calendarId: 'primary',
        eventId: id
    }, function(err) {
        if (err) {
          console.log('The API returned an error: ' + err);
          return;
        }
    })
}

main().catch(console.error);