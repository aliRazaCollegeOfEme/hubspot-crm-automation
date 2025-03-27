require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');
const express = require('express');

const app = express();
const hubspot = require('@hubspot/api-client');

// Get Env's
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPORT_CLIENT_ID = process.env.HUBSPORT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;
const HUBSPORT_ACCESS_TOKEN = process.env.HUBSPORT_ACCESS_TOKEN;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// Instantiate Rate limit options
const DEFAULT_LIMITER_OPTIONS = {
    minTime: 1000 / 9,
    maxConcurrent: 6,
    id: 'hubspot-client-limiter',
};
// Instantiate hubpot client
const hubspotClient = new hubspot.Client({
    developerApiKey: HUBSPOT_API_KEY,
    limiterOptions: DEFAULT_LIMITER_OPTIONS,
    accessToken: HUBSPORT_ACCESS_TOKEN,
    numberOfApiCallRetries: 3, // Retry mechanism
});

const FETCH_CONTACTS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts/search';
const FETCH_DEALS_URL = 'https://api.hubapi.com/crm/v3/objects/deals/search';
const CREATE_DEAL_URL = 'https://api.hubapi.com/crm/v3/objects/deals';
const UPDATE_DEAL_URL = 'https://api.hubapi.com/crm/v3/objects/deals';
const FETCH_CONTACTS_LIMIT = 100; // For Pagination
// HubSpot API Headers
const headers = {
  Authorization: `Bearer ${HUBSPOT_API_KEY}`,
  'Content-Type': 'application/json',
};

// Fetch contacts added in January 2025
async function fetchContacts() {
  const query = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'createdate',
            operator: 'BETWEEN',
            value: '2025-01-01T00:00:00Z',
            highValue: '2025-01-31T23:59:59Z',
          },
        ],
      },
    ],
    properties: ['id', 'firstname', 'email'],
    limit: FETCH_CONTACTS_LIMIT,
    after: 0,
  };

  try {
    console.log('search API');
    const response = await hubspotClient.crm.contacts.searchApi.doSearch(query);
    // const response = await axios.post(FETCH_CONTACTS_URL, query, { headers });
    // const rawResponse = await hubspotClient.apiRequest({
    //     path: '/crm/v3/objects/contacts',
    //     method: 'POST',
    //     body: query,
    //     headers: headers,
    // });
    // console.log({ rawResponse});
    console.log({ response });
    return rawResponse.data.results;
  } catch (error) {
    console.error('Error fetching contacts:', error.response?.data || error);
    return [];
  }
}

// Check and process deals for each contact
async function processDeals(contacts) {
  let updatedDeals = 0;
  let newDeals = 0;

  for (const contact of contacts) {
    const contactId = contact.id;
    const contactName = contact.properties.firstname || 'Unknown';

    // Check if contact has deals
    const dealUrl = FETCH_DEALS_URL;
    const query = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'associations.contact',
              operator: 'EQ',
              value: contactId,
            },
          ],
        },
      ],
    };

    try {
      const dealResponse = await axios.post(dealUrl, query, { headers });

      if (dealResponse.data.results.length > 0) {
        const dealId = dealResponse.data.results[0].id;
        await updateDeal(dealId);
        updatedDeals++;
      } else {
        await createNewDeal(contactId, contactName);
        newDeals++;
      }
    } catch (error) {
      console.error(`Error processing deals for ${contactId}:`, error.response?.data || error);
    }
  }

  return { updatedDeals, newDeals };
}

// Process deals in Batches
async function processDealsInBatches(contacts) {
    try {
        const BATCH_SIZE = 100;
        let batch_start = 0;
        let updatedDeals = 0;
        let newDeals = 0;
        const contacts_batch = contacts.slice(batch_start, BATCH_SIZE);

        const dealObjs = contacts_batch.map((contact) => {
            return {
                id: contact.id,
                propertyName: 'associations.contact',
            }
        });
        const dealResponse = await hubspotClient.crm.deals.batchApi.update({ inputs: dealObjs });

        if (dealResponse.data.results.length > 0) {
          const dealId = dealResponse.data.results[0].id;
          await updateDeal(dealId);
          updatedDeals++;
        } else {
            await createNewDeal(contactId, contactName);
            newDeals++;
        }
        if (contacts_batch.length < BATCH_SIZE) {
            console.log('Processing of Deals Completed');
            return { updatedDeals, newDeals };
        }
    } catch (error) {
        console.error('Error processing deals:', error.response?.data || error);
    }
}

// Update existing deal
async function updateDeal(dealId) { 
  const url = `${UPDATE_DEAL_URL}/${dealId}`;
  const data = { properties: { follow_up_status: 'pending_review' } };

  await axios.patch(url, data, { headers });
}

// Create a new deal for contact
async function createNewDeal(contactId, contactName) {
  const url = CREATE_DEAL_URL;
  const data = {
    properties: {
      dealname: `New Deal for ${contactName}`,
      pipeline: 'default',
      dealstage: 'appointmentscheduled',
      amount: 1000,
    },
    associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] }],
  };

  await axios.post(url, data, { headers });
}

// Send email notification
async function sendEmailReport(totalContacts, updatedDeals, newDeals) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: ADMIN_EMAIL,
    subject: 'HubSpot CRM Automation Report',
    text: `
      Total contacts processed: ${totalContacts}
      Deals updated: ${updatedDeals}
      New deals created: ${newDeals}
    `,
  };

  await transporter.sendMail(mailOptions);
}

// Main function
async function runAutomation() {
  console.log('***** Starting automation *****');
  const contacts = await fetchContacts();
  if (contacts.length === 0) {
    console.log('No contacts found for January 2025.');
    return;
  }
  console.log('Contacts found for automation:', contacts.length);

  const { updatedDeals, newDeals } = await processDeals(contacts);
  await sendEmailReport(contacts.length, updatedDeals, newDeals);
  console.log('***** Automation completed successfully *****');
}

app.get('/', async (req, res) => {
    const authorizationCode = req.query.code;
    console.log("Authorization Code:", authorizationCode);

    if (!authorizationCode) {
        return res.status(400).send("Authorization code is missing");
    }

    // Exchange authorization code for access & refresh tokens
    try {
        // const response = await axios.post("https://api.hubapi.com/oauth/v1/token", {
        //     grant_type: "authorization_code",
        //     client_id: HUBSPORT_CLIENT_ID,
        //     client_secret: HUBSPOT_CLIENT_SECRET,
        //     redirect_uri: HUBSPOT_REDIRECT_URI,
        //     code: authorizationCode
        // });
        const response =  hubspotClient.oauth.tokensApi.create(
            'authorization_code',
            authorizationCode, // the code you received from the oauth flow
            HUBSPOT_REDIRECT_URI,
            HUBSPORT_CLIENT_ID,
            HUBSPOT_CLIENT_SECRET,
        );

        const { access_token, refresh_token } = response.data;
        
        // Store the refresh_token securely
        console.log("Access Token:", access_token);
        console.log("Refresh Token:", refresh_token);

        return res.send('Welcome to the CRM automation Application. OAuth flow completed. Check your console for tokens.');
    } catch (error) {
        console.error("Error exchanging token:", error.response.data);
        res.status(500).send("Failed to get access token");
    }
});

// runAutomation();
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
    runAutomation();
});
