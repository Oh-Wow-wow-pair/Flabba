const markdownit = require('markdown-it');
const { getSingleStaff } = require('../../db');
require('dotenv').config();

let messageCount = 0;
let conversationID = '';

async function generateQuery(staff, message) {
  if (!staff) return '';

  let query = '';

  if (messageCount == 0) {
    messageCount++;

    query += `My name is ${staff.first_name} ${staff.last_name}, I work in the ${staff.dept_name} department as a ${staff.job_title}. My email is ${staff.email} and my phone number is ${staff.phone}. I was hired on ${staff.hire_date} and my current salary is $${staff.salary}. My employment status is ${staff.status}. Here is my question: `;
  }

  query += `${message}`;
  return query;
}

async function messageToAi(message) {
  let staff = await getSingleStaff('EMP001');
  let query = await generateQuery(staff, message);

  let body = {
    inputs: {},
    response_mode: 'blocking',
    auto_generate_name: true,
    user: 'flabba-pet',
    query: query,
    conversation_id: conversationID
  };

  console.log('Sending message to AI:', message);
  console.log('Request body:', JSON.stringify(body, null, 2));

  // DIFY API call
  return await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    .then(async (response) => {
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('API response data:', data);
      
      const md = markdownit({
        html: true,
        breaks: true,
        linkify: true,
        typographer: true,
      });

      // 檢查數據是否有效
      if (!data || typeof data.answer !== 'string') {
        console.error('Invalid API response structure:', data);
        return '抱歉，AI 服務返回了無效的響應。';
      }

      conversationID = data.conversation_id || conversationID;

      console.log('Rendered markdown:', md.render(data.answer));
      return md.render(data.answer); // Converts markdown to HTML
    })
    .catch((error) => {
      console.error('AI chat error:', error);
      return '抱歉，AI 服務暫時不可用。請檢查網絡連接或稍後再試。';
    });
}

module.exports = {
  messageToAi,
  getMessageCount: () => messageCount,
  getConversationID: () => conversationID,
  setConversationID: (id) => { conversationID = id; }
};