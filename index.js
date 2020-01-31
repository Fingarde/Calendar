const request = require('sync-request')
const dateFormat = require('dateformat');

const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/calendar']
const TOKEN_PATH = 'token.json'

async function main() {
	auth = await connect()
	//addEvents(auth)
    //events = await listEvents(auth)
    cours = await getCours()
    //console.log(events)
    console.log(cours)

    cours.forEach( async cour => {
        addEvents(auth, cour)
    }) 
	
}

async function getCours() {
    let dateDemain = new Date()
    dateDemain.setDate(dateDemain.getDate() + 3)
    let date = dateFormat(dateDemain, 'yyyymmdd');
    let response = request('GET', 'http://edt.uca.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=3348&nbWeeks=3&calType=ical&projectId=3').getBody('utf8')
    
    let cours = []

    let read
    response.split('\n').forEach( async (line) => {
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

function getDate(str) {
    year = str.substring(0, 4)
    month = str.substring(4, 6)
    day = str.substring(6, 8)

    hours = (Number.parseInt(str.substring(9, 11)) + 2)
    if(hours < 10) hours = "0" + hours
    minutes = str.substring(11, 13)
    return new Date(`${year}-${month}-${day}T${hours}:${minutes}`)
}

// GOOGLE API

async function connect() {
	try {
		let content = fs.readFileSync('/home/fingarde/Downloads/credentials.json')
		
		let auth = await authorize(JSON.parse(content))
		
		return auth
	}
	catch(err) {
		return console.log('Error loading client secret file:', err);
	}
}

async function authorize(credentials) {
	return new Promise(async retour => {
		const {client_secret, client_id, redirect_uris} = credentials.installed
		const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
		try {
			token = fs.readFileSync(TOKEN_PATH)
			oAuth2Client.setCredentials(JSON.parse(token))
		} catch (err) {
			retour(await getAccessToken(oAuth2Client))
		}

		retour(oAuth2Client)
	})
}

async function getAccessToken(oAuth2Client) {
	return new Promise(async retour => {
		const authUrl = await oAuth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: SCOPES,
		});
		console.log('Authorize this app by visiting this url:', authUrl)
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})
		
		rl.question('Enter the code from that page here: ', async (code) => {
			rl.close();
			oAuth2Client.getToken(code, async (err, token) => {
				if (err) retour(console.error('Error retrieving access token', err))
				await oAuth2Client.setCredentials(token)
				
				fs.writeFileSync(TOKEN_PATH, JSON.stringify(token))
				console.log('Token stored to', TOKEN_PATH)
			
				retour(oAuth2Client)
			})
		})
	})
}
	
async function listEvents(auth) {
	return new Promise( retour => {
		const calendar = google.calendar({version: 'v3', auth});
		calendar.events.list({
			calendarId: 'primary',
			timeMin: (new Date()).toISOString(),
			maxResults: 10,
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
		}
	};
	
	const calendar = google.calendar({version: 'v3', auth});
	calendar.events.insert({
		'calendarId': 'primary',
		'resource': event
    })
	
}


main().catch(console.error);