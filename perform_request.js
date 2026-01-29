
const https = require('https');

const data = JSON.stringify({
  "accountId": 33,
  "type": "expense",
  "category": "Food",
  "amount": 10,
  "currency": "EUR",
  "date": "2026-01-27T15:47:57.000Z",
  "description": "Test edit"
});

const options = {
  hostname: 'budgetrackers.vercel.app',
  port: 443,
  path: '/api/transactions/143',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJwaWxpb3RvdiIsImlhdCI6MTc2OTExMDk3OCwiZXhwIjoxNzY5NzE1Nzc4fQ.OkM2mcSKnz9slNdH0l_q0_vlicfU4EgLidXKpvAu1Zc',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (d) => {
    body += d;
  });
  
  res.on('end', () => {
    console.log(`Response Body: ${body}`);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
