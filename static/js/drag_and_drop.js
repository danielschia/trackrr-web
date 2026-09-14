const TRACKRR_API_BASE_URL = window.TRACKRR_API_BASE_URL || 'http://127.0.0.1:5000';
let draggedTaskId = null;
let draggedTaskElement = null;

document.addEventListener('dragstart', function (event) {
    const taskCard = event.target.closest('.task-card');
    if (!taskCard) return;

    draggedTaskId = Number(taskCard.dataset.taskId);
    draggedTaskElement = taskCard;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(draggedTaskId));
});

document.addEventListener('dragover', function (event) {
    const list = event.target.closest('.list-column');
    if (!list) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
});

document.addEventListener('drop', function (event) {
    const list = event.target.closest('.list-column');
    if (!list || draggedTaskId === null) return;

    event.preventDefault();

    const targetListId = Number(list.dataset.listId);
    const tasksContainer = list.querySelector('.list-column__tasks');
    const position = getDropPosition(tasksContainer, event.clientY);

    sendTaskMove(draggedTaskId, targetListId, position);
});

function getDropPosition(listElement, mouseY) {
    const cards = [...listElement.querySelectorAll('.task-card')];
    let insertIndex = cards.length;

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const rect = card.getBoundingClientRect();
        if (mouseY < rect.top + rect.height / 2) {
            insertIndex = i;
            break;
        }
    }

    return insertIndex;
}

function moveTaskCardInDom(taskId, targetListElement, position) {
    const taskCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    const tasksContainer = targetListElement.querySelector('.list-column__tasks');

    if (!taskCard || !tasksContainer) return;

    const insertBeforeElement = tasksContainer.querySelectorAll('.task-card')[position] || tasksContainer.querySelector('.list-column__add-task');

    if (insertBeforeElement) {
        tasksContainer.insertBefore(taskCard, insertBeforeElement);
    } else {
        tasksContainer.appendChild(taskCard);
    }
}

function sendTaskMove(taskId, targetListId, position) {
    const token = localStorage.getItem('trackrr_access_token');

    fetch(`${TRACKRR_API_BASE_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
            list_id: targetListId,
            position: position + 1
        })
    })
    .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.error) {
            console.error('Move failed', data?.error || 'Unknown error');
            return;
        }

        const targetList = document.querySelector(`.list-column[data-list-id="${targetListId}"]`);
        if (targetList) {
            moveTaskCardInDom(taskId, targetList, position);
        }

        draggedTaskId = null;
        draggedTaskElement = null;
        console.log('Task moved successfully', data);
    })
    .catch(error => {
        console.error('Error moving task:', error);
    });
}