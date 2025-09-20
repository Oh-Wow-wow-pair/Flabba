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
        deleteSkeleton();
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cell';
        list_div.appendChild(emptyCell);
    }
    else {
        appendSkeleton();
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

    // Simulate a response from the assistant
    setTimeout(() => {
        const assistantMessage = '這是回覆訊息的範例。';
        appendMessage(assistantMessage, false);
    }, 1500);

    event.preventDefault();
});

input_div.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        send_btn.click();
    }
});
