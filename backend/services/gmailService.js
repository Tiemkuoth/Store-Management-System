import { google } from 'googleapis';

const getOAuth2Client = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth configuration is missing in .env');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

export const getAuthUrl = () => {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
};

export const getTokensFromCode = async (code) => {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

export const getUserEmail = async (accessToken) => {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
  const userInfo = await oauth2.userinfo.get();
  return userInfo.data.email;
};

const getGmailClient = (tokens) => {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

export const fetchRecentEmails = async (tokens, maxResults = 10) => {
  try {
    const gmail = getGmailClient(tokens);
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
    });

    const messages = response.data.messages || [];
    const emailDetails = await Promise.all(
      messages.map(async (message) => {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });
        const headers = msg.data.payload.headers;
        const getHeader = (name) => headers.find(h => h.name === name)?.value || '';
        return {
          id: msg.data.id,
          snippet: msg.data.snippet,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          date: getHeader('Date'),
        };
      })
    );
    return emailDetails;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
};

export const sendEmail = async (tokens, { to, subject, body }) => {
  try {
    const gmail = getGmailClient(tokens);
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      body,
    ];
    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
    return res.data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
