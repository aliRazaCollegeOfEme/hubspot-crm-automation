require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
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
  };

  try {
    const response = await axios.post(FETCH_CONTACTS_URL, query, { headers });
    return response.data.results;
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
  const contacts = await fetchContacts();
  if (contacts.length === 0) {
    console.log('No contacts found for January 2025.');
    return;
  }

  const { updatedDeals, newDeals } = await processDeals(contacts);
  await sendEmailReport(contacts.length, updatedDeals, newDeals);
  console.log('Automation completed successfully.');
}

// Execute script
runAutomation();
