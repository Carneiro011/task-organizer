const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');

const app = express();
app.use(bodyParser.json());

const CLIENT_ID = '201282138652-n5rsdlfdgtgjbae4bvkqvquc2l8u8pt1.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://66462b5eea43.ngrok-free.app/oauth2callback';


// Cliente OAuth2
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Tokens temporários (na prática você salva no banco depois do login)
let tokens = null;

// Rota para iniciar autenticação no Google
app.get('/auth', (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/calendar.events'];
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  res.redirect(url);
});

// Rota que recebe o código e troca por tokens
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  const { tokens: userTokens } = await oAuth2Client.getToken(code);
  tokens = userTokens;
  oAuth2Client.setCredentials(tokens);
  res.send('✅ Autorizado! Agora o webhook pode criar eventos no seu calendário.');
});

// Webhook do Dialogflow
app.post('/webhook', async (req, res) => {
  const intent = req.body.queryResult.intent.displayName;

  if (intent === 'Criar Tarefa') {
    if (!tokens) {
      return res.json({
        fulfillmentText: '⚠️ Primeiro autorize o acesso ao Google Calendar. Acesse: http://localhost:3000/auth'
      });
    }

    const tarefa = req.body.queryResult.parameters.tarefa;
    const data = req.body.queryResult.parameters.date;

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const evento = {
      summary: tarefa,
      start: { dateTime: data },
      end: { dateTime: data },
    };

    try {
      await calendar.events.insert({
        calendarId: 'primary',
        resource: evento,
      });
      res.json({ fulfillmentText: `✅ Tarefa "${tarefa}" criada para ${data}.` });
    } catch (error) {
      console.error(error);
      res.json({ fulfillmentText: '❌ Erro ao criar tarefa no Google Calendar.' });
    }
  } else {
    res.json({ fulfillmentText: 'Intenção não reconhecida no webhook.' });
  }
});

app.listen(3000, () => console.log('🚀 Webhook rodando na porta 3000'));
