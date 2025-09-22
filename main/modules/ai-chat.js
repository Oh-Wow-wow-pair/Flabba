const markdownit = require('markdown-it');
const { getSingleStaff } = require('../../db');

let messageCount = 0;
let conversationID = "";

async function generateQuery(staff, message) {
    if (!staff) return "";

    let query = "";

    if (messageCount == 0) {
        messageCount++;

        query += `My name is ${staff.first_name} ${staff.last_name}, my emplyee ID is ${staff.staff_id}. I work in the ${staff.dept_name} department as a ${staff.job_title}. My email is ${staff.email} and my phone number is ${staff.phone}. I was hired on ${staff.hire_date} and my current salary is $${staff.salary}. My employment status is ${staff.status}. Here is my question: `;
    }

    query += `${message}`;
    return query;
}

async function messageToAi(message) {
    let staff = await getSingleStaff("user001");
    let query = await generateQuery(staff, message);

    let body = {
        inputs: {},
        response_mode: "blocking",
        auto_generate_name: true,
        user: "flabba-pet",
        query: query,
        conversation_id: conversationID,
    };

    console.log("Sending message to AI:", message);
    console.log(body);

    // DIFY API call
    return await fetch("https://api.dify.ai/v1/chat-messages", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })
    .catch((error) => {
        console.error("Error during fetch:", error);
    })
    .then((response) => response.json())
    .then((data) => {
        conversationID = data.conversation_id;
        return JSON.parse(data.answer);
    })
    .then((answer) => {
        const md = markdownit({
            html: true,
            breaks: true,
            linkify: true,
            typographer: true,
        });

        let leaveData = {
            name: "John Doe",
            id: "user001",
            department: "工程部",
            type: "病假",
            startDate: new Date(2025, 10, 1),
            endDate: new Date(2025, 10, 2),
            reason: "頭痛",
        };
        sendLeaveDataToRenderer(leaveData);

        console.log(answer.action.tool_response);
        return md.render(answer.response);
    });
}

function sendLeaveDataToRenderer(leaveData) {
    if (leaveWindow && !leaveWindow.isDestroyed() && !leaveWindow.isVisible()) {
        leaveWindow.show();
    }

    leaveWindow.webContents.send("send-leave-data", leaveData);
}

module.exports = {
    messageToAi,
    getMessageCount: () => messageCount,
    getConversationID: () => conversationID
};
