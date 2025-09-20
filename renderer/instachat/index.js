const instalist_div  = document.getElementById('instachat-list');
const instainput_div = document.getElementById('instachat-input');
const instasend_btn  = document.getElementById('instachat-send');
const scroll = document.getElementById('main-header');

function appendSkeleton() {
    const cell = document.createElement('div');
    cell.className = 'cell is-col-span-3';

    const bubble = document.createElement('div');
    bubble.className = 'skeleton-lines';
    bubble.innerHTML = "<div></div><div></div><div></div>";

    cell.appendChild(bubble);
    instalist_div.appendChild(cell);
    instalist_div.scrollTop = instalist_div.scrollHeight;
}

function deleteSkeleton() {
    const skeleton = document.querySelector('.skeleton-lines');
    if (skeleton) {
        skeleton.parentElement.remove();
    }
}

function appendMessage(message, fromUser = false) {
    const cell = document.createElement('div');
    cell.className = fromUser ? 'cell is-col-span-3 is-col-start-2' : 'cell is-col-span-3';

    const bubble = document.createElement('div');
    bubble.className = fromUser ? 'notification bubble input-bubble' : 'notification is-primary bubble reply-bubble';
    bubble.textContent = message;
    cell.appendChild(bubble);

    instalist_div.appendChild(cell);

    if (!fromUser) {
        deleteSkeleton();
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cell';
        instalist_div.appendChild(emptyCell);
    }
    else {
        appendSkeleton();
    }

    instalist_div.scrollTop = instalist_div.scrollHeight;
}

instasend_btn.addEventListener('click', async (event) => {
    const userMessage = instainput_div.value.trim();
    if (!userMessage) {
        return;
    }

    appendMessage(userMessage, true);
    instainput_div.value = '';

    // Simulate a response from the assistant
    setTimeout(() => {
        const assistantMessage = '這是回覆訊息的範例。';
        appendMessage(assistantMessage, false);
    }, 1500);

    event.preventDefault();
});

instainput_div.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        instasend_btn.click();
    }
});
