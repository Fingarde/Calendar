const fs = require('fs')
const {google} = require('googleapis');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/calendar']
const TOKEN_PATH = 'token.json'
exports.connect = async function connect(token) {
	try {
		let content = fs.readFileSync('res/credentials.json')
		let auth = await authorize(JSON.parse(content), token)
		
		return auth
	}
	catch(err) {
		return console.log('Error loading client secret file', err);
	}
}

async function authorize(credentials, token) {
	return new Promise(async retour => {
		const {client_secret, client_id, redirect_uris} = credentials.installed
		const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
		try {
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

async function createToken() {
    
}
	