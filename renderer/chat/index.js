const list_div  = document.getElementById('chat-list');
const input_div = document.getElementById('chat-input');
const send_btn  = document.getElementById('chat-send');

function appendSkeleton() {
    const cell = document.createElement('div');
    cell.className = 'cell is-col-span-3';

    const bubble = document.createElement('div');
    bubble.className = 'skeleton-block';

    cell.appendChild(bubble);
    list_div.appendChild(cell);
    list_div.scrollTop = list_div.scrollHeight;
}

function deleteSkeleton() {
    const skeleton = document.querySelector('.skeleton-block');
    if (skeleton) {
        skeleton.parentElement.remove();
    }
}

function appendMessage(message, fromUser = false) {
    const cell = document.createElement('div');
    cell.className = fromUser ? 'cell is-col-span-3 is-col-start-2' : 'cell is-col-span-3';

    const bubble = document.createElement('div');
    bubble.className = fromUser ? 'notification bubble' : 'notification is-primary bubble';
    bubble.textContent = message;
    cell.appendChild(bubble);

    list_div.appendChild(cell);

    if (!fromUser) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cell';
        list_div.appendChild(emptyCell);
    }

    list_div.scrollTop = list_div.scrollHeight;
}

send_btn.addEventListener('click', async (event) => {
    const userMessage = input_div.value.trim();
    if (!userMessage) {
        return;
    }

    appendMessage(userMessage, true);
    input_div.value = '';

    // Call Groq
    appendSkeleton();
    await window.electronAPI.messageToAi(userMessage)
        .then((assistantMessage) => {
            if (assistantMessage) {
                console.log('Received assistant message:', assistantMessage);
                deleteSkeleton();
                appendMessage(assistantMessage, false);
            }
        })
        .catch((err) => {
            console.error('Error from Groq:', err);
            deleteSkeleton();
            appendMessage('抱歉，無法取得回覆。請稍後再試。', false);
        });

    // deleteSkeleton();
    // appendMessage(assistantMessage, false);

    event.preventDefault();
});

input_div.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        send_btn.click();
    }
});
