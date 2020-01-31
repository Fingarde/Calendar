const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/calendar']
const TOKEN_PATH = 'token.json'

async function main() {
	auth = await connect()
	//addEvents(auth)
	events = await listEvents(auth)
	console.log(events)
	//
	
}

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
				console.log('Upcoming 10 events:');
				retour(events)
			} else {
				console.log('No upcoming events found.');
			}
		});
	})
}

async function addEvents(auth) {
	var event = {
		'summary': 'Espagnol',
		'location': 'A22',
		'start': {
			'dateTime': '2020-02-01T09:00:00-07:00',
			'timeZone': 'America/Los_Angeles'
		},
		'end': {
			'dateTime': '2020-02-01T17:00:00-07:00',
			'timeZone': 'America/Los_Angeles'
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